from datetime import datetime, timezone

from fastapi import APIRouter, Request

from app.models.research import EnvironmentStatus, HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def get_health(request: Request) -> HealthResponse:
    settings = request.app.state.settings
    repository = request.app.state.repository

    env_status = EnvironmentStatus(
        tavily_configured=settings.tavily_configured,
        gemini_configured=settings.gemini_configured,
        mongodb_configured=settings.mongodb_configured,
        mongodb_status=repository.mongodb_status,
        gemini_model=settings.gemini_model,
    )

    overall_status = (
        "healthy"
        if settings.tavily_configured and settings.gemini_configured
        else "configuration_required"
    )

    return HealthResponse(
        status=overall_status,
        service=settings.app_name,
        version=settings.app_version,
        environment=env_status,
        storage_mode=repository.storage_mode,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
