import asyncio
import os
import sys

# Set up path so app module can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models.schemas import DiagnoseRequest, SessionMode
from app.services.checkpoint_loop import CheckpointLoop
from app.services.mock_data_service import MockDataService
from app.services.playbook_service import PlaybookService
from app.services.claude_client import ClaudeClient
import json
import traceback

async def main():
    try:
        loop = CheckpointLoop(MockDataService(False), PlaybookService(False), ClaudeClient())
        req = DiagnoseRequest(
            server_name="SQLPROD-02",
            ticket_number="INC123",
            question="this query suddenly got slow after last night's maintenance",
            mode="auto"
        )
        session = await loop.start_session(req, dba_uid="test")
        resp = await loop.run_loop(session)
        with open("test_out.json", "w") as f:
            json.dump({"status": "success", "response": resp.model_dump()}, f)
        print("Success! Output saved to test_out.json")
    except Exception as e:
        with open("test_out.json", "w") as f:
            json.dump({"status": "error", "error": str(e), "traceback": traceback.format_exc()}, f)
        print(f"Error! {e}")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
