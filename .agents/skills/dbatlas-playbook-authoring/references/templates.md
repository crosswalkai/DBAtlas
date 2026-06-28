# DBAtlas Playbook and Mock Data Templates

Copy these as starting points when authoring new DBAtlas playbooks. Replace the ALL-CAPS placeholders. Remember that the mock data folder name is **derived** from the playbook ID — it is not necessarily the `mock_data_key` string.

---

## 1. Playbook Template
Save as `backend/playbooks/<playbook-id>.json`:

```json
{
  "id": "DBMS-DESCRIPTOR",
  "dbms": "sqlserver",
  "intent_category": "historical_forensics",
  "intent_tags": ["WORD1", "WORD2", "WORD3", "the words a DBA would actually type"],
  "title": "Human-Readable Playbook Title",
  "description": "One sentence shown in the playbook selector.",
  "entry_step": "ENTRY_STEP_ID",
  "alternate_playbooks": [],
  "max_steps": 5,
  "version": 1,
  "author": "Author Name",
  "steps": {
    "ENTRY_STEP_ID": {
      "step_id": "ENTRY_STEP_ID",
      "description": "What this step examines.",
      "script_ref": "scripts/DBMS/ENTRY_STEP_ID.sql",
      "mock_data_key": "DBMS/DERIVED_FOLDER/ENTRY_STEP_ID.default.json",
      "parameters": [],
      "result_format": "tabular",
      "typical_next": ["SECOND_STEP_ID"],
      "interactive_hints": {
        "SECOND_STEP_ID": "When and why to run the second step.",
        "stop": "Stop here and generate the final analysis with results gathered so far"
      },
      "safe_to_run_first": true,
      "max_rows": 15
    },
    "SECOND_STEP_ID": {
      "step_id": "SECOND_STEP_ID",
      "description": "What this step examines.",
      "script_ref": "scripts/DBMS/SECOND_STEP_ID.sql",
      "mock_data_key": "DBMS/DERIVED_FOLDER/SECOND_STEP_ID.default.json",
      "parameters": [],
      "result_format": "tabular",
      "typical_next": [],
      "interactive_hints": {
        "stop": "Stop here and generate the final analysis with results gathered so far"
      },
      "safe_to_run_first": false,
      "max_rows": 20
    }
  }
}
```

---

## 2. Mock Data Template
Save as `backend/mock_data/<dbms>/<derived-folder>/<step_id>.default.json`:

```json
{
  "scenario_id": "default",
  "dbms": "sqlserver",
  "playbook_id": "DBMS-DESCRIPTOR",
  "step_id": "STEP_ID",
  "simulated_at": "2026-06-22T09:00:00Z",
  "columns": ["col_a", "col_b", "col_c"],
  "rows": [
    ["value_a1", "value_b1", "value_c1"],
    ["value_a2", "value_b2", "value_c2"]
  ],
  "row_count": 2,
  "narrative_hint": "Name the standout row, quantify the severity, anchor it to a plausible cause and time, connect the other rows into the theory, and point at the next step."
}
```
