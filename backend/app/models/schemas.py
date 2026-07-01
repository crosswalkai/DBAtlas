from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
import uuid


# ── Enums ────────────────────────────────────────────────────────────────────

DbmsType = Literal["oracle", "sqlserver", "postgresql", "mongodb"]
IntentCategory = Literal["live_triage", "resource_profiling", "historical_forensics"]
RoutingDecision = Literal["continue", "skip", "switch", "stop"]
Severity = Literal["low", "medium", "high", "critical"]
Confidence = Literal["low", "medium", "high"]
SessionMode = Literal["auto", "interactive"]
DbaDecision = Literal["approved", "redirected", "switched_playbook", "stopped"]
SessionState = Literal[
    "INIT", "CLASSIFYING", "EXECUTING", "EVALUATING",
    "PENDING_APPROVAL", "VALIDATING", "ANALYZING", "COMPLETE",
    "TIMEOUT", "ERROR"
]


# ── API Request / Response Models ─────────────────────────────────────────────

class DiagnoseRequest(BaseModel):
    server_name: str = Field(..., min_length=1, max_length=200)
    ticket_number: str = Field(..., pattern=r"^(INC|CHG)\d{7}$|^CPL-\d{8}-\d{6}-\w+$")
    question: str = Field(..., min_length=5, max_length=500)
    mode: SessionMode = "interactive"
    playbook_id: Optional[str] = None
    use_mock_data: bool = True
    # Tier 2 fallback fields (populated when server not in registry)
    dbms_type_override: Optional[DbmsType] = None
    connection_string_override: Optional[str] = None


class SseTokenRequest(BaseModel):
    session_id: str


class SseTokenResponse(BaseModel):
    sse_token: str
    expires_in: int = 60


class CheckpointDecisionRequest(BaseModel):
    dba_decision: DbaDecision
    dba_selected_step: Optional[str] = None
    dba_selected_playbook: Optional[str] = None
    dba_override_reason: Optional[str] = Field(None, max_length=500)


class ShareReportRequest(BaseModel):
    recipient: str
    cc: Optional[str] = None
    message: Optional[str] = None


# ── Internal Models ───────────────────────────────────────────────────────────

class PlaybookStep(BaseModel):
    step_id: str
    description: str
    script_ref: str
    mock_data_key: str
    parameters: list[str] = []
    result_format: Literal["tabular", "json", "text"] = "tabular"
    typical_next: list[str] = []
    interactive_hints: dict[str, str] = {}
    safe_to_run_first: bool = False
    max_rows: int = 50


class Playbook(BaseModel):
    id: str
    dbms: DbmsType
    intent_category: IntentCategory
    intent_tags: list[str]
    title: str
    description: str
    entry_step: str
    alternate_playbooks: list[str] = []
    steps: dict[str, PlaybookStep]
    max_steps: int = 5
    version: int = 1
    author: str = "Senior DBA"


class ServerRegistryEntry(BaseModel):
    server_name: str
    dbms_type: DbmsType
    connection_string_secret: str  # Secret Manager name, not value
    display_name: str
    environment: Literal["production", "staging", "development"] = "production"
    grafana_base_url: Optional[str] = None
    prometheus_base_url: Optional[str] = None
    prometheus_instance_label: Optional[str] = None


class StepResult(BaseModel):
    step_id: str
    step_description: str
    columns: list[str]
    rows: list[list]
    row_count: int
    truncated: bool = False
    executed_at: datetime = Field(default_factory=datetime.utcnow)


class ClaudeRoutingDecision(BaseModel):
    assessment: str
    diagnosis_confidence: Confidence
    routing_decision: RoutingDecision
    next_step: Optional[str] = None
    switch_playbook_id: Optional[str] = None
    skip_steps: list[str] = []
    extracted_parameters: Optional[dict] = None
    stop_reason: Optional[str] = None
    rationale: str
    interactive_summary: str = ""


class CheckpointLogEntry(BaseModel):
    iteration: int
    step_id: str
    step_description: str
    row_count: int
    claude_assessment: str
    claude_recommendation: Optional[str] = None
    routing_decision: RoutingDecision
    rationale: str
    interactive_summary: str = ""
    skipped_steps: list[str] = []
    dba_decision: Optional[DbaDecision] = None
    dba_selected_step: Optional[str] = None
    dba_selected_playbook: Optional[str] = None
    dba_override_reason: Optional[str] = None
    mode: SessionMode = "auto"


class FinalAnalysis(BaseModel):
    summary: str
    key_findings: list[str]
    recommended_actions: list[str]
    severity: Severity
    severity_rationale: str
    confidence: Confidence
    playbook_switch_occurred: bool = False
    steps_executed: list[str]
    steps_skipped: list[str]


class DiagnoseResponse(BaseModel):
    session_id: str
    mode: SessionMode
    intent_category: IntentCategory
    detected_dbms: DbmsType
    playbook_used: dict
    time_reference: Optional[str] = None
    checkpoint_log: list[CheckpointLogEntry]
    steps_executed: list[str]
    steps_skipped: list[str]
    dba_overrides: int = 0
    analysis: FinalAnalysis
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    response: str


# ── SSE Event Models ──────────────────────────────────────────────────────────

class SseEvent(BaseModel):
    event_type: str
    data: dict
    session_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
