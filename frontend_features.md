# DBAtlas — Frontend Features & Enhancements

This file documents the existing frontend features, UI guidelines, and serves as a log for enhancement requests.

---

## 1. Completed Frontend Features

### Input Form
- **Location**: `frontend/src/components/InputForm.tsx`
- **Details**: Captures target server name, ServiceNow ticket, and natural language question.
- **Mode Toggle**: Interactive/Auto switch.
  - *Interactive Mode*: Default. DBA controls next step.
  - *Auto Mode*: Loops to completion unattended.

### Checkpoint Approval Panel
- **Location**: `frontend/src/components/CheckpointApprovalPanel.tsx`
- **Details**: Rendered when state is `PENDING_APPROVAL`. Lets DBA approve, redirect to a different step, switch playbooks, or stop. Captures text override reasons.

### Checkpoint Rail
- **Location**: `frontend/src/components/CheckpointRail.tsx`
- **Details**: Vertical timeline rail on the right side. Visualizes execution status (running, pending, complete, skipped), step name, and evaluation narration in real time.

### Diagnostic Report
- **Location**: `frontend/src/components/DiagnosticReport.tsx`
- **Details**: Renders final analysis (summary, findings list, recommended actions list, severity badge, and confidence).

### Session History
- **Location**: `frontend/src/components/SessionHistory.tsx`
- **Details**: Sidebar listing past sessions with status, DBMS, server name, and timestamp.

---

## 2. Expected UI Behavior & States

### Hover Effects & Tooltips
- **Auto Mode**: Displays tooltip *"I'm feeling lucky!"*
- **Interactive Mode**: Displays tooltip *"I'm in charge!"*
- Buttons and interactive items use subtle scale and background transitions.

### Color Tokens (Branding)
- **Active Mode Toggle bg**: `#FFF0E6` (light orange)
- **Active Mode Toggle text**: `#C2540A` (orange)
- **Active Mode Toggle border**: `#F9C4A0`
- **Run Diagnostics button bg**: `#F3F4F6` (light grey)
- **Run Diagnostics button text**: `#C2540A`
- **Accent Blue**: `#2563EB`

### Typography & Fonts
- System identifiers, query strings, and SPIDs/step IDs: Monospace `JetBrains Mono`
- General labels and body text: System sans-serif (Inter/Roboto default fallback)

### Error and Loading States
- Displays a `Spinner` and skeleton placeholder cards during active execution.
- Connection failures or API errors display alert panels with retry instructions.

---

## 3. Future Enhancement Requests

*Add new frontend enhancement requests in this section:*

- [x] **FE-001**: Implement filter/search bar in the Session History sidebar.
- [x] **FE-002**: Add a visual playbook graph view (e.g., via React Flow) showing current node highlight.
- [x] **FE-003**: Create a light/dark mode theme selector.
- [x] **FE-004**: Adjust the diagnostic and history buttons on the homepage to be closer to the center of the left column.
- [x] **FE-005**: Hide the top-left header logo when the main homepage logo with the words "DBAtlas" is active on the screen.

