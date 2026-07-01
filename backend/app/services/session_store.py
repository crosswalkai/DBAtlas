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
from datetime import datetime
from typing import Optional
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
    """Thread-safe in-memory store for active sessions."""

    def __init__(self):
        self._sessions: dict[str, SessionData] = {}
        self._lock = asyncio.Lock()

    async def create(self, session: SessionData) -> None:
        async with self._lock:
            self._sessions[session.session_id] = session

    async def get(self, session_id: str) -> Optional[SessionData]:
        return self._sessions.get(session_id)

    async def delete(self, session_id: str) -> None:
        async with self._lock:
            self._sessions.pop(session_id, None)

    async def list_active(self) -> list[str]:
        return list(self._sessions.keys())

    async def cleanup_stale(self, max_age_minutes: int = 60) -> int:
        """Remove sessions older than max_age_minutes. Returns count removed."""
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
