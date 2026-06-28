"""
DBA Diagnostic Copilot — Backend
FastAPI application entry point.
"""
import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.services.session_store import session_store
from app.core.config import get_settings

settings = get_settings()

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("DBA Diagnostic Copilot backend starting...")
    logger.info(f"  Auth enabled: {settings.use_auth}")
    logger.info(f"  Mock data:    {settings.use_mock_data}")
    logger.info(f"  Log level:    {settings.log_level}")

    # Background task: clean up stale sessions every 10 minutes
    async def cleanup_task():
        while True:
            await asyncio.sleep(600)
            await session_store.cleanup_stale(max_age_minutes=60)

    task = asyncio.create_task(cleanup_task())

    yield

    task.cancel()
    logger.info("Backend shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="DBA Diagnostic Copilot",
    description="AI-powered checkpoint-driven database diagnostic tool",
    version="5.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level=settings.log_level.lower(),
    )
