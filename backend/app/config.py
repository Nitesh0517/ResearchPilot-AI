from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Application settings loaded from environment variables and .env files."""

    app_name: str = "ResearchPilot AI"
    app_version: str = "1.0.0"

    tavily_api_key: str = ""
    gemini_api_key: str = ""
    mongodb_uri: str = ""
    mongodb_db_name: str = "researchpilot_ai"

    gemini_model: str = "gemini-3.5-flash-lite"
    gemini_fallback_models: str = "gemini-3.1-flash-lite,gemini-3.6-flash,gemini-3.5-flash,gemini-3.7-flash,gemini-3.8-flash"
    request_timeout_seconds: int = 45
    max_search_results_per_query: int = 5
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    local_history_file: str = str(BACKEND_DIR / "data" / "research_history.json")

    model_config = SettingsConfigDict(
        env_file=(str(ROOT_DIR / ".env"), str(BACKEND_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @staticmethod
    def _is_non_placeholder(value: str) -> bool:
        cleaned = (value or "").strip()
        if not cleaned:
            return False
        lowered = cleaned.lower()
        return not (
            lowered.startswith("your_")
            or lowered.startswith("<your")
            or lowered in {"changeme", "placeholder", "none", "null"}
        )

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def gemini_model_candidates(self) -> List[str]:
        candidates = [self.gemini_model.strip()]
        for item in self.gemini_fallback_models.split(","):
            cleaned = item.strip()
            if cleaned and cleaned not in candidates:
                candidates.append(cleaned)
        return [c for c in candidates if c]

    @property
    def tavily_configured(self) -> bool:
        return self._is_non_placeholder(self.tavily_api_key)

    @property
    def gemini_configured(self) -> bool:
        return self._is_non_placeholder(self.gemini_api_key)

    @property
    def mongodb_configured(self) -> bool:
        cleaned = (self.mongodb_uri or "").strip().lower()
        return cleaned.startswith("mongodb://") or cleaned.startswith("mongodb+srv://")

    def missing_research_keys(self) -> List[str]:
        missing: List[str] = []
        if not self.tavily_configured:
            missing.append("TAVILY_API_KEY")
        if not self.gemini_configured:
            missing.append("GEMINI_API_KEY")
        return missing


@lru_cache
def get_settings() -> Settings:
    return Settings()
