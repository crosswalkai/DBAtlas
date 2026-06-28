// types/index.ts — mirrors backend app/models/schemas.py

export type DbmsType = 'oracle' | 'sqlserver' | 'postgresql' | 'mongodb';
export type IntentCategory = 'live_triage' | 'resource_profiling' | 'historical_forensics';
export type SessionMode = 'auto' | 'interactive';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type Confidence = 'low' | 'medium' | 'high';
export type RoutingDecision = 'continue' | 'skip' | 'switch' | 'stop';
export type DbaDecision = 'approved' | 'redirected' | 'switched_playbook' | 'stopped';
export type SessionState =
  | 'INIT' | 'CLASSIFYING' | 'EXECUTING' | 'EVALUATING'
  | 'PENDING_APPROVAL' | 'VALIDATING' | 'ANALYZING' | 'COMPLETE'
  | 'TIMEOUT' | 'ERROR';

// ── Request types ─────────────────────────────────────────────────────────────

export interface DiagnoseRequest {
  server_name: string;
  ticket_number: string;
  question: string;
  mode: SessionMode;
  playbook_id?: string;
  use_mock_data?: boolean;
  dbms_type_override?: DbmsType;
  connection_string_override?: string;
}

export interface CheckpointDecisionRequest {
  dba_decision: DbaDecision;
  dba_selected_step?: string;
  dba_selected_playbook?: string;
  dba_override_reason?: string;
}

// ── Response types ────────────────────────────────────────────────────────────

export interface DiagnoseStartResponse {
  session_id: string;
  status: string;
  playbook: string;
  dbms: DbmsType;
  mode: SessionMode;
}

export interface FinalAnalysis {
  summary: string;
  key_findings: string[];
  recommended_actions: string[];
  severity: Severity;
  severity_rationale: string;
  confidence: Confidence;
  playbook_switch_occurred: boolean;
  steps_executed: string[];
  steps_skipped: string[];
}

export interface CheckpointLogEntry {
  iteration: number;
  step_id: string;
  step_description: string;
  row_count: number;
  claude_assessment: string;
  claude_recommendation?: string;
  routing_decision: RoutingDecision;
  rationale: string;
  interactive_summary: string;
  skipped_steps: string[];
  dba_decision?: DbaDecision;
  dba_selected_step?: string;
  dba_selected_playbook?: string;
  dba_override_reason?: string;
  mode: SessionMode;
}

export interface SessionDetail {
  session_id: string;
  state: SessionState;
  mode: SessionMode;
  dbms: DbmsType;
  playbook_id: string;
  iteration: number;
  steps_executed: string[];
  steps_skipped: string[];
  checkpoint_log: CheckpointLogEntry[];
  analysis?: FinalAnalysis;
  created_at: string;
}

export interface PlaybookSummary {
  id: string;
  dbms: DbmsType;
  intent_category: IntentCategory;
  title: string;
  description: string;
  entry_step: string;
  step_count: number;
  max_steps: number;
}

// ── SSE event payloads ────────────────────────────────────────────────────────

export interface SseSessionStarted {
  session_id: string;
  detected_dbms: DbmsType;
  intent_category: IntentCategory;
  playbook_id: string;
  playbook_title: string;
  mode: SessionMode;
}

export interface SseStepExecuting {
  iteration: number;
  step_id: string;
  step_description: string;
}

export interface SseStepComplete {
  iteration: number;
  step_id: string;
  row_count: number;
  result_preview: unknown[][];
  columns: string[];
}

export interface SseCheckpointEvaluated {
  iteration: number;
  assessment: string;
  routing_decision: RoutingDecision;
  next_step?: string;
  rationale: string;
  diagnosis_confidence: Confidence;
  interactive_summary: string;
  skip_steps: string[];
}

export interface SsePendingApproval {
  iteration: number;
  claude_recommendation: {
    routing_decision: RoutingDecision;
    next_step?: string;
    switch_playbook_id?: string;
    interactive_summary: string;
    assessment: string;
    rationale: string;
    diagnosis_confidence: Confidence;
    skip_steps: string[];
  };
  available_steps: Record<string, { description: string; hint: string }>;
  available_playbooks: string[];
  timeout_seconds: number;
}

export interface SseComplete {
  session_id: string;
  analysis_summary: string;
  severity: Severity;
}

export interface SseError {
  error_code: string;
  message: string;
  recoverable: boolean;
}

// ── UI state ──────────────────────────────────────────────────────────────────

export interface CheckpointNode {
  iteration: number;
  step_id: string;
  step_description: string;
  state: 'complete' | 'active' | 'pending' | 'skipped' | 'error';
  row_count?: number;
  dba_decision?: DbaDecision;
  routing_decision?: RoutingDecision;
}
