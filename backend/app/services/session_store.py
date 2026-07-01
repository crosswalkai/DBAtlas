"""
Session Store
-------------
Manages in-flight session state during the checkpoint loop.
Local dev: in-memory dict.
Production: Firestore (async).

Separate from session logging (which is the final audit record).
"""
import asyncio
import logging
from typing import Optional, Any
import json
import os
from pathlib import Path
from datetime import datetime
from app.models.schemas import (
    SessionState, SessionMode, DbmsType, IntentCategory,
    StepResult, CheckpointLogEntry, ClaudeRoutingDecision,
    FinalAnalysis, Playbook,
)

logger = logging.getLogger(__name__)


class SessionData:
    """Live session state — held in memory during checkpoint loop."""

    def __init__(
        self,
        session_id: str,
        dba_uid: str,
        server_name: str,
        ticket_number: str,
        question: str,
        mode: SessionMode,
        dbms: DbmsType,
        playbook: Playbook,
        use_mock_data: bool = True,
    ):
        self.session_id = session_id
        self.dba_uid = dba_uid
        self.server_name = server_name
        self.ticket_number = ticket_number
        self.question = question
        self.mode = mode
        self.dbms = dbms
        self.playbook = playbook
        self.use_mock_data = use_mock_data

        self.state: SessionState = "INIT"
        self.intent_category: Optional[IntentCategory] = None
        self.time_reference: Optional[str] = None
        self.intent_tags: list[str] = []

        self.step_results: list[StepResult] = []
        self.steps_executed: list[str] = []
        self.steps_skipped: list[str] = []
        self.checkpoint_log: list[CheckpointLogEntry] = []
        self.checkpoint_summaries: list[str] = []
        self.iteration: int = 0

        # Playbook switch tracking
        self.prior_playbook: Optional[Playbook] = None
        self.prior_playbook_results: list[StepResult] = []
        self.switch_log: list[dict] = []

        # Pending approval (Interactive Mode)
        self.pending_decision: Optional[ClaudeRoutingDecision] = None
        self.pending_event: Optional[asyncio.Event] = None
        self.dba_decision_result: Optional[dict] = None

        # Final analysis
        self.final_analysis: Optional[FinalAnalysis] = None

        # Timestamps
        self.created_at = datetime.utcnow()
        self.last_activity = datetime.utcnow()
        self.step_start_time: Optional[datetime] = None
        self.step_wait_start_time: Optional[datetime] = None
        self.step_timings: dict[str, dict] = {}

        # SSE event queue
        self.sse_queue: asyncio.Queue = asyncio.Queue()
        self.sse_tokens: set[str] = set()

    def touch(self):
        self.last_activity = datetime.utcnow()

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "dba_uid": self.dba_uid,
            "server_name": self.server_name,
            "ticket_number": self.ticket_number,
            "question": self.question,
            "mode": self.mode,
            "dbms": self.dbms,
            "playbook_id": self.playbook.id if self.playbook else None,
            "use_mock_data": self.use_mock_data,
            "state": self.state,
            "intent_category": self.intent_category,
            "time_reference": self.time_reference,
            "intent_tags": self.intent_tags,
            "step_results": [r.model_dump(mode='json') for r in self.step_results],
            "steps_executed": self.steps_executed,
            "steps_skipped": self.steps_skipped,
            "checkpoint_log": [r.model_dump(mode='json') for r in self.checkpoint_log],
            "checkpoint_summaries": self.checkpoint_summaries,
            "iteration": self.iteration,
            "switch_log": self.switch_log,
            "final_analysis": self.final_analysis.model_dump(mode='json') if self.final_analysis else None,
            "created_at": self.created_at.isoformat(),
            "last_activity": self.last_activity.isoformat()
        }

    @classmethod
    def from_dict(cls, data: dict, playbook: Playbook) -> "SessionData":
        # Create a new instance without calling __init__ fully, or just call it with dummy and overwrite
        obj = cls(
            session_id=data["session_id"],
            dba_uid=data.get("dba_uid", "local-dev"),
            server_name=data["server_name"],
            ticket_number=data["ticket_number"],
            question=data["question"],
            mode=data["mode"],
            dbms=data["dbms"],
            playbook=playbook,
            use_mock_data=data.get("use_mock_data", True),
        )
        obj.state = data.get("state", "INIT")
        obj.intent_category = data.get("intent_category")
        obj.time_reference = data.get("time_reference")
        obj.intent_tags = data.get("intent_tags", [])
        obj.steps_executed = data.get("steps_executed", [])
        obj.steps_skipped = data.get("steps_skipped", [])
        obj.checkpoint_summaries = data.get("checkpoint_summaries", [])
        obj.iteration = data.get("iteration", 0)
        obj.switch_log = data.get("switch_log", [])
        
        # Load Pydantic models back
        if data.get("step_results"):
            obj.step_results = [StepResult.model_validate(r) for r in data["step_results"]]
        if data.get("checkpoint_log"):
            obj.checkpoint_log = [CheckpointLogEntry.model_validate(r) for r in data["checkpoint_log"]]
        if data.get("final_analysis"):
            obj.final_analysis = FinalAnalysis.model_validate(data["final_analysis"])
            
        if data.get("created_at"):
            obj.created_at = datetime.fromisoformat(data["created_at"])
        if data.get("last_activity"):
            obj.last_activity = datetime.fromisoformat(data["last_activity"])
            
        return obj

    def switch_playbook(self, new_playbook: Playbook, trigger: str = "claude"):
        """Carry forward results with context boundary marker."""
        self.prior_playbook = self.playbook
        self.prior_playbook_results = list(self.step_results)
        self.switch_log.append({
            "from_playbook": self.playbook.id,
            "to_playbook": new_playbook.id,
            "trigger": trigger,
            "checkpoint_iteration": self.iteration,
            "timestamp": datetime.utcnow().isoformat(),
        })
        self.playbook = new_playbook
        # Don't reset step_results — they carry forward
        logger.info(
            f"Session {self.session_id}: switched playbook "
            f"{self.prior_playbook.id} → {new_playbook.id}"
        )

    def count_dba_overrides(self) -> int:
        return sum(
            1 for entry in self.checkpoint_log
            if entry.dba_decision and entry.dba_decision != "approved"
        )


class SessionStore:
    """Thread-safe in-memory store for active sessions, with local persistence."""

    def __init__(self):
        self._sessions: dict[str, SessionData] = {}
        self._lock = asyncio.Lock()
        
        # Local persistence
        self.data_dir = Path(".data")
        self.data_dir.mkdir(exist_ok=True)
        self.db_file = self.data_dir / "sessions.json"
        
        # In Cloud Run, we would initialize Firestore here
        self.use_firestore = os.environ.get("USE_FIRESTORE", "false").lower() == "true"
        if self.use_firestore:
            from google.cloud import firestore
            self.db = firestore.AsyncClient()

    async def create(self, session: SessionData) -> None:
        async with self._lock:
            self._sessions[session.session_id] = session

    async def get(self, session_id: str) -> Optional[SessionData]:
        # Check memory first
        if session_id in self._sessions:
            return self._sessions[session_id]
            
        # Try to load from persistence
        return await self._load_from_persistence(session_id)
        
    async def _load_from_persistence(self, session_id: str) -> Optional[SessionData]:
        if self.use_firestore:
            doc = await self.db.collection("sessions").document(session_id).get()
            if doc.exists:
                data = doc.to_dict()
            else:
                return None
        else:
            if not self.db_file.exists():
                return None
            try:
                with open(self.db_file, "r", encoding="utf-8") as f:
                    all_data = json.load(f)
                data = all_data.get(session_id)
            except Exception as e:
                logger.error(f"Error reading local session db: {e}")
                return None
                
        if not data:
            return None
            
        # Reconstruct SessionData
        # Need playbook service to resolve the playbook
        from app.services.playbook_service import PlaybookService
        playbook_svc = PlaybookService()
        pb = await playbook_svc.get_playbook(data["playbook_id"])
        
        session = SessionData.from_dict(data, pb)
        # We don't necessarily put it back in memory (it's inactive), but returning it allows reading
        return session
        
    async def persist(self, session: SessionData) -> None:
        """Persist a session to disk/Firestore (e.g. when completed)."""
        data = session.to_dict()
        if self.use_firestore:
            await self.db.collection("sessions").document(session.session_id).set(data)
        else:
            async with self._lock:
                all_data = {}
                if self.db_file.exists():
                    try:
                        with open(self.db_file, "r", encoding="utf-8") as f:
                            all_data = json.load(f)
                    except:
                        pass
                all_data[session.session_id] = data
                with open(self.db_file, "w", encoding="utf-8") as f:
                    json.dump(all_data, f, indent=2)

    async def delete(self, session_id: str) -> None:
        async with self._lock:
            self._sessions.pop(session_id, None)

    async def list_active(self) -> list[str]:
        return list(self._sessions.keys())
        
    async def list_all_persisted(self) -> list[dict]:
        """Return raw dictionaries for analytics and history."""
        if self.use_firestore:
            docs = self.db.collection("sessions").stream()
            return [doc.to_dict() async for doc in docs]
        else:
            if not self.db_file.exists():
                return []
            try:
                with open(self.db_file, "r", encoding="utf-8") as f:
                    all_data = json.load(f)
                return list(all_data.values())
            except Exception:
                return []

    async def cleanup_stale(self, max_age_minutes: int = 60) -> int:
        """Remove sessions older than max_age_minutes from memory (they should be persisted)."""
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(minutes=max_age_minutes)
        stale = [
            sid for sid, s in self._sessions.items()
            if s.last_activity < cutoff
        ]
        async with self._lock:
            for sid in stale:
                del self._sessions[sid]
        if stale:
            logger.info(f"Cleaned up {len(stale)} stale sessions")
        return len(stale)


# Global singleton
session_store = SessionStore()
