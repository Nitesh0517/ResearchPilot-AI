from typing import List, Optional


class AppError(Exception):
    """Base application exception mapped to structured JSON HTTP errors."""

    def __init__(
        self,
        detail: str,
        status_code: int = 500,
        error_code: str = "INTERNAL_ERROR",
        missing_keys: Optional[List[str]] = None,
    ) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code
        self.error_code = error_code
        self.missing_keys = missing_keys or []


class MissingConfigurationError(AppError):
    """Raised when required external API keys are not configured."""

    def __init__(self, missing_keys: List[str]) -> None:
        keys_str = ", ".join(missing_keys)
        super().__init__(
            detail=(
                f"Missing required API configuration: {keys_str}. "
                "Please set these keys in your .env file and restart the backend server."
            ),
            status_code=503,
            error_code="CONFIGURATION_MISSING",
            missing_keys=missing_keys,
        )


class ExternalRateLimitError(AppError):
    """Raised when an upstream API (Tavily or Gemini) returns a rate limit error."""

    def __init__(self, provider: str, detail: Optional[str] = None) -> None:
        super().__init__(
            detail=detail or f"{provider} rate limit exceeded. Please wait briefly and try again.",
            status_code=429,
            error_code="RATE_LIMIT_EXCEEDED",
        )


class ExternalTimeoutError(AppError):
    """Raised when an upstream API call exceeds the configured timeout."""

    def __init__(self, provider: str) -> None:
        super().__init__(
            detail=f"{provider} request timed out. Please try a narrower query or retry.",
            status_code=504,
            error_code="UPSTREAM_TIMEOUT",
        )


class ExternalServiceError(AppError):
    """Raised when an upstream API fails unexpectedly."""

    def __init__(self, provider: str, detail: str) -> None:
        super().__init__(
            detail=f"{provider} error: {detail}",
            status_code=502,
            error_code="UPSTREAM_ERROR",
        )


class ReportNotFoundError(AppError):
    """Raised when a requested research session ID does not exist."""

    def __init__(self, research_id: str) -> None:
        super().__init__(
            detail=f"Research report '{research_id}' was not found.",
            status_code=404,
            error_code="REPORT_NOT_FOUND",
        )
