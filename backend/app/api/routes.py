"""
API Router
----------
All FastAPI endpoints:
  POST /api/v1/diagnose
  GET  /api/v1/diagnose/{session_id}/stream   (SSE)
  POST /api/v1/diagnose/{session_id}/checkpoint/{iteration}/decision
  POST /api/v1/sse-token
  GET  /api/v1/playbooks
  GET  /api/v1/playbooks/{id}
  GET  /api/v1/session/{id}
  GET  /api/v1/sessions
  GET  /api/v1/health
"""
import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse, JSONResponse

from app.models.schemas import (
    DiagnoseRequest, SseTokenRequest, SseTokenResponse,
    CheckpointDecisionRequest, ShareReportRequest,
    ChatRequest, ChatResponse,
)
from app.services.session_store import session_store
from app.services.checkpoint_loop import CheckpointLoop
from app.services.mock_data_service import MockDataService
from app.services.playbook_service import PlaybookService
from app.services.claude_client import ClaudeClient
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter()

# ── Dependency injection ──────────────────────────────────────────────────────

def get_checkpoint_loop() -> CheckpointLoop:
    mock_svc = MockDataService(use_gcs=False)
    playbook_svc = PlaybookService(use_firestore=False)
    claude = ClaudeClient()
    return CheckpointLoop(mock_svc, playbook_svc, claude)

def get_playbook_service() -> PlaybookService:
    return PlaybookService(use_firestore=False)

def get_current_user(request: Request) -> str:
    """
    Auth middleware.
    Local dev (USE_AUTH=false): returns 'local-dev-user'.
    Production: validates Firebase JWT from Authorization header.
    """
    if not settings.use_auth:
        return "local-dev-user"

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = auth_header.split(" ", 1)[1]
    try:
        import firebase_admin.auth as fb_auth
        decoded = fb_auth.verify_id_token(token)
        return decoded["uid"]
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


def validate_sse_token(token: str, session_id: str) -> str:
    """Validate a pre-flight SSE token. Returns uid."""
    if not settings.use_auth:
        return "local-dev-user"
    try:
        from jose import jwt
        payload = jwt.decode(
            token,
            settings.sse_secret_key,
            algorithms=["HS256"],
        )
        if payload.get("session_id") != session_id:
            raise HTTPException(status_code=401, detail="SSE token session mismatch")
        uid = payload.get("uid")
        # Mark token as used (simple — store used tokens in session)
        return uid
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid SSE token: {e}")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "5.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "use_mock_data": settings.use_mock_data,
        "use_auth": settings.use_auth,
    }


@router.post("/sse-token", response_model=SseTokenResponse)
async def issue_sse_token(
    body: SseTokenRequest,
    dba_uid: str = Depends(get_current_user),
):
    """Issue a short-lived SSE token for a specific session."""
    if not settings.use_auth:
        return SseTokenResponse(sse_token="local-dev-no-auth", expires_in=3600)

    from jose import jwt
    payload = {
        "uid": dba_uid,
        "session_id": body.session_id,
        "exp": datetime.utcnow() + timedelta(seconds=settings.sse_token_ttl_seconds),
    }
    token = jwt.encode(payload, settings.sse_secret_key, algorithm="HS256")
    return SseTokenResponse(sse_token=token, expires_in=settings.sse_token_ttl_seconds)


@router.post("/diagnose")
async def diagnose(
    request: DiagnoseRequest,
    background_tasks: BackgroundTasks,
    dba_uid: str = Depends(get_current_user),
    loop: CheckpointLoop = Depends(get_checkpoint_loop),
):
    """
    Start a diagnostic session.
    Returns immediately with session_id.
    Checkpoint loop runs in the background.
    Results stream via SSE at /diagnose/{session_id}/stream.
    """
    try:
        session = await loop.start_session(request, dba_uid=dba_uid)
        background_tasks.add_task(loop.run_loop, session)
        return {
            "session_id": session.session_id,
            "status": "started",
            "playbook": session.playbook.id,
            "dbms": session.dbms,
            "mode": session.mode,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(f"Failed to start session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start session: {e}")


@router.get("/diagnose/{session_id}/stream")
async def sse_stream(
    session_id: str,
    request: Request,
    token: str = "local-dev-no-auth",
):
    """
    SSE stream for real-time checkpoint events.
    Client opens this URL after POST /diagnose returns.
    """
    uid = validate_sse_token(token, session_id)

    session = await session_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if settings.use_auth and session.dba_uid != uid:
        raise HTTPException(status_code=403, detail="Not your session")

    async def event_generator():
        try:
            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    logger.info(f"SSE client disconnected: {session_id}")
                    break

                try:
                    event = await asyncio.wait_for(
                        session.sse_queue.get(), timeout=30.0
                    )
                except asyncio.TimeoutError:
                    # Send keepalive comment
                    yield ": keepalive\n\n"
                    continue

                if event is None:
                    # Session complete — close stream
                    yield "event: stream_end\ndata: {}\n\n"
                    break

                event_type = event.get("event", "message")
                data = json.dumps(event.get("data", {}))
                yield f"event: {event_type}\ndata: {data}\n\n"

        except Exception as e:
            logger.exception(f"SSE error for {session_id}: {e}")
            yield f"event: error\ndata: {json.dumps({'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/diagnose/{session_id}/checkpoint/{iteration}/decision")
async def submit_checkpoint_decision(
    session_id: str,
    iteration: int,
    body: CheckpointDecisionRequest,
    dba_uid: str = Depends(get_current_user),
    loop: CheckpointLoop = Depends(get_checkpoint_loop),
):
    """Submit a DBA decision for a pending Interactive Mode checkpoint."""
    session = await session_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Ownership check (spec section 5.5)
    if settings.use_auth and session.dba_uid != dba_uid:
        raise HTTPException(status_code=403, detail="Not your session")

    if session.state != "PENDING_APPROVAL":
        raise HTTPException(
            status_code=409,
            detail=f"Session is not awaiting approval (current state: {session.state})"
        )

    # Validate DBA-selected step against whitelist
    if body.dba_decision == "redirected" and body.dba_selected_step:
        if body.dba_selected_step not in session.playbook.steps:
            raise HTTPException(
                status_code=400,
                detail=f"Step '{body.dba_selected_step}' not found in current playbook"
            )

    if body.dba_decision == "switched_playbook" and body.dba_selected_playbook:
        if body.dba_selected_playbook not in session.playbook.alternate_playbooks:
            raise HTTPException(
                status_code=400,
                detail=f"Playbook '{body.dba_selected_playbook}' not in alternate_playbooks"
            )

    success = await loop.submit_dba_decision(
        session_id=session_id,
        dba_uid=dba_uid,
        decision_data=body.model_dump(),
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to submit decision")

    return {"status": "accepted", "dba_decision": body.dba_decision}


@router.get("/session/{session_id}")
async def get_session(
    session_id: str,
    dba_uid: str = Depends(get_current_user),
):
    """Get session state. Returns in-flight state for active sessions."""
    session = await session_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if settings.use_auth and session.dba_uid != dba_uid:
        raise HTTPException(status_code=403, detail="Not your session")

    return {
        "session_id": session.session_id,
        "state": session.state,
        "mode": session.mode,
        "dbms": session.dbms,
        "playbook_id": session.playbook.id,
        "iteration": session.iteration,
        "steps_executed": session.steps_executed,
        "steps_skipped": session.steps_skipped,
        "checkpoint_log": [entry.model_dump() for entry in session.checkpoint_log],
        "analysis": session.final_analysis.model_dump() if session.final_analysis else None,
        "created_at": session.created_at.isoformat() + "Z",
        "server_name": session.server_name,
        "ticket_number": session.ticket_number,
        "question": session.question,
    }


@router.get("/sessions")
async def list_sessions(dba_uid: str = Depends(get_current_user)):
    """List active sessions for the current user."""
    all_ids = await session_store.list_active()
    sessions = []
    for sid in all_ids:
        s = await session_store.get(sid)
        if s and (not settings.use_auth or s.dba_uid == dba_uid):
            sessions.append({
                "session_id": s.session_id,
                "state": s.state,
                "mode": s.mode,
                "dbms": s.dbms,
                "server_name": s.server_name,
                "ticket_number": s.ticket_number,
                "playbook_id": s.playbook.id,
                "severity": s.final_analysis.severity if s.final_analysis else None,
                "created_at": s.created_at.isoformat() + "Z",
            })
    return {"sessions": sessions, "count": len(sessions)}


@router.post("/diagnose/{session_id}/stop")
async def stop_session(session_id: str, dba_uid: str = Depends(get_current_user)):
    """Manually stop/abort an active diagnostic session."""
    session = await session_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if settings.use_auth and session.dba_uid != dba_uid:
        raise HTTPException(status_code=403, detail="Not authorized to modify this session")
    
    # Transition to completed / stopped state
    session.state = "COMPLETED"
    session.touch()
    
    # Push final termination events to client SSE queue
    await session.sse_queue.put({"event": "diagnose_stopped", "data": {"session_id": session_id, "reason": "Manually stopped by user"}})
    await session.sse_queue.put({"event": "close", "data": {}})
    
    logger.info(f"Session {session_id} manually stopped by user.")
    return {"status": "success", "message": "Session stopped successfully"}


@router.get("/playbooks")
async def list_playbooks(
    dbms: Optional[str] = None,
    intent_category: Optional[str] = None,
    playbook_svc: PlaybookService = Depends(get_playbook_service),
):
    playbooks = await playbook_svc.list_playbooks(dbms=dbms, intent_category=intent_category)
    return {
        "playbooks": [
            {
                "id": pb.id,
                "dbms": pb.dbms,
                "intent_category": pb.intent_category,
                "title": pb.title,
                "description": pb.description,
                "entry_step": pb.entry_step,
                "step_count": len(pb.steps),
                "max_steps": pb.max_steps,
            }
            for pb in playbooks
        ]
    }


@router.get("/playbooks/{playbook_id}")
async def get_playbook(
    playbook_id: str,
    playbook_svc: PlaybookService = Depends(get_playbook_service),
):
    pb = await playbook_svc.get_playbook(playbook_id)
    if not pb:
        raise HTTPException(status_code=404, detail=f"Playbook not found: {playbook_id}")
    return pb.model_dump()


@router.post("/sessions/{session_id}/share")
async def share_report(
    session_id: str,
    body: ShareReportRequest,
    dba_uid: str = Depends(get_current_user),
):
    """
    Share the diagnostic report via email.
    In local mock mode, we validate inputs, print/log the sharing event, and return success.
    """
    session = session_store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session not found: {session_id}")

    # Simulating background task / SMTP send
    logger.info(
        f"[EMAIL SHARE] DBA {dba_uid} sharing Session {session_id} report to {body.recipient}."
        f" CC: {body.cc or 'None'}."
        f" Custom message: {body.message or 'None'}"
    )
    print(
        f"\n======================================================\n"
        f"EMAIL SENT TO: {body.recipient}\n"
        f"CC: {body.cc or 'None'}\n"
        f"SUBJECT: DBAtlas Triage Report - Ticket {session.ticket_number} ({session.dbms.upper()})\n"
        f"MESSAGE: {body.message or 'Here is the report.'}\n"
        f"REPORT SUMMARY: {session.final_analysis.summary if session.final_analysis else 'No analysis generated yet.'}\n"
        f"======================================================\n"
    )

    return {
        "status": "success",
        "message": f"Report successfully emailed to {body.recipient}" + (f" (CC: {body.cc})" if body.cc else ""),
    }


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Knowledge base Q&A chat endpoint.
    """
    import os
    try:
        # Robust absolute path resolution for SPECIFICATION.md and AGENTS.md
        spec_path = None
        agents_path = None
        
        spec_candidates = [
            os.path.join(os.getcwd(), "SPECIFICATION.md"),
            os.path.join(os.path.dirname(os.getcwd()), "SPECIFICATION.md"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "SPECIFICATION.md"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "SPECIFICATION.md"),
        ]
        for path in spec_candidates:
            if os.path.exists(path):
                spec_path = path
                break
                
        agents_candidates = [
            os.path.join(os.getcwd(), "AGENTS.md"),
            os.path.join(os.path.dirname(os.getcwd()), "AGENTS.md"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "AGENTS.md"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "AGENTS.md"),
        ]
        for path in agents_candidates:
            if os.path.exists(path):
                agents_path = path
                break
                
        spec_content = ""
        if spec_path:
            try:
                with open(spec_path, "r", encoding="utf-8") as f:
                    spec_content = f.read()
            except Exception as e:
                logger.warning(f"Error reading specification: {e}")
                
        agents_content = ""
        if agents_path:
            try:
                with open(agents_path, "r", encoding="utf-8") as f:
                    agents_content = f.read()
            except Exception as e:
                logger.warning(f"Error reading agents rules: {e}")

        # Combine both specification and agents project rules as the knowledge base
        knowledge_base = f"{agents_content}\n\n{spec_content}"
        if not knowledge_base.strip():
            knowledge_base = "DBAtlas is an AI-powered diagnostic tool for Database Administrators. It uses Claude to route diagnostic steps."

        claude = ClaudeClient()
        anthropic_messages = [{"role": msg.role, "content": msg.content} for msg in request.messages]
        reply = await claude.chat(messages=anthropic_messages, specification_content=knowledge_base)
        return ChatResponse(response=reply)
    except Exception as e:
        logger.exception(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
