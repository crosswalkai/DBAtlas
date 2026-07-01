"""
Playbook Service
----------------
Loads playbook graph definitions.
Local dev: reads from playbooks/ directory as JSON files.
Production: reads from Firestore.
"""
import json
import logging
from pathlib import Path
from typing import Optional
from app.models.schemas import Playbook, PlaybookStep, IntentCategory, DbmsType

logger = logging.getLogger(__name__)

PLAYBOOKS_DIR = Path(__file__).parent.parent.parent / "playbooks"


class PlaybookService:
    def __init__(self, use_firestore: bool = False, project_id: str = ""):
        self.use_firestore = use_firestore
        self.project_id = project_id
        self._cache: dict[str, Playbook] = {}

    async def get_playbook(self, playbook_id: str) -> Optional[Playbook]:
        if playbook_id in self._cache:
            return self._cache[playbook_id]

        playbook = await self._load(playbook_id)
        if playbook:
            self._cache[playbook_id] = playbook
        return playbook

    async def find_best_playbook(
        self,
        dbms: DbmsType,
        intent_category: IntentCategory,
        intent_tags: list[str],
        recommended_playbook_id: Optional[str] = None,
    ) -> Optional[Playbook]:
        """Find highest-scoring playbook for the given intent."""
        all_playbooks = await self.list_playbooks(dbms=dbms, intent_category=intent_category)
        if not all_playbooks:
            return None

        if recommended_playbook_id:
            for pb in all_playbooks:
                if pb.id == recommended_playbook_id:
                    return pb

        # Score by tag overlap
        scored = []
        for pb in all_playbooks:
            score = len(set(pb.intent_tags) & set(intent_tags))
            scored.append((score, pb))

        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1] if scored else all_playbooks[0]

    async def list_playbooks(
        self,
        dbms: Optional[DbmsType] = None,
        intent_category: Optional[IntentCategory] = None,
    ) -> list[Playbook]:
        all_pbs = await self._load_all()
        result = all_pbs
        if dbms:
            result = [pb for pb in result if pb.dbms == dbms]
        if intent_category:
            result = [pb for pb in result if pb.intent_category == intent_category]
        return result

    async def validate_step_exists(
        self, playbook_id: str, step_id: str
    ) -> bool:
        pb = await self.get_playbook(playbook_id)
        if not pb:
            return False
        return step_id in pb.steps

    async def validate_alternate_playbook(
        self, current_playbook_id: str, target_playbook_id: str
    ) -> bool:
        pb = await self.get_playbook(current_playbook_id)
        if not pb:
            return False
        return target_playbook_id in pb.alternate_playbooks

    async def _load(self, playbook_id: str) -> Optional[Playbook]:
        if self.use_firestore:
            return await self._load_from_firestore(playbook_id)
        return self._load_from_local(playbook_id)

    async def _load_all(self) -> list[Playbook]:
        if self.use_firestore:
            return await self._load_all_from_firestore()
        return self._load_all_from_local()

    def _load_from_local(self, playbook_id: str) -> Optional[Playbook]:
        path = PLAYBOOKS_DIR / f"{playbook_id}.json"
        if not path.exists():
            logger.warning(f"Playbook file not found: {path}")
            return None
        with open(path, "r") as f:
            data = json.load(f)
        return self._parse_playbook(data)

    def _load_all_from_local(self) -> list[Playbook]:
        playbooks = []
        if not PLAYBOOKS_DIR.exists():
            return playbooks
        for path in PLAYBOOKS_DIR.glob("*.json"):
            with open(path, "r") as f:
                data = json.load(f)
            try:
                playbooks.append(self._parse_playbook(data))
            except Exception as e:
                logger.error(f"Failed to parse playbook {path}: {e}")
        return playbooks

    def _parse_playbook(self, data: dict) -> Playbook:
        steps = {}
        for step_id, step_data in data.get("steps", {}).items():
            steps[step_id] = PlaybookStep(**step_data)
        return Playbook(
            id=data["id"],
            dbms=data["dbms"],
            intent_category=data["intent_category"],
            intent_tags=data.get("intent_tags", []),
            title=data["title"],
            description=data["description"],
            entry_step=data["entry_step"],
            alternate_playbooks=data.get("alternate_playbooks", []),
            steps=steps,
            max_steps=data.get("max_steps", 5),
            version=data.get("version", 1),
            author=data.get("author", "Senior DBA"),
        )

    async def _load_from_firestore(self, playbook_id: str) -> Optional[Playbook]:
        from google.cloud import firestore
        db = firestore.AsyncClient(project=self.project_id)
        doc = await db.collection("playbooks").document(playbook_id).get()
        if not doc.exists:
            return None
        return self._parse_playbook(doc.to_dict())

    async def _load_all_from_firestore(self) -> list[Playbook]:
        from google.cloud import firestore
        db = firestore.AsyncClient(project=self.project_id)
        docs = db.collection("playbooks").stream()
        playbooks = []
        async for doc in docs:
            try:
                playbooks.append(self._parse_playbook(doc.to_dict()))
            except Exception as e:
                logger.error(f"Failed to parse Firestore playbook {doc.id}: {e}")
        return playbooks
