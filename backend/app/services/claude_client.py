"""
Claude Client
-------------
All Anthropic API calls in one place:
  1. classify_intent()      — maps NL question to intent + candidate playbooks
  2. evaluate_checkpoint()  — routing decision at each checkpoint boundary
  3. generate_analysis()    — final diagnostic report
"""
import json
import logging
import re
from typing import Optional
import anthropic
from app.models.schemas import (
    ClaudeRoutingDecision, FinalAnalysis, IntentCategory,
    DbmsType, Playbook, StepResult,
)
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

SEVERITY_CRITERIA = """
SEVERITY CRITERIA — apply exactly one level:
- critical: Active user impact confirmed (queries failing/timing out). Root cause identified with high confidence. Immediate action required.
- high: Significant degradation (>50% above baseline). Root cause identified with medium or high confidence. Action required within hours.
- medium: Degradation present but tolerable. Root cause identified or strongly suspected. Action recommended within working day.
- low: Suboptimal patterns with no current user impact. Action recommended at next maintenance window.
If uncertain, default to medium and note: "Severity assigned as Medium due to insufficient evidence."
"""


class ClaudeClient:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        self.model = "claude-sonnet-4-6"

    async def classify_intent(
        self,
        question: str,
        dbms: DbmsType,
        available_playbooks: list[Playbook],
    ) -> dict:
        """
        Returns:
          intent_category, confidence, time_reference, intent_tags,
          recommended_playbook_id, reasoning
        """
        playbook_list = "\n".join(
            f"  - {pb.id}: {pb.description} (tags: {', '.join(pb.intent_tags)})"
            for pb in available_playbooks
        )

        prompt = f"""You are a DBA diagnostic tool. Classify this diagnostic question.

DBMS: {dbms}
Question: "{question}"

Available playbooks:
{playbook_list}

Return ONLY valid JSON with this exact schema:
{{
  "intent_category": "live_triage" | "resource_profiling" | "historical_forensics",
  "confidence": "low" | "medium" | "high",
  "time_reference": null or ISO8601 string if a specific time was mentioned,
  "intent_tags": [list of 3-5 keywords that describe what the DBA wants],
  "recommended_playbook_id": "the playbook id that best matches",
  "reasoning": "one sentence explaining the classification"
}}

No preamble, no markdown, no additional text."""

        response = self.client.messages.create(
            model=self.model,
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        return self._parse_json(response.content[0].text, "intent classification")

    async def evaluate_checkpoint(
        self,
        question: str,
        dbms: DbmsType,
        playbook: Playbook,
        step_results: list[StepResult],
        current_step_result: StepResult,
        iteration: int,
        narrative_hint: Optional[str] = None,
        prior_playbook_results: Optional[list[StepResult]] = None,
        prior_playbook_id: Optional[str] = None,
        dba_override_context: Optional[dict] = None,
        retry_count: int = 0,
        previous_malformed: Optional[str] = None,
    ) -> ClaudeRoutingDecision:
        """
        Evaluates the completed step and returns a routing decision.
        Retries up to max_claude_retries on malformed JSON.
        """
        # Build available next steps for Claude to choose from
        available_steps = {
            sid: s for sid, s in playbook.steps.items()
            if sid != current_step_result.step_id
            and sid not in [r.step_id for r in step_results[:-1]]
        }
        steps_remaining = list(available_steps.keys())
        steps_executed = [r.step_id for r in step_results]

        # Format current results as a readable table
        current_table = self._format_result_table(current_step_result)

        # Format prior results summary
        prior_summary = ""
        if len(step_results) > 1:
            prior_summary = "\nPRIOR STEPS THIS SESSION:\n"
            for r in step_results[:-1]:
                prior_summary += f"\n[Step: {r.step_id}]\n{self._format_result_table(r)}\n"

        # Prior playbook context boundary
        prior_pb_block = ""
        if prior_playbook_results and prior_playbook_id:
            prior_pb_block = f"\n[RESULTS FROM PRIOR PLAYBOOK: {prior_playbook_id} — context only, not steps of the current playbook]\n"
            for r in prior_playbook_results:
                prior_pb_block += f"[{r.step_id}]: {self._format_result_table(r)}\n"
            prior_pb_block += "[END PRIOR PLAYBOOK RESULTS]\n"

        # Demo context injection
        demo_block = ""
        if narrative_hint:
            demo_block = f"\n[DEMO CONTEXT — NOT FROM DATABASE]: {narrative_hint}\n"

        # DBA override context
        override_block = ""
        if dba_override_context:
            override_block = f"""
[DBA OVERRIDE CONTEXT]: The DBA redirected from your previous recommendation.
  Your recommendation was: {dba_override_context.get('original_recommendation')}
  DBA selected instead: {dba_override_context.get('dba_selected')}
  DBA reason: {dba_override_context.get('reason', 'not provided')}
Please adapt your analysis accordingly — do not second-guess the DBA's decision.
"""

        # Retry context
        retry_block = ""
        if retry_count > 0 and previous_malformed:
            retry_block = f"\n[RETRY {retry_count}/{settings.max_claude_retries}]: Your previous response did not conform to the required JSON schema. Previous response: {previous_malformed[:200]}. Return only valid JSON matching the schema below. No other text.\n"

        # Build available next steps description
        next_steps_desc = "\n".join(
            f"  - {sid}: {s.description}"
            for sid, s in available_steps.items()
        ) or "  (no more steps available — recommend stop)"

        alternate_playbooks_desc = "\n".join(
            f"  - {pb_id}" for pb_id in playbook.alternate_playbooks
        ) or "  (none)"

        prompt = f"""You are an expert DBA diagnostic assistant. Evaluate this checkpoint and decide the next action.

ORIGINAL QUESTION: "{question}"
DBMS: {dbms}
PLAYBOOK: {playbook.id} — {playbook.title}
CHECKPOINT: {iteration} of {playbook.max_steps}
STEPS EXECUTED: {', '.join(steps_executed)}
{demo_block}{override_block}{prior_pb_block}

CURRENT STEP COMPLETED: {current_step_result.step_id}
{current_table}
{prior_summary}

AVAILABLE NEXT STEPS:
{next_steps_desc}

ALTERNATE PLAYBOOKS (only switch if current playbook is clearly wrong):
{alternate_playbooks_desc}
{retry_block}
Return ONLY valid JSON with this exact schema:
{{
  "assessment": "your technical interpretation of what the current results show",
  "diagnosis_confidence": "low" | "medium" | "high",
  "routing_decision": "continue" | "skip" | "switch" | "stop",
  "next_step": "step_id to run next (required if continue or skip, must be from available steps above)",
  "switch_playbook_id": "playbook id (required if switch, must be from alternate playbooks above)",
  "skip_steps": ["step_ids to skip based on evidence"],
  "extracted_parameters": null or {{"param_name": "extracted_value"}},
  "stop_reason": "why sufficient evidence gathered (required if stop)",
  "rationale": "your reasoning for this routing decision",
  "interactive_summary": "one plain-language sentence for the DBA — what you found and what you recommend"
}}

No preamble, no markdown, no additional text."""

        response = self.client.messages.create(
            model=self.model,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = response.content[0].text
        try:
            data = self._parse_json(raw, "checkpoint evaluation")
            return ClaudeRoutingDecision(**data)
        except Exception as e:
            if retry_count < settings.max_claude_retries:
                logger.warning(f"Malformed routing decision (attempt {retry_count + 1}): {e}")
                return await self.evaluate_checkpoint(
                    question=question, dbms=dbms, playbook=playbook,
                    step_results=step_results, current_step_result=current_step_result,
                    iteration=iteration, narrative_hint=narrative_hint,
                    prior_playbook_results=prior_playbook_results,
                    prior_playbook_id=prior_playbook_id,
                    dba_override_context=dba_override_context,
                    retry_count=retry_count + 1,
                    previous_malformed=raw,
                )
            raise ValueError(
                f"Claude returned malformed routing decision after {settings.max_claude_retries + 1} attempts. "
                f"Last error: {e}. Last response: {raw[:300]}"
            )

    async def generate_analysis(
        self,
        question: str,
        dbms: DbmsType,
        playbook: Playbook,
        mode: str,
        ticket_number: str,
        server_name: str,
        step_results: list[StepResult],
        checkpoint_summaries: list[str],
        prior_playbook_id: Optional[str] = None,
        prior_playbook_results: Optional[list[StepResult]] = None,
        use_mock_data: bool = True,
        time_reference: Optional[str] = None,
    ) -> FinalAnalysis:
        """Generate the final structured diagnostic analysis."""

        # Apply 200-row cap distributed proportionally
        capped_results = self._apply_row_cap(step_results, total_cap=200)

        # Format step results
        results_block = ""
        for r in capped_results:
            truncation_note = f" [TRUNCATED to {len(r.rows)} of {r.row_count} rows]" if r.truncated else ""
            results_block += f"\n[STEP: {r.step_id}{truncation_note}]\n{self._format_result_table(r)}\n"

        # Prior playbook block
        prior_pb_block = ""
        if prior_playbook_results and prior_playbook_id:
            prior_pb_block = f"\n[RESULTS FROM PRIOR PLAYBOOK: {prior_playbook_id} — context only]\n"
            for r in prior_playbook_results:
                prior_pb_block += f"[{r.step_id}]: {self._format_result_table(r)}\n"

        # Checkpoint reasoning summary
        checkpoint_block = "\n".join(
            f"Checkpoint {i+1}: {summary}"
            for i, summary in enumerate(checkpoint_summaries)
        )

        switch_note = ""
        if prior_playbook_id:
            switch_note = f"\nNOTE: Session switched from playbook {prior_playbook_id} to {playbook.id} during the diagnostic."

        prompt = f"""You are a senior database performance analyst. Produce a final diagnostic report.

{SEVERITY_CRITERIA}

SESSION CONTEXT:
- Server: {server_name}
- ServiceNow Ticket: {ticket_number}
- DBMS: {dbms}
- Original question: "{question}"
- Operating mode: {mode}
- Playbook: {playbook.id} v{playbook.version} — {playbook.title}
- Playbook switch occurred: {"Yes" if prior_playbook_id else "No"}{switch_note}
- Time reference: {time_reference or "current"}

STEP RESULTS:
{results_block}
{prior_pb_block}

CHECKPOINT REASONING SUMMARY:
{checkpoint_block}

INSTRUCTIONS: Return ONLY valid JSON with this exact schema:
{{
  "summary": "2-4 sentence plain-language summary of findings",
  "key_findings": ["3-5 specific, evidence-backed findings"],
  "recommended_actions": ["2-4 prioritized, actionable recommendations"],
  "severity": "low" | "medium" | "high" | "critical",
  "severity_rationale": "one sentence explaining the severity assignment",
  "confidence": "low" | "medium" | "high",
  "playbook_switch_occurred": {str(bool(prior_playbook_id)).lower()},
  "steps_executed": {json.dumps([r.step_id for r in step_results])},
  "steps_skipped": []
}}

No preamble, no markdown fences, no additional text."""

        response = self.client.messages.create(
            model=self.model,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )

        data = self._parse_json(response.content[0].text, "final analysis")
        return FinalAnalysis(**data)

    async def chat(self, messages: list[dict], specification_content: str) -> str:
        """
        Provides knowledge base Q&A based solely on the specification document.
        """
        system_prompt = f"""You are a helpful, expert knowledge base assistant for DBAtlas.
Answer the user's questions strictly using the information from the DBAtlas Specification document provided below.
Do not invent features or workflows that are not in this document. Keep your answers clear, concise, and structured.
You may use markdown formatting.

DBATLAS SPECIFICATION:
{specification_content}
"""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=1000,
            system=system_prompt,
            messages=messages,
        )
        return response.content[0].text

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _format_result_table(self, result: StepResult) -> str:
        if not result.columns:
            return "(no results)"
        header = " | ".join(str(c) for c in result.columns)
        separator = "-" * len(header)
        rows = "\n".join(" | ".join(str(v) for v in row) for row in result.rows[:10])
        suffix = f"\n... ({result.row_count} total rows)" if result.row_count > 10 else ""
        return f"{header}\n{separator}\n{rows}{suffix}"

    def _apply_row_cap(
        self, step_results: list[StepResult], total_cap: int = 200
    ) -> list[StepResult]:
        if not step_results:
            return step_results
        total_rows = sum(len(r.rows) for r in step_results)
        if total_rows <= total_cap:
            return step_results

        per_step = total_cap // len(step_results)
        remainder = total_cap % len(step_results)
        capped = []
        for i, r in enumerate(step_results):
            limit = per_step + (remainder if i == 0 else 0)
            if len(r.rows) > limit:
                capped.append(StepResult(
                    step_id=r.step_id,
                    step_description=r.step_description,
                    columns=r.columns,
                    rows=r.rows[:limit],
                    row_count=r.row_count,
                    truncated=True,
                    executed_at=r.executed_at,
                ))
            else:
                capped.append(r)
        return capped

    def _parse_json(self, text: str, context: str) -> dict:
        """Parse JSON from Claude response, stripping any markdown fences."""
        text = text.strip()
        # Strip markdown code fences if present
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in {context}: {e}. Text: {text[:200]}")
