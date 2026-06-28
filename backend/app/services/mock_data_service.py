"""
Mock Data Service
-----------------
Loads pre-crafted JSON files that simulate DBMS diagnostic query results.
In local dev mode, files are read from the local mock_data/ directory.
In GCP mode, files are read from GCS.

Each JSON file follows this schema:
  scenario_id, dbms, playbook_id, step_id, simulated_at,
  columns, rows, row_count, narrative_hint
"""
import json
import os
import logging
from pathlib import Path
from typing import Optional
from app.models.schemas import StepResult

logger = logging.getLogger(__name__)

# Local mock data directory — relative to the backend root
MOCK_DATA_DIR = Path(__file__).parent.parent.parent / "mock_data"


class MockDataService:
    def __init__(self, use_gcs: bool = False, bucket_name: str = ""):
        self.use_gcs = use_gcs
        self.bucket_name = bucket_name
        self._cache: dict[str, dict] = {}

    async def get_step_result(
        self,
        dbms: str,
        playbook_id: str,
        step_id: str,
        scenario: str = "default",
        max_rows: int = 50,
    ) -> tuple[StepResult, Optional[str]]:
        """
        Returns (StepResult, narrative_hint).
        narrative_hint is None in production — only present in mock data.
        """
        key = f"{dbms}/{playbook_id}/{step_id}/{scenario}"

        if key not in self._cache:
            data = await self._load(dbms, playbook_id, step_id, scenario)
            self._cache[key] = data

        raw = self._cache[key]
        columns = raw.get("columns", [])
        all_rows = raw.get("rows", [])
        row_count = raw.get("row_count", len(all_rows))
        narrative_hint = raw.get("narrative_hint")

        truncated = len(all_rows) > max_rows
        rows = all_rows[:max_rows]

        result = StepResult(
            step_id=step_id,
            step_description=raw.get("step_description", step_id),
            columns=columns,
            rows=rows,
            row_count=row_count,
            truncated=truncated,
        )
        return result, narrative_hint

    async def _load(
        self, dbms: str, playbook_id: str, step_id: str, scenario: str
    ) -> dict:
        """Load from local filesystem (local dev) or GCS (production)."""
        if self.use_gcs:
            return await self._load_from_gcs(dbms, playbook_id, step_id, scenario)
        return self._load_from_local(dbms, playbook_id, step_id, scenario)

    def _load_from_local(
        self, dbms: str, playbook_id: str, step_id: str, scenario: str
    ) -> dict:
        """
        Tries paths in order:
          mock_data/{dbms}/{intent_slug}/{step_id}.{scenario}.json
          mock_data/{dbms}/{intent_slug}/{step_id}.default.json
          mock_data/{dbms}/{intent_slug}/{step_id}.json
        Falls back to a synthetic result if no file found.
        """
        intent_slug = playbook_id.replace(f"{dbms}-", "").replace("-", "_")
        # Map playbook IDs to directory names
        dir_map = {
            "live_slowness_triage": "live_slowness",
            "top_consumers": "top_consumers",
            "historical_awr": "historical",
            "live_slowness": "live_slowness",
        }
        dir_name = dir_map.get(intent_slug, intent_slug.replace("_triage", "").replace("_", "_"))

        base_dir = MOCK_DATA_DIR / dbms / dir_name

        candidates = [
            base_dir / f"{step_id}.{scenario}.json",
            base_dir / f"{step_id}.default.json",
            base_dir / f"{step_id}.json",
        ]

        for path in candidates:
            if path.exists():
                logger.info(f"Loading mock data: {path}")
                with open(path, "r") as f:
                    return json.load(f)

        logger.warning(f"No mock data found for {dbms}/{playbook_id}/{step_id} — using synthetic fallback")
        return self._synthetic_fallback(dbms, step_id)

    async def _load_from_gcs(
        self, dbms: str, playbook_id: str, step_id: str, scenario: str
    ) -> dict:
        from google.cloud import storage
        client = storage.Client()
        bucket = client.bucket(self.bucket_name)
        blob_path = f"mock-results/{dbms}/{playbook_id}/{step_id}.{scenario}.json"
        blob = bucket.blob(blob_path)
        content = blob.download_as_text()
        return json.loads(content)

    def _synthetic_fallback(self, dbms: str, step_id: str) -> dict:
        """Returns a minimal synthetic result when no mock file exists."""
        return {
            "scenario_id": "synthetic",
            "dbms": dbms,
            "step_id": step_id,
            "step_description": step_id.replace("_", " ").title(),
            "simulated_at": "2026-06-22T18:00:00Z",
            "columns": ["metric", "value"],
            "rows": [
                ["status", "mock data file not found — add file to mock_data/ directory"],
            ],
            "row_count": 1,
            "narrative_hint": f"No mock data file found for {step_id}. This is a synthetic fallback result.",
        }
