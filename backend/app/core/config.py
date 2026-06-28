from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    # Anthropic
    anthropic_api_key: str = ""

    # GCP
    gcp_project_id: str = ""
    gcs_mock_data_bucket: str = "dbms-copilot-mock-data"

    # Auth
    use_auth: bool = False
    firebase_project_id: str = ""

    # SSE
    sse_secret_key: str = "local-dev-secret-change-in-production"
    sse_token_ttl_seconds: int = 60

    # Mock data
    use_mock_data: bool = True

    # Checkpoint loop
    max_claude_retries: int = 2
    max_steps_default: int = 5

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # Logging
    log_level: str = "INFO"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
