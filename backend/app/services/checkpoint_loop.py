"""
Checkpoint Loop
---------------
The core diagnostic engine. Implements the state machine from the spec:
  INIT → CLASSIFYING → EXECUTING → EVALUATING
    → PENDING_APPROVAL (Interactive) or back to EXECUTING (Auto)
    → ANALYZING → COMPLETE / ERROR

FastAPI owns all sequencing. Claude owns routing decisions.
Claude never generates queries — only routes between pre-approved steps.
"""
import asyncio
import logging
import uuid
from datetime import datetime
from typing import Optional

from app.models.schemas import (
    DiagnoseRequest, DiagnoseResponse, CheckpointLogEntry,
    SessionMode, ClaudeRoutingDecision,
)
from app.services.session_store import SessionData, session_store
from app.services.mock_data_service import MockDataService
from app.services.playbook_service import PlaybookService
from app.services.claude_client import ClaudeClient
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class CheckpointLoop:
    def __init__(
        self,
        mock_data_service: MockDataService,
        playbook_service: PlaybookService,
        claude_client: ClaudeClient,
    ):
        self.mock_svc = mock_data_service
        self.playbook_svc = playbook_service
        self.claude = claude_client

    async def start_session(
        self,
        request: DiagnoseRequest,
        dba_uid: str = "local-dev-user",
    ) -> SessionData:
        """
        Initialise session, classify intent, load playbook, store in session_store.
        Returns the SessionData — SSE loop runs separately via run_loop().
        """
        session_id = str(uuid.uuid4())

        # ── DBMS detection ────────────────────────────────────────────────────
        dbms = request.dbms_type_override or await self._detect_dbms(request.server_name)

        # ── Intent classification ─────────────────────────────────────────────
        available_playbooks = await self.playbook_svc.list_playbooks(dbms=dbms)

        if not available_playbooks:
            raise ValueError(f"No playbooks found for DBMS: {dbms}")

        if request.playbook_id:
            # Manual override — skip classification
            playbook = await self.playbook_svc.get_playbook(request.playbook_id)
            if not playbook:
                raise ValueError(f"Playbook not found: {request.playbook_id}")
            intent_result = {
                "intent_category": playbook.intent_category,
                "confidence": "high",
                "time_reference": None,
                "intent_tags": playbook.intent_tags,
                "recommended_playbook_id": playbook.id,
                "reasoning": "Playbook manually specified by DBA.",
            }
        else:
            intent_result = await self.claude.classify_intent(
                question=request.question,
                dbms=dbms,
                available_playbooks=available_playbooks,
            )
            playbook = await self.playbook_svc.find_best_playbook(
                dbms=dbms,
                intent_category=intent_result["intent_category"],
                intent_tags=intent_result.get("intent_tags", []),
                recommended_playbook_id=intent_result.get("recommended_playbook_id"),
            )
            if not playbook:
                raise ValueError(
                    f"No playbook found for {dbms} / {intent_result['intent_category']}"
                )

        # ── Create session ────────────────────────────────────────────────────
        session = SessionData(
            session_id=session_id,
            dba_uid=dba_uid,
            server_name=request.server_name,
            ticket_number=request.ticket_number,
            question=request.question,
            mode=request.mode,
            dbms=dbms,
            playbook=playbook,
            use_mock_data=request.use_mock_data,
        )
        session.intent_category = intent_result["intent_category"]
        session.time_reference = intent_result.get("time_reference")
        session.intent_tags = intent_result.get("intent_tags", [])
        session.state = "CLASSIFYING"

        await session_store.create(session)

        logger.info(
            f"Session {session_id} created: {dbms} / {playbook.id} / {request.mode}"
        )
        return session

    async def run_loop(self, session: SessionData) -> DiagnoseResponse:
        """
        Run the full checkpoint loop for the session.
        In Interactive Mode, pauses at each PENDING_APPROVAL state and
        waits for a DBA decision via submit_dba_decision().
        """
        try:
            await self._emit(session, "session_started", {
                "session_id": session.session_id,
                "detected_dbms": session.dbms,
                "intent_category": session.intent_category,
                "playbook_id": session.playbook.id,
                "playbook_title": session.playbook.title,
                "mode": session.mode,
            })

            playbook = session.playbook
            current_step_id = playbook.entry_step
            forced_stop = False

            while True:
                session.iteration += 1
                session.touch()

                # ── max_steps warning ─────────────────────────────────────────
                if session.iteration == playbook.max_steps and session.mode == "interactive":
                    await self._emit(session, "max_steps_warning", {
                        "iteration": session.iteration,
                        "max_steps": playbook.max_steps,
                        "message": f"This is the final available step (step {session.iteration} of {playbook.max_steps}). Approving will complete execution and generate the final analysis.",
                    })

                # ── EXECUTING ─────────────────────────────────────────────────
                session.step_start_time = datetime.utcnow()
                session.state = "EXECUTING"
                await self._emit(session, "step_executing", {
                    "iteration": session.iteration,
                    "step_id": current_step_id,
                    "step_description": playbook.steps[current_step_id].description,
                })

                step_def = playbook.steps[current_step_id]
                result, narrative_hint = await self.mock_svc.get_step_result(
                    dbms=session.dbms,
                    playbook_id=playbook.id,
                    step_id=current_step_id,
                    max_rows=step_def.max_rows,
                )
                session.step_results.append(result)
                session.steps_executed.append(current_step_id)

                await self._emit(session, "step_complete", {
                    "iteration": session.iteration,
                    "step_id": current_step_id,
                    "row_count": result.row_count,
                    "result_preview": result.rows[:3],
                    "columns": result.columns,
                })

                # ── EVALUATING ────────────────────────────────────────────────
                session.state = "EVALUATING"

                # Build DBA override context if previous step was overridden
                dba_override_ctx = None
                if session.checkpoint_log and session.checkpoint_log[-1].dba_decision in ("redirected", "switched_playbook"):
                    last = session.checkpoint_log[-1]
                    dba_override_ctx = {
                        "original_recommendation": last.claude_recommendation,
                        "dba_selected": last.dba_selected_step or last.dba_selected_playbook,
                        "reason": last.dba_override_reason,
                    }

                try:
                    decision = await self.claude.evaluate_checkpoint(
                        question=session.question,
                        dbms=session.dbms,
                        playbook=playbook,
                        step_results=session.step_results,
                        current_step_result=result,
                        iteration=session.iteration,
                        narrative_hint=narrative_hint,
                        prior_playbook_results=session.prior_playbook_results or None,
                        prior_playbook_id=session.prior_playbook.id if session.prior_playbook else None,
                        dba_override_context=dba_override_ctx,
                    )
                except ValueError as e:
                    # Exhausted retries
                    await self._handle_claude_error(session, str(e))
                    forced_stop = True
                    break

                await self._emit(session, "checkpoint_evaluated", {
                    "iteration": session.iteration,
                    "assessment": decision.assessment,
                    "routing_decision": decision.routing_decision,
                    "next_step": decision.next_step,
                    "rationale": decision.rationale,
                    "diagnosis_confidence": decision.diagnosis_confidence,
                    "interactive_summary": decision.interactive_summary,
                    "skip_steps": decision.skip_steps,
                })

                # ── VALIDATE routing decision ─────────────────────────────────
                validated_decision = await self._validate_decision(session, decision)

                # ── PENDING_APPROVAL (Interactive Mode) ───────────────────────
                if session.mode == "interactive":
                    active_dur = int((datetime.utcnow() - session.step_start_time).total_seconds()) if session.step_start_time else 0
                    session.step_timings[current_step_id] = {"active": active_dur, "wait": 0}
                    session.step_wait_start_time = datetime.utcnow()
                    session.state = "PENDING_APPROVAL"
                    session.pending_decision = validated_decision

                    # Build available steps for the approval panel
                    available_for_dba = {
                        sid: {
                            "description": s.description,
                            "hint": s.interactive_hints.get(sid, "No description available."),
                        }
                        for sid, s in playbook.steps.items()
                        if sid not in session.steps_executed
                    }

                    await self._emit(session, "pending_approval", {
                        "iteration": session.iteration,
                        "claude_recommendation": {
                            "routing_decision": validated_decision.routing_decision,
                            "next_step": validated_decision.next_step,
                            "switch_playbook_id": validated_decision.switch_playbook_id,
                            "interactive_summary": validated_decision.interactive_summary,
                            "assessment": validated_decision.assessment,
                            "rationale": validated_decision.rationale,
                            "diagnosis_confidence": validated_decision.diagnosis_confidence,
                            "skip_steps": validated_decision.skip_steps,
                        },
                        "available_steps": available_for_dba,
                        "available_playbooks": playbook.alternate_playbooks,
                        "timeout_seconds": 1200,  # 20 min
                    })

                    # Wait for DBA decision
                    dba_result = await self._wait_for_dba_decision(session)
                    wait_dur = int((datetime.utcnow() - session.step_wait_start_time).total_seconds()) if session.step_wait_start_time else 0
                    if current_step_id in session.step_timings:
                        session.step_timings[current_step_id]["wait"] = wait_dur
                    if dba_result is None:
                        # Timeout
                        forced_stop = True
                        break

                    # Log DBA decision
                    log_entry = self._build_checkpoint_log(
                        session, result, validated_decision, dba_result
                    )
                    session.checkpoint_log.append(log_entry)
                    session.checkpoint_summaries.append(validated_decision.assessment)

                    # Apply DBA decision
                    dba_action = dba_result["dba_decision"]
                    if dba_action == "stopped":
                        break
                    elif dba_action == "approved":
                        final_decision = validated_decision
                    elif dba_action == "redirected":
                        final_decision = ClaudeRoutingDecision(
                            assessment=validated_decision.assessment,
                            diagnosis_confidence=validated_decision.diagnosis_confidence,
                            routing_decision="continue",
                            next_step=dba_result["dba_selected_step"],
                            rationale=f"DBA redirected to {dba_result['dba_selected_step']}",
                            interactive_summary=validated_decision.interactive_summary,
                        )
                    elif dba_action == "switched_playbook":
                        new_pb_id = dba_result["dba_selected_playbook"]
                        new_pb = await self.playbook_svc.get_playbook(new_pb_id)
                        if new_pb:
                            session.switch_playbook(new_pb, trigger="dba")
                            playbook = new_pb
                            # Update intent metadata
                            session.intent_category = new_pb.intent_category
                            await self._emit(session, "playbook_switched", {
                                "from_playbook": session.prior_playbook.id,
                                "to_playbook": new_pb.id,
                                "trigger": "dba",
                            })
                            current_step_id = new_pb.entry_step
                            continue
                        final_decision = validated_decision
                    else:
                        final_decision = validated_decision
                else:
                    # Auto Mode — log checkpoint, proceed immediately
                    active_dur = int((datetime.utcnow() - session.step_start_time).total_seconds()) if session.step_start_time else 0
                    session.step_timings[current_step_id] = {"active": active_dur, "wait": 0}
                    log_entry = self._build_checkpoint_log(
                        session, result, validated_decision, None
                    )
                    session.checkpoint_log.append(log_entry)
                    session.checkpoint_summaries.append(validated_decision.assessment)
                    final_decision = validated_decision

                # ── Apply routing decision ────────────────────────────────────
                if final_decision.routing_decision == "stop":
                    break

                if final_decision.routing_decision == "switch" and final_decision.switch_playbook_id:
                    new_pb = await self.playbook_svc.get_playbook(final_decision.switch_playbook_id)
                    if new_pb:
                        session.switch_playbook(new_pb, trigger="claude")
                        playbook = new_pb
                        session.intent_category = new_pb.intent_category
                        await self._emit(session, "playbook_switched", {
                            "from_playbook": session.prior_playbook.id,
                            "to_playbook": new_pb.id,
                            "trigger": "claude",
                        })
                        current_step_id = new_pb.entry_step
                        continue

                # Mark skipped steps
                for skip_id in final_decision.skip_steps:
                    if skip_id not in session.steps_skipped:
                        session.steps_skipped.append(skip_id)

                # Check max_steps
                if session.iteration >= playbook.max_steps:
                    await self._emit(session, "max_steps_reached", {
                        "iteration": session.iteration,
                        "message": "Maximum steps reached. Generating final analysis.",
                    })
                    break

                # Advance to next step
                next_step = final_decision.next_step
                if next_step and next_step in playbook.steps and next_step not in session.steps_executed:
                    current_step_id = next_step
                else:
                    # No valid next step — stop
                    break

            # ── ANALYZING ─────────────────────────────────────────────────────
            if not forced_stop:
                session.state = "ANALYZING"
                await self._emit(session, "analyzing", {
                    "steps_executed": session.steps_executed,
                    "steps_skipped": session.steps_skipped,
                })

                analysis = await self.claude.generate_analysis(
                    question=session.question,
                    dbms=session.dbms,
                    playbook=playbook,
                    mode=session.mode,
                    ticket_number=session.ticket_number,
                    server_name=session.server_name,
                    step_results=session.step_results,
                    checkpoint_summaries=session.checkpoint_summaries,
                    prior_playbook_id=session.prior_playbook.id if session.prior_playbook else None,
                    prior_playbook_results=session.prior_playbook_results or None,
                    use_mock_data=session.use_mock_data,
                    time_reference=session.time_reference,
                )
                analysis.steps_skipped = session.steps_skipped
                session.final_analysis = analysis

            # ── COMPLETE ──────────────────────────────────────────────────────
            session.state = "COMPLETE"
            response = self._build_response(session)

            await self._emit(session, "complete", {
                "session_id": session.session_id,
                "analysis_summary": session.final_analysis.summary if session.final_analysis else "",
                "severity": session.final_analysis.severity if session.final_analysis else "medium",
            })

            # Signal SSE stream to close
            await session.sse_queue.put(None)
            return response

        except Exception as e:
            session.state = "ERROR"
            logger.exception(f"Session {session.session_id} failed: {e}")
            await self._emit(session, "error", {
                "error_code": "LOOP_ERROR",
                "message": str(e),
                "recoverable": False,
            })
            await session.sse_queue.put(None)
            raise

    async def submit_dba_decision(
        self, session_id: str, dba_uid: str, decision_data: dict
    ) -> bool:
        """Called by the API endpoint to submit a DBA decision."""
        session = await session_store.get(session_id)
        if not session:
            return False
        if session.dba_uid != dba_uid and dba_uid != "local-dev-user":
            logger.warning(f"Ownership check failed: {dba_uid} != {session.dba_uid}")
            return False
        if session.state != "PENDING_APPROVAL":
            return False

        session.dba_decision_result = decision_data
        if session.pending_event:
            session.pending_event.set()
        return True

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _detect_dbms(self, server_name: str):
        """
        Tier 1: Firestore registry lookup (production).
        Tier 2: Server name prefix heuristic (local dev).
        Prefixes: ORA/PRODDB → oracle, SQL/SQLPROD/MSSQL → sqlserver,
                  PG/POSTGRES → postgresql, MG/MONGO → mongodb.
        """
        name = server_name.upper()
        if any(name.startswith(p) for p in ("SQL", "MSSQL", "SQLPROD", "SQLDR")):
            return "sqlserver"
        if any(name.startswith(p) for p in ("PG", "POSTGRES")):
            return "postgresql"
        if any(name.startswith(p) for p in ("MG", "MONGO")):
            return "mongodb"
        if any(name.startswith(p) for p in ("ORA", "PRODDB")):
            return "oracle"
        # Secondary check — contains keywords anywhere in the name
        if "SQL" in name or "MSSQL" in name:
            return "sqlserver"
        if "POSTGRES" in name or "PGSQL" in name:
            return "postgresql"
        if "MONGO" in name:
            return "mongodb"
        if "ORA" in name:
            return "oracle"
        logger.info(f"DBMS detection for '{server_name}' — no prefix matched, defaulting to oracle")
        return "oracle"

    async def _validate_decision(
        self, session: SessionData, decision: ClaudeRoutingDecision
    ) -> ClaudeRoutingDecision:
        """Validate Claude's routing decision against the whitelist."""
        playbook = session.playbook

        if decision.routing_decision in ("continue", "skip") and decision.next_step:
            if decision.next_step not in playbook.steps:
                logger.warning(
                    f"Invalid next_step '{decision.next_step}' not in playbook {playbook.id}. "
                    f"Forcing stop."
                )
                decision.routing_decision = "stop"
                decision.stop_reason = f"Routing validation failed: step '{decision.next_step}' not in playbook."

        if decision.routing_decision == "switch" and decision.switch_playbook_id:
            if decision.switch_playbook_id not in playbook.alternate_playbooks:
                logger.warning(
                    f"Invalid switch target '{decision.switch_playbook_id}'. Forcing stop."
                )
                decision.routing_decision = "stop"
                decision.stop_reason = f"Routing validation failed: playbook '{decision.switch_playbook_id}' not in alternate_playbooks."

        return decision

    async def _wait_for_dba_decision(
        self, session: SessionData, timeout: float = 1200.0
    ) -> Optional[dict]:
        """Block until DBA submits a decision or timeout expires."""
        event = asyncio.Event()
        session.pending_event = event
        session.dba_decision_result = None

        try:
            await asyncio.wait_for(event.wait(), timeout=timeout)
            return session.dba_decision_result
        except asyncio.TimeoutError:
            session.state = "TIMEOUT"
            await self._emit(session, "timeout", {
                "session_id": session.session_id,
                "iteration": session.iteration,
                "message": "Session expired waiting for DBA decision.",
            })
            return None
        finally:
            session.pending_event = None

    async def _handle_claude_error(self, session: SessionData, error_msg: str):
        """Emit error event when Claude exhausts retries."""
        session.state = "ERROR"
        await self._emit(session, "error", {
            "error_code": "CLAUDE_MALFORMED_RESPONSE",
            "message": f"Claude could not determine the next step after {settings.max_claude_retries + 1} attempts. Session stopped. Completed steps are saved.",
            "technical_detail": error_msg,
            "recoverable": True,
        })

    async def _emit(self, session: SessionData, event_type: str, data: dict):
        """Put an SSE event onto the session's queue."""
        event = {
            "event": event_type,
            "data": {**data, "session_id": session.session_id},
        }
        await session.sse_queue.put(event)
        logger.debug(f"SSE [{session.session_id}] → {event_type}")

    def _build_checkpoint_log(
        self,
        session: SessionData,
        result,
        decision: ClaudeRoutingDecision,
        dba_result: Optional[dict],
    ) -> CheckpointLogEntry:
        timing = session.step_timings.get(result.step_id, {"active": 0, "wait": 0})
        return CheckpointLogEntry(
            iteration=session.iteration,
            step_id=result.step_id,
            step_description=result.step_description,
            row_count=result.row_count,
            claude_assessment=decision.assessment,
            claude_recommendation=decision.next_step or decision.switch_playbook_id or decision.stop_reason,
            routing_decision=decision.routing_decision,
            rationale=decision.rationale,
            interactive_summary=decision.interactive_summary,
            skipped_steps=decision.skip_steps,
            dba_decision=dba_result["dba_decision"] if dba_result else None,
            dba_selected_step=dba_result.get("dba_selected_step") if dba_result else None,
            dba_selected_playbook=dba_result.get("dba_selected_playbook") if dba_result else None,
            dba_override_reason=dba_result.get("dba_override_reason") if dba_result else None,
            mode=session.mode,
            active_duration=timing["active"],
            wait_duration=timing["wait"],
        )

    def _build_response(self, session: SessionData):
        from app.models.schemas import DiagnoseResponse, FinalAnalysis
        analysis = session.final_analysis or FinalAnalysis(
            summary="Session ended before analysis could be generated.",
            key_findings=[],
            recommended_actions=[],
            severity="medium",
            severity_rationale="Session did not complete normally.",
            confidence="low",
            steps_executed=session.steps_executed,
            steps_skipped=session.steps_skipped,
        )
        return DiagnoseResponse(
            session_id=session.session_id,
            mode=session.mode,
            intent_category=session.intent_category or "live_triage",
            detected_dbms=session.dbms,
            playbook_used={
                "id": session.playbook.id,
                "title": session.playbook.title,
                "version": session.playbook.version,
                "author": session.playbook.author,
            },
            time_reference=session.time_reference,
            checkpoint_log=session.checkpoint_log,
            steps_executed=session.steps_executed,
            steps_skipped=session.steps_skipped,
            dba_overrides=session.count_dba_overrides(),
            analysis=analysis,
        )


# End of checkpoint_loop.py
