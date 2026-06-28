**DBA Copilot**

Database Agentic Troubleshooting Advisor

**PRODUCT SPECIFICATION**

*AI-Guided Database Diagnostics with Human-in-the-Loop Control*


| --- | --- | --- | --- | --- |
| Field | Value |
| Document Version | 1.0 |
| Status | For Management Review — Accompanies Live Demo |
| Date | June 2026 |
| Audience | Engineering Leadership, Platform Team, Senior DBAs |
| Classification | Confidential — Internal Use Only |


# Executive Summary

Database Administrators in large organizations manage performance incidents across multiple database platforms simultaneously. DBAtlas provides a single, natural-language-driven interface where a DBA enters a target server, a ServiceNow reference number, and a diagnostic question, and receives a structured, AI-narrated analysis driven by curated senior-DBA playbooks.

The system uses a checkpoint loop: the backend executes pre-approved diagnostic scripts, an AI engine evaluates the results at each checkpoint and navigates a playbook graph intelligently, and the backend enforces a strict script whitelist at every step boundary. The AI never generates or modifies database queries — it only chooses which senior-DBA-authored script to run next.

DBAtlas offers two operating modes. In Auto Mode, the checkpoint loop runs unattended and delivers a complete report. In Interactive Mode, the loop pauses after each checkpoint and presents the AI’s proposed next step to the DBA for approval; the DBA may approve, redirect to a different step, switch playbooks, or stop the session. Every DBA decision is captured in the session log. Interactive Mode is the default for the demo, making the AI’s reasoning visible in real time and demonstrating that a human remains in control of every diagnostic action.

The prototype runs on a FastAPI backend and a React frontend, using the Anthropic Claude API and mock data that simulates real diagnostic output. It is deployable to Google Cloud Platform via Cloud Run, and is also available as a self-contained browser version for frictionless sharing.

# Contents

# 1. Problem Statement

## 1.1 Current State Pain Points


| --- | --- | --- | --- | --- |
| Pain Point | Impact |
| Tool sprawl across DBMS platforms | Context switching slows incident triage; DBAs maintain proficiency in 3-5 separate tools |
| Institutional knowledge locked in senior DBAs | Junior DBAs blocked on escalations; senior time wasted on repeatable diagnostics |
| No unified incident tracking linkage | Diagnostic sessions not tied to tickets; audit trail is manual and incomplete |
| Playbooks run in full regardless of findings | Expensive scripts execute even when early steps already identify the root cause |
| No human oversight of agentic diagnostic tools | DBAs cannot trust AI decisions without visibility into the reasoning chain |
| Routing hints degrade without feedback | Step hints become stale as environments evolve; no mechanism to capture expert corrections |


## 1.2 Scope

Designed for a DBA organization of 400+ engineers supporting Oracle, SQL Server, PostgreSQL, and MongoDB. DBAs operate within their domain specialty. The tool augments individual DBA workflows per incident; it is not a cross-platform analytics platform.

# 2. Product Overview

For a detailed breakdown of existing capabilities and active/planned enhancements, see:
- [Frontend Features & Enhancement Requests](file:///c:/Users/tapbe/.gemini/projects/DBAtlas/frontend_features.md)
- [Backend Features & Enhancement Requests](file:///c:/Users/tapbe/.gemini/projects/DBAtlas/backend_features.md)

## 2.1 Core Concept

DBAtlas is a single-page web application. The DBA provides three inputs, selects a mode, and receives a structured diagnostic report.


| --- | --- | --- | --- | --- |
| Input | Field | Notes |
| Target Server | Server Name | DBMS type auto-detected from the server name |
| Audit Reference | ServiceNow Ticket Number | Stored in the session log for audit linkage |
| Diagnostic Query | Natural Language Question | Drives intent classification and playbook selection |
| Operating Mode | Auto / Interactive Toggle | Default: Interactive |


## 2.2 Operating Modes


| --- | --- | --- | --- | --- |
| Attribute | Auto Mode | Interactive Mode |
| Loop behavior | Runs unattended to completion | Pauses after each checkpoint for DBA decision |
| DBA involvement | Reviews final report only | Reviews and approves each step |
| AI role | Navigator and analyst | Advisor — DBA has final routing authority |
| Override capability | None during execution | Approve, redirect, switch playbook, or stop |
| Best for | Routine triage, junior DBAs | High-stakes incidents, senior DBAs, demos |


## 2.3 Supported Intent Categories


| --- | --- | --- | --- | --- |
| Intent Category | Example Questions | Time Scope |
| Live Triage | What is slowing this server right now? | Current moment |
| Resource Profiling | Who are the top 5 resource consumers? | Last 15-60 minutes |
| Historical Forensics | What happened at 6PM yesterday? | User-specified window |


## 2.4 Supported DBMS Platforms


| --- | --- | --- | --- | --- |
| Platform | Detection Prefix | Coverage |
| Oracle | ORA, PRODDB | Live triage, resource profiling, historical AWR |
| SQL Server | SQL, SQLPROD, SQLDR, MSSQL | Live triage, resource profiling, plan regression, deadlock, AG lag, stale stats, wait stats |
| PostgreSQL | PG, POSTGRES | Live triage, resource profiling |
| MongoDB | MG, MONGO | Live operations triage |


# 3. System Architecture

The backend is the script executor and safety enforcer. The AI engine is the intelligent checkpoint navigator. The AI never generates or modifies database queries. This separation is the foundation of the system’s safety and trust model.

## 3.1 Role Definitions


| --- | --- | --- | --- | --- |
| Component | Role | Does NOT Do |
| Backend (FastAPI) | Script executor, safety enforcer, checkpoint state machine, SSE emitter | Does not decide which script to run next |
| AI Engine (Claude) | Intent classifier, checkpoint reviewer, playbook navigator, final analyst | Does not generate, modify, or execute any database query |
| DBA (Interactive) | Final routing authority at each checkpoint | Does not execute scripts directly — all execution goes through the whitelist |
| Playbook Registry | Authoritative source of all approved scripts and graph definitions | Does not change at runtime |
| Mock Data Layer | Simulates diagnostic output for the demo | Replaced by real connections later; architecture unchanged |
| Session Log | Full checkpoint trace including DBA decisions | Does not store raw result data beyond the log entry |


## 3.2 Component Map


| --- | --- | --- | --- | --- |
| Component | Technology | Responsibility |
| Frontend | React + TypeScript + Vite | Input form, mode toggle, approval UI, report renderer, session history |
| Backend API | Python FastAPI | Validation, checkpoint state machine, whitelist enforcement, SSE, AI calls |
| Playbook Registry | JSON graphs (Firestore in production) | Playbook definitions, step scripts, routing hints |
| Mock Data Layer | JSON files (Cloud Storage in production) | Simulated diagnostic output per step |
| AI Engine | Anthropic Claude API (claude-sonnet-4-6) | Classification, checkpoint evaluation, final analysis |
| Transport | Server-Sent Events (SSE) | Streams checkpoint events to the UI in both modes |
| Deployment | GCP Cloud Run | Container hosting for frontend and backend |


## 3.3 Checkpoint Loop State Machine


| --- | --- | --- | --- | --- |
| State | Description |
| INIT | Session starts when the DBA submits the input form |
| CLASSIFYING | AI classifies intent and selects the entry playbook |
| EXECUTING | Backend runs the next diagnostic script |
| EVALUATING | AI evaluates the checkpoint and returns a routing decision |
| PENDING_APPROVAL | Interactive Mode only — loop pauses for the DBA decision |
| ANALYZING | AI generates the final analysis from completed steps |
| COMPLETE | Report rendered; full session log written |
| ERROR | Entered on any unrecoverable fault |


# 4. DBMS Detection

The platform is detected from the server name prefix. The same logic runs in both the backend and the frontend, keeping detection consistent everywhere.


| --- | --- | --- | --- | --- |
| Server Name Prefix | Detected DBMS |
| SQL, SQLPROD, SQLDR, MSSQL | SQL Server |
| PG, POSTGRES | PostgreSQL |
| MG, MONGO | MongoDB |
| ORA, PRODDB | Oracle |
| (no match) | Oracle (default fallback) |


For example, SQLPROD-02 and SQLDR-01 resolve to SQL Server; PRODDB-ORA-01 resolves to Oracle; PG-PROD-01 resolves to PostgreSQL. In production, a server registry provides authoritative platform and connection details, with the prefix heuristic as a fallback for unregistered servers.

# 5. Playbook Library

Playbooks are navigable graphs, not linear sequences. Steps are nodes. The AI traverses the graph at runtime; the backend executes only the steps the AI selects (Auto) or the DBA approves (Interactive). Senior DBAs author all scripts and step guidance — the AI never writes or modifies them.

## 5.1 Design Principles

Senior DBAs author all scripts and step guidance — the AI never writes or modifies them.

Every script is pre-approved and registered before it can be executed.

Each playbook has exactly one entry step — always lightweight and safe to run first.

Steps declare routing hints to guide the AI; the AI may deviate based on results.

The AI can only route to steps in the current playbook or switch to a registered alternate playbook.

DBA override decisions in Interactive Mode feed the playbook improvement pipeline.

## 5.2 Current Playbook Library

Fourteen playbooks are authored across the four platforms, with the deepest coverage on SQL Server.


| --- | --- | --- | --- | --- |
| Playbook | Platform | Intent | Author |
| oracle-live-slowness-triage | Oracle | Live Triage | A. Simmons |
| oracle-top-consumers | Oracle | Resource Profiling | A. Simmons |
| oracle-historical-awr | Oracle | Historical Forensics | A. Simmons |
| sqlserver-live-slowness-triage | SQL Server | Live Triage | A. Pogaku |
| sqlserver-top-consumers | SQL Server | Resource Profiling | A. Pogaku |
| sqlserver-plan-regression | SQL Server | Historical Forensics | A. Pogaku |
| sqlserver-deadlock-analysis | SQL Server | Historical Forensics | J. Smith |
| sqlserver-ag-replica-lag | SQL Server | Live Triage | J. Smith |
| sqlserver-stale-statistics | SQL Server | Historical Forensics | Q. Miller |
| sqlserver-wait-stats-deviation | SQL Server | Historical Forensics | Q. Miller |
| sqlserver-sleeping-sessions | SQL Server | Live Triage | Antigravity |
| postgresql-live-slowness-triage | PostgreSQL | Live Triage | A. Sharma |
| postgresql-top-consumers | PostgreSQL | Resource Profiling | A. Sharma |
| mongodb-live-ops | MongoDB | Live Triage | A. Sharma |



## 5.3 Cross-Wired Playbooks

Two SQL Server playbooks — plan regression and stale statistics — are cross-wired. Each lists the other as an alternate playbook and offers a switch hint at the relevant steps. This lets a DBA pivot mid-session from chasing a plan regression to investigating stale statistics, or vice versa, when the evidence points that way. Results gathered before the switch are carried forward so the final analysis synthesizes across both lines of investigation.

## 5.4 Playbook Graph Schema


| --- | --- | --- | --- | --- |
| Field | Description |
| id | Unique identifier, format {dbms}-{intent}-{descriptor} |
| dbms | oracle | sqlserver | postgresql | mongodb |
| intent_category | live_triage | resource_profiling | historical_forensics |
| intent_tags | Keywords used for intent classification scoring |
| title | Human-readable name shown in the UI |
| entry_step | Step that always runs first — lightweight and safe |
| alternate_playbooks | Registered playbook IDs the AI or DBA may switch to |
| steps | Map of step ID to step definition |
| max_steps | Hard cap on checkpoint iterations (default 5) |
| author | Senior DBA who authored the playbook |


## 5.5 Step Schema


| --- | --- | --- | --- | --- |
| Field | Description |
| step_id | Unique within the playbook; used in routing decisions |
| description | Human-readable step name shown in the timeline |
| script_ref | Path to the approved script file |
| typical_next | Suggested next step IDs — routing hints for the AI |
| interactive_hints | Plain-language guidance shown to the DBA per candidate next step |
| safe_to_run_first | True only for entry steps |
| max_rows | Maximum rows passed to the AI at the checkpoint |


# 6. Diagnostic Data Layer

For the prototype, 51 mock data files simulate the tabular output of diagnostic steps. Each carries a narrative hint that steers the AI toward the intended diagnostic story. In production, these files are replaced by read-only connections to the real databases, with no change to the architecture.

## 6.1 Data File Schema


| --- | --- | --- | --- | --- |
| Field | Description |
| step_id | Matches the playbook step ID |
| step_description | Human-readable step name |
| columns | Column names for the tabular result |
| rows | The simulated query output |
| row_count | Total row count |
| narrative_hint | Expert analysis injected into the AI prompt as demo context |


## 6.2 Narrative Guidance

The narrative hint is injected into the checkpoint evaluation prompt as a clearly labeled demo-context block. This steers the AI toward the intended root-cause story without the AI treating it as real diagnostic evidence. In production with real database connections, the hint is absent and the block is omitted entirely — no code change required.

# 7. Checkpoint Protocol

This section defines the contract between the backend and the AI at each checkpoint boundary. The protocol is identical in both modes; Interactive Mode simply inserts a pause for DBA approval between the AI’s evaluation and the backend’s next execution.

## 7.1 What the AI Receives at Each Checkpoint


| --- | --- | --- | --- | --- |
| Input | Description |
| System context | Tool role, playbook graph, safety rules, routing decision schema, mode |
| Original question | The DBA’s verbatim natural-language question |
| Current playbook | Full graph: step IDs, descriptions, routing hints |
| Cumulative results | Results from all steps executed this session |
| Current results | The result set from the step just completed |
| Steps remaining | Unexecuted step IDs available in the current playbook |
| DBA override context | Present only if the previous step was a DBA override |
| Iteration count | Current checkpoint number and the max-steps limit |


## 7.2 The AI Routing Decision


| --- | --- | --- | --- | --- |
| Field | Description |
| assessment | Plain-language interpretation of current results |
| diagnosis_confidence | low | medium | high |
| routing_decision | continue | skip | switch | stop |
| next_step | Required if continue or skip — a valid step in the current playbook |
| switch_playbook_id | Required if switch — a registered alternate playbook |
| stop_reason | Required if stop — why sufficient information has been gathered |
| rationale | Reasoning for the routing decision, shown to the DBA |
| interactive_summary | One-sentence summary written for the DBA, shown prominently |


## 7.3 Backend Safety Enforcement


| --- | --- | --- | --- | --- |
| Validation Check | Action on Failure |
| next_step or switch target exists in the registry | Reject the decision; retry the AI with an explicit error |
| DBA-selected step exists in the current playbook | Reject the selection; return an error to the UI |
| Iteration count has not exceeded max_steps | Force stop regardless of AI or DBA decision |
| Script is flagged approved in the registry | Hard block; log a security event and halt the session |
| Routing decision is a valid value | Reject malformed response; retry with a schema reminder (up to two retries) |


Parameter values are extracted by the AI from prior results and validated by the backend against type and format before injection. Parameters are injected using parameterized binding, never string concatenation. The AI never generates parameter values from scratch.

# 8. Demo Scenarios

Five SQL Server scenarios are built in depth for the management demo. Each pairs a natural-language question with a target server and a complete diagnostic narrative ending in a clear root cause. All five run in Interactive Mode to make the AI’s checkpoint reasoning visible.


| --- | --- | --- | --- | --- |
| Scenario | Server | Question |
| Plan Regression | SQLPROD-02 | This query suddenly got slow after last night’s maintenance window |
| Deadlock Analysis | SQLPROD-02 | We are getting deadlocks on the Orders table |
| AG Replica Lag | SQLDR-01 | The DR replica is falling behind and RPO SLA may be breached |
| Stale Statistics | SQLPROD-02 | Queries have bad row estimates and are choosing wrong plans |
| Wait Stats Deviation | SQLPROD-02 | The server feels slow this Monday morning, no obvious cause |


## 8.1 Scenario Detail

### Plan Regression

Query Store reveals a query running 100x slower after a maintenance window — a nested-loop plan replaced a hash join. The investigation walks regressed queries, plan comparison, and the statistics change timeline, ending with a recommendation to force the prior good plan. Demonstrates the mid-session pivot to the stale-statistics playbook.

### Deadlock Analysis

Eight deadlocks per hour on the Orders table. Extended Events capture reveals a forward-backward locking cycle. The investigation identifies the victim and survivor pattern and recommends index changes plus Read Committed Snapshot Isolation.

### AG Replica Lag

The disaster-recovery replica’s redo queue is growing, breaching the recovery-point objective by more than three times, with tens of thousands of transactions at risk. The investigation walks availability-group health, redo queue detail, and network throughput, quantifying the SLA breach.

### Stale Statistics

A query estimates one row but returns hundreds of thousands — statistics last updated before a large data load, so the histogram no longer covers current values. The investigation walks the staleness scan, cardinality errors, and histogram detail. Demonstrates the pivot to the plan-regression playbook.

### Wait Stats Deviation

Memory-grant waits are many times the baseline on a Monday morning. The root cause is memory-grant inflation from a weekend index rebuild. The investigation compares wait statistics against baseline, analyzes memory grants, and reviews weekend changes.

# 9. User Experience

## 9.1 Shared Flow


| --- | --- | --- | --- | --- |
| Step | Actor | Description |
| 1. Enter inputs | DBA | Server name, ticket number, question, and mode |
| 2. Intent | AI | Classifies the question and selects the entry playbook |
| 3. Entry step | Backend | Runs the lightweight, safe entry script |
| 4. First checkpoint | AI | Evaluates results; confirms or recommends a switch |
| 5. Loop | Backend + AI | Checkpoint loop continues per mode |
| 6. Final analysis | AI | Produces summary, findings, severity, recommended actions |
| 7. Report | UI | Renders the report with the checkpoint timeline and decision log |


## 9.2 Interactive Mode Controls

After each checkpoint, the DBA selects one of four actions in the approval panel.


| --- | --- | --- | --- | --- |
| Action | Effect |
| Approve | Executes the AI’s recommended next step |
| Redirect | Runs a different step the DBA selects; the AI re-evaluates with that context |
| Switch Playbook | Resets to the entry step of an alternate playbook |
| Stop | Ends the loop and generates the final analysis from completed steps |


When the DBA redirects or switches, the AI receives the override context at the next checkpoint and adapts its analysis to reflect the DBA’s judgment rather than second-guessing it. Optional free-text override reasons are captured for the playbook improvement pipeline.

## 9.3 The Checkpoint Approval Panel


| --- | --- | --- | --- | --- |
| Element | Description |
| Session context bar | Server, ticket, checkpoint count, elapsed time |
| Step just completed | Step name, row count, result preview |
| AI summary | One plain-language sentence, shown prominently |
| Technical assessment | Full detail, presented as scannable bullet points |
| Confidence badge | low | medium | high |
| Recommended next step | Step name and senior-DBA-authored description |
| Action controls | Approve, Choose Different Step, Switch Playbook, Stop |


# 10. Interface

## 10.1 Views


| --- | --- | --- | --- | --- |
| View | Description |
| Diagnostic Input Form | Server, ticket, question, and mode toggle |
| Auto Mode Progress | Live progress indicator updated via SSE |
| Checkpoint Approval Panel | Interactive Mode control surface at each checkpoint |
| Checkpoint Rail | Vertical timeline of steps with status and timing |
| Diagnostic Report | Summary, severity, findings, recommended actions, decision log |
| Session History | Past sessions with server, ticket, mode, severity, playbook |


## 10.2 Interface Conventions

The operating-mode toggle is prominent on the input form, with the active mode highlighted in orange.

A mode badge appears in the report header and session history so it is never ambiguous which mode produced a session.

The AI’s one-sentence summary is styled larger than the full assessment; the assessment is shown as bullet points for fast scanning.

Each completed step shows its elapsed time; in Interactive Mode this is split into active time and DBA review time.

A left sidebar holds Diagnostic and History navigation and a clear indicator that mock data is in use.

A Help panel explains every input field; results, analysis, and logs support copy-to-clipboard.

Keyboard shortcut (Enter) approves a checkpoint in Interactive Mode for fast triage.

## 10.3 Branding


| --- | --- | --- | --- | --- |
| Element | Specification |
| Product name | DBAtlas — DBA Copilot |
| Subtitle | Database Agentic Troubleshooting Advisor |
| Accent color | Blue (#2563EB) |
| Operating-mode highlight | Orange (#C2540A on #FFF0E6) |
| Logo assets | Horizontal, mark, favicon, and app-icon |
| Monospace | JetBrains Mono for server names, step IDs, and tickets |


# 11. API Contracts

## 11.1 Endpoints


| --- | --- | --- | --- | --- |
| Method | Path | Description |
| POST | /api/v1/diagnose | Initiates a diagnostic session |
| GET | /api/v1/diagnose/{id}/stream | SSE stream of real-time checkpoint events |
| POST | /api/v1/diagnose/{id}/checkpoint/{n}/decision | Submits a DBA decision (Interactive Mode) |
| GET | /api/v1/playbooks | Lists playbooks, filterable by platform and intent |
| GET | /api/v1/session/{id} | Returns a stored session log |
| GET | /api/v1/health | Health check |


## 11.2 SSE Event Types


| --- | --- | --- | --- | --- |
| Event | Payload |
| session_started | session_id, detected_dbms, intent_category, playbook_id |
| step_executing | iteration, step_id, step_description |
| step_complete | iteration, step_id, row_count, result preview |
| checkpoint_evaluated | assessment, routing_decision, next_step, rationale, confidence, summary |
| pending_approval | recommendation, available steps and hints, available playbooks |
| analyzing | steps_executed, steps_skipped |
| complete | session_id, analysis summary, severity |
| error | error_code, message, recoverable |


# 12. Delivery Formats

DBAtlas is available in two formats built from the same playbook and data corpus.


| --- | --- | --- | --- | --- |
| Aspect | Full-Stack Application | Browser Version |
| Playbooks / data | Loaded from disk | Embedded in a single file |
| AI calls | Backend to Anthropic API | Browser to Anthropic API |
| Streaming | Real Server-Sent Events | Simulated step progression |
| Install | Backend + frontend setup | None — opens in any browser |
| Best for | Production path, real deployment | Demos, sharing, stakeholder review |


The full-stack application is the production path, deployable to GCP Cloud Run. The browser version is a single self-contained file with all playbooks, data, and branding embedded; it opens in any browser with no install, no backend, and no login, making it immediately shareable for the demo.

# 13. Non-Functional Requirements


| --- | --- | --- | --- | --- |
| Category | Requirement | Target |
| Performance | End-to-end Auto Mode (mock, 2-step) | < 10 seconds |
| Performance | Checkpoint panel render after event | < 1 second |
| Performance | Max checkpoint loop iterations | 5 per session (hard cap) |
| Availability | Cloud Run uptime during business hours | > 99% |
| Security | Script execution whitelist | Enforced at every checkpoint boundary |
| Security | API key storage | GCP Secret Manager — never in source or logs |
| Security | Database connections (production) | Read-only service accounts |
| Auditability | Checkpoint trace retention | 90 days minimum |
| Auditability | DBA decision records | All Interactive Mode decisions logged |
| Cost | GCP monthly cost at demo scale | < $15 / month |


# 14. Roadmap

## 14.1 Current Prototype

Checkpoint loop with Auto and Interactive modes, Interactive as default.

Thirteen playbooks across four platforms; 46 diagnostic data files.

Five SQL Server demo scenarios validated end to end.

Full-stack application and self-contained browser version.

Server-Sent Events for real-time checkpoint updates.

## 14.2 Next Phase

Deploy the full-stack application to GCP Cloud Run with Firestore, Cloud Storage, and Secret Manager.

Enable authentication and per-user session ownership.

Replace mock data with read-only connectors: Oracle, SQL Server, PostgreSQL, MongoDB.

Add parameterized query binding with backend-side validation and query timeouts.

Report export as PDF and shareable read-only link.

## 14.3 Future

Grafana and Prometheus integration for metric-aware diagnostics.

Playbook improvement dashboard surfacing DBA override signals to senior DBAs.

Web-based playbook authoring with versioning and approval workflow.

Expanded library targeting 25+ playbooks across all platforms.

ServiceNow API integration for automatic ticket updates.

# 15. Glossary


| --- | --- | --- | --- | --- |
| Term | Definition |
| Auto Mode | Operating mode where the checkpoint loop runs unattended to a complete report. |
| Interactive Mode | Operating mode where the loop pauses at each checkpoint for DBA approval. |
| Checkpoint | A decision point where the AI evaluates results and selects the next routing action. |
| Checkpoint loop | The iterative cycle of script execution and AI evaluation until stop or max steps. |
| Playbook | A curated diagnostic graph of pre-approved scripts authored by senior DBAs. |
| Entry step | The lightweight, safe step that always runs first in a playbook. |
| Routing decision | The AI’s structured output at each checkpoint: continue, skip, switch, or stop. |
| Cross-wiring | Linking two playbooks so a DBA can pivot between them mid-session. |
| interactive_hints | Senior-DBA-authored guidance shown to the DBA per candidate next step. |
| narrative_hint | Prototype data field guiding the AI toward a coherent diagnostic story. |
| Whitelist | The set of approved scripts and playbooks; only these can be executed. |
| SSE | Server-Sent Events — the transport streaming checkpoint events to the UI. |
| AWR | Oracle Automatic Workload Repository — stored performance snapshots. |
| DMV | SQL Server Dynamic Management View — internal server state and statistics. |
| RPO | Recovery Point Objective — the maximum acceptable data loss window. |


*End of Document  —  DBAtlas Product Specification v1.0*
