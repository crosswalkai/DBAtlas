import asyncio
from app.services.checkpoint_loop import CheckpointLoopService
from app.models.schemas import DiagnosticRequest, SessionMode, DbmsType
from app.services.playbook_service import PlaybookService
import json

async def main():
    playbook_svc = PlaybookService()
    loop_svc = CheckpointLoopService()
    
    req = DiagnosticRequest(
        server_name="SQLPROD-02",
        ticket_number="INC123",
        question="this query suddenly got slow after last night's maintenance",
        mode=SessionMode.AUTO
    )
    
    # 1. Detect Intent
    intent, playbook = await playbook_svc.classify_and_select(req)
    print(f"Playbook: {playbook.id}")
    
    # 2. Init Session
    session = await loop_svc.init_session(req, intent, playbook)
    
    # 3. Run Loop
    try:
        response = await loop_svc.run_loop(session)
        print("Success:", response)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
