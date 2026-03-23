"""
Napkin Backend — Core Settings
All configuration loaded from environment variables with validation.
"""

from enum import StrEnum
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(StrEnum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class LLMProvider(StrEnum):
    ANTHROPIC = "anthropic"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- App ---
    app_env: Environment = Environment.DEVELOPMENT
    app_debug: bool = False
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    app_secret_key: str  # Must be set via environment variable — no default intentional

    # --- Supabase ---
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str = ""

    # --- LLM (Anthropic Claude) ---
    anthropic_api_key: str = ""
    llm_default_provider: LLMProvider = LLMProvider.ANTHROPIC
    llm_default_model: str = "claude-sonnet-4-20250514"
    llm_temperature: float = 0.1

    # --- Embeddings (local HuggingFace) ---
    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dimensions: int = 384

    # --- Redis ---
    redis_url: str = "redis://localhost:6379/0"

    # --- GitHub ---
    github_app_id: str = ""
    github_app_private_key: str = ""
    github_personal_access_token: str = ""

    # --- Observability ---
    sentry_dsn: str = ""
    log_level: str = "INFO"

    # --- Rate Limits ---
    rate_limit_per_minute: int = 60
    max_feedback_items_per_session: int = 500
    max_session_duration_minutes: int = 60

    @field_validator("app_secret_key")
    @classmethod
    def validate_secret_key(cls, v: str, info) -> str:
        if info.data.get("app_env") == Environment.PRODUCTION and v == "change-me-in-production":
            raise ValueError("Must set a real secret key in production")
        return v

    @property
    def is_production(self) -> bool:
        return self.app_env == Environment.PRODUCTION


@lru_cache
def get_settings() -> Settings:
    return Settings()
