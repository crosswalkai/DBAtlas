# DBAtlas — Backend Features & Enhancements

This file documents the existing backend capabilities, routing safety parameters, and serves as a log for enhancement requests.

---

## 1. Completed Backend Features

### Checkpoint Loop State Machine
- **Location**: `backend/app/services/checkpoint_loop.py`
- **Details**: Implements the state transitions: `INIT` -> `CLASSIFYING` -> `EXECUTING` -> `EVALUATING` -> `PENDING_APPROVAL` (or loops to `EXECUTING`) -> `ANALYZING` -> `COMPLETE`.
- **SSE Stream**: Emitters push events (`step_start`, `step_complete`, `pending_approval`, `stream_end`) to client.

### Playbook Service
- **Location**: `backend/app/services/playbook_service.py`
- **Details**: Loads JSON graphs from `playbooks/`. Performs whitelist routing validation.

### Mock Data Service
- **Location**: `backend/app/services/mock_data_service.py`
- **Details**: Resolves key to `<dbms>/<folder>/<step_id>.default.json`. Provides a synthetic fallback if file is missing.

### DBMS Auto-Detection
- **Location**: Heuristic mapping based on server prefix:
  - `ORA` / `PRODDB` -> `oracle`
  - `SQL` / `SQLPROD` / `SQLDR` / `MSSQL` -> `sqlserver`
  - `PG` / `POSTGRES` -> `postgresql`
  - `MG` / `MONGO` -> `mongodb`
  - Fallback -> `oracle`

### Claude Client Integration
- **Location**: `backend/app/services/claude_client.py`
- **Details**: Performs 3 distinct prompt requests: intent classification, checkpoint evaluation, and final summary report generation.

---

## 2. Safety & Whitelist Constraints

- **Claude is a Router**: Claude receives the output of pre-authored scripts and returns the ID of the next node. Claude is mathematically and structurally prohibited from writing or editing SQL.
- **Whitelist Enforcement**: The backend validates every proposed state transition against the playbook step graph or alternate playbooks list. Unregistered transitions are blocked.

---

## 3. Future Enhancement Requests

*Add new backend enhancement requests in this section:*

- [ ] **BE-001**: Implement real database connectivity driver layer for PostgreSQL (`psycopg2`) to run live queries when `USE_MOCK_DATA=false`.
- [ ] **BE-002**: Save finished sessions into a local SQLite database or Firestore collection for persistent history.
- [ ] **BE-003**: Add health check monitor endpoint and alert notifications on continuous execution errors.
