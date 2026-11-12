import asyncio
import logging
import re
from typing import Type, TypeVar

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.config import Settings
from app.exceptions import (
    ExternalRateLimitError,
    ExternalServiceError,
    ExternalTimeoutError,
    MissingConfigurationError,
)

logger = logging.getLogger("researchpilot.gemini")

T = TypeVar("T", bound=BaseModel)


def _strip_markdown_fences(raw_text: str) -> str:
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


class GeminiService:
    """Async service built on the current Google Gen AI SDK (`google-genai`)."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.last_model_used: str = settings.gemini_model

    def _ensure_configured(self) -> str:
        if not self.settings.gemini_configured:
            raise MissingConfigurationError(["GEMINI_API_KEY"])
        return self.settings.gemini_api_key.strip()

    async def generate_structured(
        self,
        *,
        system_instruction: str,
        prompt: str,
        response_model: Type[T],
        temperature: float = 0.2,
    ) -> T:
        """Generate a schema-validated Pydantic object using Gemini async client."""
        api_key = self._ensure_configured()
        candidates = self.settings.gemini_model_candidates
        last_error: Exception | None = None
        response = None

        async with genai.Client(api_key=api_key).aio as aclient:
            for model_name in candidates:
                try:
                    response = await asyncio.wait_for(
                        aclient.models.generate_content(
                            model=model_name,
                            contents=prompt,
                            config=types.GenerateContentConfig(
                                system_instruction=system_instruction,
                                temperature=temperature,
                                response_mime_type="application/json",
                                response_json_schema=response_model.model_json_schema(),
                            ),
                        ),
                        timeout=float(self.settings.request_timeout_seconds),
                    )
                    self.last_model_used = model_name
                    break
                except asyncio.TimeoutError:
                    logger.warning(
                        "Gemini request timed out on model=%s after %ss",
                        model_name,
                        self.settings.request_timeout_seconds,
                    )
                    last_error = ExternalTimeoutError("Google Gemini")
                    continue
                except genai_errors.APIError as exc:
                    status_code = getattr(exc, "code", None)
                    msg = str(exc)
                    if status_code == 429 or "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower():
                        logger.warning(
                            "Gemini model %s rate-limited (%s); trying fallback if available.",
                            model_name,
                            status_code,
                        )
                        last_error = ExternalRateLimitError("Google Gemini", msg)
                        continue
                    if status_code in (404, 503):
                        logger.warning(
                            "Gemini model %s unavailable (%s); trying fallback if available.",
                            model_name,
                            status_code,
                        )
                        last_error = ExternalServiceError("Google Gemini", msg)
                        continue
                    logger.error("Gemini API error (%s): %s", status_code, msg)
                    raise ExternalServiceError("Google Gemini", msg) from exc
                except Exception as exc:
                    msg = str(exc)
                    if "429" in msg or "RESOURCE_EXHAUSTED" in msg or "rate limit" in msg.lower():
                        last_error = ExternalRateLimitError("Google Gemini", msg)
                        continue
                    logger.exception("Unexpected Gemini failure")
                    raise ExternalServiceError("Google Gemini", msg) from exc

        if response is None:
            if last_error is not None:
                raise last_error
            raise ExternalServiceError("Google Gemini", "No Gemini model candidates succeeded.")

        raw_text = getattr(response, "text", None) or ""
        if not raw_text.strip():
            raise ExternalServiceError(
                "Google Gemini", "Gemini returned an empty response."
            )

        cleaned_json = _strip_markdown_fences(raw_text)
        try:
            return response_model.model_validate_json(cleaned_json)
        except ValidationError as exc:
            logger.error("Gemini JSON schema validation failed: %s", exc)
            raise ExternalServiceError(
                "Google Gemini",
                "Model output did not match the required structured report schema.",
            ) from exc
