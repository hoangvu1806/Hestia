from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BACKEND_DIR / ".env", BACKEND_DIR / ".env.local"),
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
    firebase_credentials_path: Path = (
        BACKEND_DIR / "secrets" / "firebase" / "service-account.json"
    )
    firebase_project_id: str = "hestia-4409b"
    themealdb_api_key: str = "1"
    usda_api_key: str = "DEMO_KEY"
    session_database_url: str
    max_inline_file_bytes: int = 8 * 1024 * 1024
    max_llm_calls: int = 12

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def food_database_url(self) -> str:
        """Return the synchronous PostgreSQL URL used by food intelligence queries."""
        prefix = "postgresql+asyncpg://"
        if not self.session_database_url.startswith(prefix):
            raise ValueError("HESTIA_SESSION_DATABASE_URL must use postgresql+asyncpg://")
        return "postgresql://" + self.session_database_url.removeprefix(prefix)

    @field_validator("firebase_credentials_path", mode="after")
    @classmethod
    def resolve_local_path(cls, value: Path) -> Path:
        return value if value.is_absolute() else BACKEND_DIR / value


@lru_cache
def get_settings() -> Settings:
    return Settings()
