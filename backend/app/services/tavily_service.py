import asyncio
import logging
from typing import Any, Dict, List

from tavily import (
    AsyncTavilyClient,
    BadRequestError,
    InvalidAPIKeyError,
    MissingAPIKeyError,
    UsageLimitExceededError,
)

from app.config import Settings
from app.exceptions import (
    ExternalRateLimitError,
    ExternalServiceError,
    ExternalTimeoutError,
    MissingConfigurationError,
)

logger = logging.getLogger("researchpilot.tavily")


class TavilyService:
    """Async wrapper around the official Tavily Python SDK."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _build_client(self) -> AsyncTavilyClient:
        if not self.settings.tavily_configured:
            raise MissingConfigurationError(["TAVILY_API_KEY"])
        return AsyncTavilyClient(api_key=self.settings.tavily_api_key.strip())

    async def search_single(
        self,
        client: AsyncTavilyClient,
        query: str,
        search_depth: str = "advanced",
        max_results: int = 5,
    ) -> List[Dict[str, Any]]:
        try:
            response = await asyncio.wait_for(
                client.search(
                    query=query,
                    search_depth=search_depth,
                    max_results=max_results,
                    include_answer=False,
                    include_raw_content=False,
                    timeout=float(self.settings.request_timeout_seconds),
                ),
                timeout=float(self.settings.request_timeout_seconds + 5),
            )
        except asyncio.TimeoutError as exc:
            logger.warning("Tavily search timed out for query=%r", query)
            raise ExternalTimeoutError("Tavily") from exc
        except UsageLimitExceededError as exc:
            logger.warning("Tavily usage/rate limit exceeded: %s", exc)
            raise ExternalRateLimitError("Tavily", str(exc)) from exc
        except (InvalidAPIKeyError, MissingAPIKeyError) as exc:
            logger.error("Tavily authentication error: %s", exc)
            raise ExternalServiceError(
                "Tavily", "Invalid Tavily API key. Please verify TAVILY_API_KEY."
            ) from exc
        except BadRequestError as exc:
            logger.warning("Tavily bad request for query=%r: %s", query, exc)
            raise ExternalServiceError("Tavily", str(exc)) from exc
        except Exception as exc:
            message = str(exc)
            if "429" in message or "rate limit" in message.lower():
                raise ExternalRateLimitError("Tavily", message) from exc
            logger.exception("Unexpected Tavily search failure")
            raise ExternalServiceError("Tavily", message) from exc

        results = response.get("results", []) or []
        annotated: List[Dict[str, Any]] = []
        for item in results:
            annotated.append(
                {
                    "title": (item.get("title") or "").strip(),
                    "url": (item.get("url") or "").strip(),
                    "content": (item.get("content") or "").strip(),
                    "score": float(item.get("score") or 0.0),
                    "published_date": item.get("published_date"),
                    "sub_query": query,
                }
            )
        return annotated

    async def search_queries(
        self,
        queries: List[str],
        depth: str = "standard",
    ) -> List[Dict[str, Any]]:
        """Execute multiple Tavily web searches concurrently and combine results."""
        client = self._build_client()
        search_depth = "advanced" if depth == "deep" else "basic"
        max_results = (
            self.settings.max_search_results_per_query + 1
            if depth == "deep"
            else self.settings.max_search_results_per_query
        )

        semaphore = asyncio.Semaphore(4)

        async def _bounded_search(q: str) -> List[Dict[str, Any]]:
            async with semaphore:
                return await self.search_single(
                    client=client,
                    query=q,
                    search_depth=search_depth,
                    max_results=max_results,
                )

        tasks = [_bounded_search(q) for q in queries if q.strip()]
        batches = await asyncio.gather(*tasks, return_exceptions=True)

        combined: List[Dict[str, Any]] = []
        errors: List[Exception] = []
        for batch in batches:
            if isinstance(batch, Exception):
                errors.append(batch)
            else:
                combined.extend(batch)

        if not combined and errors:
            first_err = errors[0]
            if isinstance(
                first_err,
                (
                    MissingConfigurationError,
                    ExternalRateLimitError,
                    ExternalTimeoutError,
                    ExternalServiceError,
                ),
            ):
                raise first_err
            raise ExternalServiceError("Tavily", str(first_err))

        return combined
