# DBAtlas — Project Knowledge for Antigravity Agents

This file gives Antigravity's AI agents the context they need to work effectively on
the DBAtlas codebase. Read this before making changes.

---

## What DBAtlas Is

DBAtlas (Database Agentic Troubleshooting Advisor) is an AI-powered diagnostic tool
for Database Administrators. A DBA enters a server name, a ServiceNow ticket number,
and a natural-language question. The system runs pre-approved diagnostic scripts and
uses Claude to evaluate results at each checkpoint, navigating a playbook graph to
reach a root-cause diagnosis.

Product full name: "DBAtlas - DBA Copilot"
Subtitle: "Database Agentic Troubleshooting Advisor"

---

## THE SINGLE MOST IMPORTANT ARCHITECTURAL PRINCIPLE

**Claude is a ROUTER, not a GENERATOR.**

Claude never writes, generates, or modifies database queries. It only chooses which
pre-authored, senior-DBA-written script to run next from a fixed whitelist defined in
the playbook graph. This is both a safety boundary and a trust boundary for DBA
adoption. Any change that lets Claude generate SQL or invent steps violates the core
design and must be rejected.

The flow is:
1. FastAPI executes a pre-approved script (or loads its mock data)
2. Claude evaluates the result at a "checkpoint"
3. Claude returns a structured routing decision (continue / skip / switch / stop)
4. FastAPI validates that decision against the playbook whitelist
5. Repeat until stop or max_steps

---

## Tech Stack

- **Backend**: Python FastAPI + uvicorn, port 8000
- **Frontend**: React + TypeScript + Vite, port 5173
- **AI**: Anthropic Claude API (model string: claude-sonnet-4-6)
- **Local dev**: USE_AUTH=false, USE_MOCK_DATA=true
- **Deployment target**: GCP Cloud Run (production), with Firestore + GCS + Secret Manager
- **Dev environment**: Windows 11, project root C:\Users\tapbe\.claude\projects\DBAtlas

---

## Repository Layout

```
DBAtlas/
  backend/
    app/
      main.py                      FastAPI entry, CORS, lifespan, session cleanup
      api/routes.py                All endpoints incl. SSE stream + checkpoint decision
      core/config.py               Pydantic settings from .env
      models/schemas.py            All Pydantic models
      services/
        checkpoint_loop.py         CORE diagnostic engine — the state machine
        claude_client.py           All 3 Claude calls: classify, evaluate, analyze
        mock_data_service.py       Loads JSON mock results (local files / GCS)
        playbook_service.py        Loads playbook graphs (local files / Firestore)
        session_store.py           In-memory session state (Firestore in prod)
    playbooks/                     13 playbook JSON graph definitions
    mock_data/                     46 mock result JSON files
    requirements.txt, .env, start.ps1, start.bat
  frontend/
    src/
      App.tsx                      Main shell: topbar, sidebar nav, routing between views
      api/client.ts                Axios calls + SSE EventSource
      hooks/useSession.ts          Session state machine + SSE event handling
      types/index.ts               TypeScript types mirroring backend schemas
      components/
        InputForm.tsx              Server/ticket/question form + mode toggle
        CheckpointApprovalPanel.tsx  Interactive-mode approval UI
        CheckpointRail.tsx         Right-side vertical timeline of steps
        DiagnosticReport.tsx       Final analysis report
        SessionHistory.tsx         Past sessions list
        ui.tsx                     Shared primitives: Badge, Button, Card, Spinner
    public/                        DBAtlas SVG logo assets
    index.html, package.json, vite.config.ts
  frontend_features.md             List of completed/pending frontend enhancements and UI guidelines
  backend_features.md              List of completed/pending backend features and safety guidelines
  SPECIFICATION.md                 Comprehensive markdown system specification
```

---

## The 14 Playbooks

| ID | DBMS | Intent | Author |
|---|---|---|---|
| oracle-live-slowness-triage | oracle | live_triage | A. Siments |
| oracle-top-consumers | oracle | resource_profiling | A. Siments |
| oracle-historical-awr | oracle | historical_forensics | A. Siments |
| sqlserver-live-slowness-triage | sqlserver | live_triage | A. Pogaku |
| sqlserver-top-consumers | sqlserver | resource_profiling | A. Pogaku |
| sqlserver-plan-regression | sqlserver | historical_forensics | A. Pogaku |
| sqlserver-deadlock-analysis | sqlserver | historical_forensics | J. Smith |
| sqlserver-ag-replica-lag | sqlserver | live_triage | J. Smith |
| sqlserver-stale-statistics | sqlserver | historical_forensics | Q. Miller |
| sqlserver-wait-stats-deviation | sqlserver | historical_forensics | Q. Miller |
| sqlserver-sleeping-sessions | sqlserver | live_triage | Antigravity |
| postgresql-live-slowness-triage | postgresql | live_triage | A. Sharma |
| postgresql-top-consumers | postgresql | resource_profiling | A. Sharma |
| mongodb-live-ops | mongodb | live_triage | A. Sharma |

`sqlserver-plan-regression` and `sqlserver-stale-statistics` are cross-wired: each lists
the other in `alternate_playbooks` and has `switch_to_<playbook>` hints in interactive_hints
so a DBA can pivot mid-session.


---

## Playbook JSON Schema

```json
{
  "id": "sqlserver-plan-regression",
  "dbms": "sqlserver",
  "intent_category": "historical_forensics",
  "intent_tags": ["plan", "regression", "slow", "suddenly", ...],
  "title": "SQL Server Query Plan Regression",
  "description": "...",
  "entry_step": "qs_regressed_queries",
  "alternate_playbooks": ["sqlserver-stale-statistics"],
  "max_steps": 5,
  "version": 2,
  "author": "A. Pogaku",
  "steps": {
    "qs_regressed_queries": {
      "step_id": "qs_regressed_queries",
      "description": "...",
      "script_ref": "scripts/sqlserver/qs_regressed_queries.sql",
      "mock_data_key": "sqlserver/plan_regression/qs_regressed_queries.default.json",
      "parameters": [],
      "result_format": "tabular",
      "typical_next": ["qs_plan_comparison"],
      "interactive_hints": {
        "qs_plan_comparison": "Run to see the before/after plans...",
        "switch_to_sqlserver-stale-statistics": "Switch to...",
        "stop": "Stop here and generate the final analysis"
      },
      "safe_to_run_first": true,
      "max_rows": 15
    }
  }
}
```

---

## Mock Data Conventions (CRITICAL)

- File naming MUST be `<step_id>.default.json` — the checkpoint loop calls
  `get_step_result` with `scenario='default'`. Files named `.scenario-a.json` will NOT
  be found and produce a synthetic fallback error.
- Directory layout: `mock_data/<dbms>/<folder>/<step_id>.default.json`
- The mock data service resolves the key as `<dbms>/<step_id>` (last path segment).
- Each mock file has: `step_id, step_description, columns, rows, row_count, narrative_hint`
- **narrative_hint** is the most important authoring field — it is injected into Claude's
  checkpoint prompt as `[DEMO CONTEXT]` and guides the diagnostic reasoning. The quality
  of narrative_hint directly determines how impressive the demo is. Write it as expert
  DBA analysis pointing at the root cause.

---

## DBMS Auto-Detection

Server name prefix determines the DBMS (in `checkpoint_loop.py::_detect_dbms` and mirrored
in the frontend):
- ORA / PRODDB -> oracle
- SQL / SQLPROD / SQLDR / MSSQL -> sqlserver
- PG / POSTGRES -> postgresql
- MG / MONGO -> mongodb
- fallback -> oracle

---

## The 5 SQL Server Demo Scenarios

- SS-1 Plan Regression: "this query suddenly got slow after last night's maintenance" -> SQLPROD-02
- SS-2 Deadlock: "we are getting deadlocks on the Orders table" -> SQLPROD-02
- SS-3 AG Replica Lag: "the DR replica is falling behind and RPO SLA may be breached" -> SQLDR-01
- SS-5 Stale Statistics: "queries have bad row estimates" -> SQLPROD-02
- SS-7 Wait Stats Deviation: "server feels slow this Monday morning, no obvious cause" -> SQLPROD-02

---

## Branding & UI Conventions

- App name: DBAtlas (never "DbAxis" — that was an old name, fully removed)
- Logo assets in frontend/public/: DBAtlas-horizontal.svg, DBAtlas-mark.svg,
  favicon.svg, DBAtlas-app-icon.svg
- Operating mode active toggle: light orange bg #FFF0E6, text #C2540A, border #F9C4A0
- Run diagnostic button: light grey bg #F3F4F6, text #C2540A
- Auto mode hover tooltip: "I'm feeling lucky!" / Interactive: "I'm in charge!"
- Left sidebar nav holds Diagnostic + History tabs and the "Mock data in use" indicator
- Topbar right side: Help button (slide-in overlay) and Log out button (faded login screen)
- Accent blue #2563EB, mono font JetBrains Mono for all DB identifiers/step IDs

---

## Common Tasks & How To Do Them

**Add a new playbook**: create `backend/playbooks/<id>.json` following the schema, create
matching mock data files under `backend/mock_data/<dbms>/<folder>/<step_id>.default.json`
with strong narrative_hints. No restart needed — playbooks load on demand.

**Add a demo scenario**: usually just new mock data + possibly a new playbook. Make the
narrative_hint tell a clear root-cause story.

**Change the checkpoint loop logic**: edit `backend/app/services/checkpoint_loop.py`.
This is the heart of the system — be careful with the state machine and the
validation-against-whitelist step.

**Change Claude prompts**: edit `backend/app/services/claude_client.py`. There are 3
methods: classify_intent, evaluate_checkpoint, generate_analysis.

**UI changes**: frontend is plain React with inline styles (no CSS framework beyond the
design tokens in index.css). Vite hot-reloads on save.

**Update the specification**: edit the Markdown documentation in [SPECIFICATION.md](file:///c:/Users/tapbe/.gemini/projects/DBAtlas/SPECIFICATION.md). You must update this file whenever playbooks, backend API routes, database schemas, or frontend components are added or modified.

---

## Windows Environment Gotchas (learned the hard way)

- PowerShell execution policy blocks scripts — use `Unblock-File` or run uvicorn directly
- `.env` sometimes saves as `.env.txt` — verify the real filename
- `pydantic-settings` is a separate pip package from pydantic — must be installed
- Files must be in the correct nested folder structure, not flat
- Use the venv: `.\venv\Scripts\Activate.ps1` before running uvicorn

---

## What NOT To Do

- Do NOT let Claude generate SQL or invent diagnostic steps. Router, not generator.
- Do NOT rename mock data files away from the `.default.json` convention.
- Do NOT reintroduce the name "DbAxis".
- Do NOT add a CSS framework — the app uses inline styles + CSS variables by design.
- Do NOT move the project folder after building up Antigravity Knowledge Items
  (Antigravity may silently lose context on directory moves).
- Do NOT commit the real ANTHROPIC_API_KEY — it lives in backend/.env which is gitignored.
- Do NOT let [SPECIFICATION.md](file:///c:/Users/tapbe/.gemini/projects/DBAtlas/SPECIFICATION.md) drift out of date when playbooks or architectural changes are introduced.

