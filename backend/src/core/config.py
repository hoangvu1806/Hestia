from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_prefix="HESTIA_",
        extra="ignore",
    )

    app_name: str = "Hestia API"
    adk_app_name: str = "hestia"
    version: str = "0.2.0"
    environment: Literal["local", "test", "staging", "production"] = "local"
    api_v1_prefix: str = "/api/v1"
    host: str = "0.0.0.0"
    port: int = 8484
    log_level: str = "INFO"
    docs_enabled: bool = True
    cors_origins: str = "http://localhost:3434,http://127.0.0.1:3434"
    auth_required: bool = True
    firebase_credentials: Path | None = None
    session_db_path: Path = BACKEND_DIR / ".runtime" / "sessions.sqlite3"
    max_inline_file_bytes: int = 8 * 1024 * 1024
    max_llm_calls: int = 12

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @field_validator("session_db_path", mode="after")
    @classmethod
    def resolve_session_db_path(cls, value: Path) -> Path:
        return value if value.is_absolute() else BACKEND_DIR / value

    @field_validator("firebase_credentials", mode="after")
    @classmethod
    def resolve_firebase_credentials(cls, value: Path | None) -> Path | None:
        if value is None or value.is_absolute():
            return value
        return BACKEND_DIR / value


@lru_cache
def get_settings() -> Settings:
    return Settings()
