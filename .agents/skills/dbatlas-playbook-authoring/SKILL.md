---
name: dbatlas-playbook-authoring
description: Authoring, editing, and extending DBAtlas diagnostic playbook JSON graphs, writing mock data JSON results, setting up intent tags, narrative hints, and interactive next-step routing suggestions.
---

# DBAtlas Playbook Authoring Workflow

Use this skill when creating or editing playbooks, adding or changing diagnostic steps, writing or fixing mock data results, building demo scenarios, or troubleshooting why a step is loading fallback data.

---

## 1. Core Principles & Architecture
* **Claude is a Router, Not a Generator**: Claude receives the output of pre-authored DBA scripts and decides where to go next in a fixed graph. **Never** write logic that lets Claude generate raw SQL queries or invent steps at runtime.
* **Agreement**: A working playbook requires:
  1. A **playbook JSON** at `backend/playbooks/<playbook-id>.json`.
  2. **Mock data JSON files** named `<step_id>.default.json` in a derived directory.

---

## 2. Playbook and Step Schemas
Playbooks are defined as JSON graphs. A typical playbook has intent tags for auto-classification, entry steps, and individual step definitions.
Refer to [templates.md](file:///c:/Users/tapbe/.gemini/projects/DBAtlas/.agents/skills/dbatlas-playbook-authoring/references/templates.md) for copy-pasteable playbook and mock data starter files.

### Step Schema Requirements:
* `step_id` must match the key in the JSON, and the filename stem.
* `interactive_hints` **must** contain an entry for every step listed in `typical_next`, plus a `stop` entry. This represents the instructions shown to the DBA in Interactive Mode.
* `mock_data_key` is informational for humans. The system loader ignores it and derives the path using the playbook ID (see Section 3).

---

## 3. Mock Data Path Rules (CRITICAL)

### The Folder Derivation Rule
The mock data loader does NOT use the `mock_data_key` field. It derives the folder from the
playbook ID using this exact formula:
```python
intent_slug = playbook_id.replace(f"{dbms}-", "").replace("-", "_")

dir_map = {
    "live_slowness_triage": "live_slowness",
    "top_consumers":        "top_consumers",
    "historical_awr":       "historical",
    "live_slowness":        "live_slowness",
}
dir_name = dir_map.get(intent_slug, intent_slug.replace("_triage", ""))
# Final path: backend/mock_data/{dbms}/{dir_name}/
```

#### Quick Lookup Table:
* `sqlserver-live-slowness-triage` ➔ `mock_data/sqlserver/live_slowness/`
* `sqlserver-deadlock-analysis` ➔ `mock_data/sqlserver/deadlock_analysis/`
* `sqlserver-stale-statistics` ➔ `mock_data/sqlserver/stale_statistics/`
* `oracle-historical-awr` ➔ `mock_data/oracle/historical/`
* `postgresql-top-consumers` ➔ `mock_data/postgresql/top_consumers/`
* `mongodb-live-ops` ➔ `mock_data/mongodb/live_ops/`

### The Filename Rule
Mock files must be named `<step_id>.default.json`. Files named `<step_id>.json` will load only as secondary fallbacks, and scenario-specific files (e.g. `.scenario-a.json`) will be ignored.

---

## 4. Verification Snippet
Always run this script from the `backend/` directory after editing or creating playbooks to verify that files load correctly instead of silently serving synthetic fallback data:

```python
import asyncio
from app.services.mock_data_service import MockDataService

svc = MockDataService()

async def verify(playbook_id, dbms, step_ids):
    for sid in step_ids:
        r, hint = await svc.get_step_result(dbms=dbms, playbook_id=playbook_id, step_id=sid)
        ok = r.row_count > 0 and "synthetic" not in (hint or "").lower()
        print(("OK  " if ok else "FAIL") + f" {sid}: {r.row_count} rows")

# Example validation call
asyncio.run(verify("sqlserver-live-slowness-triage", "sqlserver", 
                   ["active_requests", "blocking_chains", "grafana_os_telemetry", "splunk_app_logs"]))
```

---

## 5. Cross-Wiring & DBMS Detection
* **Cross-Wiring**: Add the target playbook to `alternate_playbooks` and add a `switch_to_<playbook-id>` instruction inside `interactive_hints`.
* **DBMS Auto-Detection**:
  * Prefix `SQL`/`MSSQL`/`SQLPROD`/`SQLDR` ➔ `sqlserver`
  * Prefix `PG`/`POSTGRES` ➔ `postgresql`
  * Prefix `MG`/`MONGO` ➔ `mongodb`
  * Prefix `ORA`/`PRODDB` ➔ `oracle` (also default fallback)

---

## 6. Narrative Hints & Templates
* Refer to [narrative_hints.md](file:///c:/Users/tapbe/.gemini/projects/DBAtlas/.agents/skills/dbatlas-playbook-authoring/references/narrative_hints.md) for guide on writing diagnostic stories.
* Refer to [templates.md](file:///c:/Users/tapbe/.gemini/projects/DBAtlas/.agents/skills/dbatlas-playbook-authoring/references/templates.md) for copy-pasteable JSON outlines.
