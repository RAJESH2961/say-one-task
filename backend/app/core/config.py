from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    APP_NAME: str = "FocusFlow API"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: Literal["development", "test", "production"] = "development"
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = Field(..., description="SQLAlchemy URL, e.g. postgresql+psycopg://user:pass@host/db")
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_ECHO: bool = False

    SECRET_KEY: str = Field(..., min_length=32)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    CORS_ORIGINS: str = "http://localhost:5173"

    LOG_LEVEL: str | None = None
    LOG_DIR: Path = BACKEND_DIR / "logs"
    LOG_MAX_BYTES: int = 10 * 1024 * 1024
    LOG_BACKUP_COUNT: int = 10
    LOG_TO_CONSOLE: bool = True
    LOG_JSON_CONSOLE: bool = True
    LOG_HEALTH_CHECKS: bool = False

    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_DEFAULT: str = "300/minute"
    RATE_LIMIT_AUTH: str = "10/minute"
    RATE_LIMIT_STORAGE_URI: str = "memory://"
    RATE_LIMIT_AI: str = "15/minute"

    # Groq (OpenAI-compatible) API for the AI coach. AI features are disabled when unset.
    GROQ_API_KEY: str | None = None
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    AI_TIMEOUT_SECONDS: float = 30.0

    # Grace period (seconds) tolerated between client and server clocks when completing a session.
    SESSION_COMPLETION_GRACE_SECONDS: int = 3

    @field_validator("LOG_DIR", mode="before")
    @classmethod
    def _resolve_log_dir(cls, v: str | Path) -> Path:
        path = Path(v)
        return path if path.is_absolute() else BACKEND_DIR / path

    @model_validator(mode="after")
    def _default_log_level(self) -> "Settings":
        if not self.LOG_LEVEL:
            self.LOG_LEVEL = "INFO" if self.ENVIRONMENT == "production" else "DEBUG"
        self.LOG_LEVEL = self.LOG_LEVEL.upper()
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
