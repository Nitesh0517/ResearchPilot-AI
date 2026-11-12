import asyncio
import json
import logging
import re
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Query, Request, Response
from fastapi.responses import StreamingResponse

from app.exceptions import AppError
from app.models.research import (
    DeleteResponse,
    FollowUpRequest,
    HistoryResponse,
    ResearchReport,
    ResearchRequest,
)
from app.services.pdf_service import generate_report_pdf

logger = logging.getLogger("researchpilot.routes")

router = APIRouter(prefix="/research", tags=["Research"])


def _format_sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("", response_model=ResearchReport)
async def create_research(payload: ResearchRequest, request: Request) -> ResearchReport:
    orchestrator = request.app.state.orchestrator
    return await orchestrator.run_research(
        query=payload.query,
        depth=payload.depth,
        focus=payload.focus,
    )


@router.post("/stream")
async def stream_research(payload: ResearchRequest, request: Request) -> StreamingResponse:
    orchestrator = request.app.state.orchestrator
    orchestrator._validate_api_keys()

    queue: asyncio.Queue = asyncio.Queue()

    async def on_step(step_payload: dict) -> None:
        await queue.put(("step", step_payload))

    async def worker() -> None:
        try:
            report = await orchestrator.run_research(
                query=payload.query,
                depth=payload.depth,
                focus=payload.focus,
                on_step=on_step,
            )
            await queue.put(("complete", {"report": report.model_dump()}))
        except AppError as exc:
            await queue.put(
                (
                    "error",
                    {
                        "status_code": exc.status_code,
                        "error_code": exc.error_code,
                        "message": exc.detail,
                        "missing_keys": exc.missing_keys,
                    },
                )
            )
        except Exception as exc:
            logger.exception("Unhandled error during streamed research")
            await queue.put(
                (
                    "error",
                    {
                        "status_code": 500,
                        "error_code": "INTERNAL_ERROR",
                        "message": str(exc) or "Unexpected error in research pipeline.",
                        "missing_keys": [],
                    },
                )
            )
        finally:
            await queue.put(("done", None))

    task = asyncio.create_task(worker())

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            while True:
                event_type, data = await queue.get()
                if event_type == "done":
                    break
                yield _format_sse(event_type, data)
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/follow-up", response_model=ResearchReport)
async def create_follow_up(payload: FollowUpRequest, request: Request) -> ResearchReport:
    orchestrator = request.app.state.orchestrator
    return await orchestrator.run_follow_up(
        parent_research_id=payload.parent_research_id,
        query=payload.query,
    )


@router.post("/follow-up/stream")
async def stream_follow_up(payload: FollowUpRequest, request: Request) -> StreamingResponse:
    orchestrator = request.app.state.orchestrator
    orchestrator._validate_api_keys()

    queue: asyncio.Queue = asyncio.Queue()

    async def on_step(step_payload: dict) -> None:
        await queue.put(("step", step_payload))

    async def worker() -> None:
        try:
            report = await orchestrator.run_follow_up(
                parent_research_id=payload.parent_research_id,
                query=payload.query,
                on_step=on_step,
            )
            await queue.put(("complete", {"report": report.model_dump()}))
        except AppError as exc:
            await queue.put(
                (
                    "error",
                    {
                        "status_code": exc.status_code,
                        "error_code": exc.error_code,
                        "message": exc.detail,
                        "missing_keys": exc.missing_keys,
                    },
                )
            )
        except Exception as exc:
            logger.exception("Unhandled error during streamed follow-up")
            await queue.put(
                (
                    "error",
                    {
                        "status_code": 500,
                        "error_code": "INTERNAL_ERROR",
                        "message": str(exc) or "Unexpected error in follow-up pipeline.",
                        "missing_keys": [],
                    },
                )
            )
        finally:
            await queue.put(("done", None))

    task = asyncio.create_task(worker())

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            while True:
                event_type, data = await queue.get()
                if event_type == "done":
                    break
                yield _format_sse(event_type, data)
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    request: Request,
    q: Optional[str] = Query(default=None, max_length=200),
) -> HistoryResponse:
    repository = request.app.state.repository
    items = await repository.list_history(query=q)
    return HistoryResponse(
        items=items,
        total=len(items),
        storage_mode=repository.storage_mode,
    )


@router.get("/{research_id}", response_model=ResearchReport)
async def get_research_report(research_id: str, request: Request) -> ResearchReport:
    repository = request.app.state.repository
    return await repository.get_report(research_id)


@router.get("/{research_id}/pdf")
async def download_research_pdf(research_id: str, request: Request) -> Response:
    repository = request.app.state.repository
    report = await repository.get_report(research_id)
    pdf_bytes = generate_report_pdf(report)
    slug = re.sub(r"[^a-z0-9]+", "-", report.title.lower()).strip("-")[:50] or "report"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="researchpilot-{slug}.pdf"',
        },
    )


@router.delete("/{research_id}", response_model=DeleteResponse)
async def delete_research_report(research_id: str, request: Request) -> DeleteResponse:
    repository = request.app.state.repository
    await repository.delete_report(research_id)
    return DeleteResponse(deleted=True, research_id=research_id)
