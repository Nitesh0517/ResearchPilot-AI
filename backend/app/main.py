import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.agents.orchestrator import ResearchOrchestrator
from app.config import Settings, get_settings
from app.database.repository import ResearchRepository
from app.exceptions import AppError
from app.routes.health import router as health_router
from app.routes.research import router as research_router
from app.services.gemini_service import GeminiService
from app.services.tavily_service import TavilyService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("researchpilot.main")


def create_app(custom_settings: Settings | None = None) -> FastAPI:
    settings = custom_settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        repository = ResearchRepository(settings)
        await repository.initialize()

        tavily_service = TavilyService(settings)
        gemini_service = GeminiService(settings)
        orchestrator = ResearchOrchestrator(
            settings=settings,
            tavily_service=tavily_service,
            gemini_service=gemini_service,
            repository=repository,
        )

        app.state.settings = settings
        app.state.repository = repository
        app.state.tavily_service = tavily_service
        app.state.gemini_service = gemini_service
        app.state.orchestrator = orchestrator

        logger.info(
            "ResearchPilot AI started | tavily=%s | gemini=%s | storage=%s",
            settings.tavily_configured,
            settings.gemini_configured,
            repository.storage_mode,
        )
        yield
        await repository.close()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Autonomous Web Research & Intelligence Agent powered by Tavily and Google Gemini.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": exc.detail,
                "error_code": exc.error_code,
                "missing_keys": exc.missing_keys,
            },
        )

    app.include_router(health_router, prefix="/api")
    app.include_router(research_router, prefix="/api")

    return app


app = create_app()
