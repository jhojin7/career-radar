from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration required by commands that interact with Google Cloud."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    gcp_project_id: str = Field(min_length=1)
    gcp_region: str = "asia-northeast3"
    bigquery_dataset: str = "career_radar"
    gcs_bucket: str | None = None
    gemini_model: str = "gemini-2.5-flash"


@lru_cache
def load_settings() -> Settings:
    """Load and validate configuration once per process."""

    return Settings()
