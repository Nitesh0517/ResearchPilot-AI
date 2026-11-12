import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Awaitable, Callable, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

from app.agents.processor import process_and_deduplicate_sources, verify_citations
from app.config import Settings
from app.database.repository import ResearchRepository
from app.exceptions import ExternalServiceError, MissingConfigurationError
from app.models.research import (
    AgentStepTrace,
    DetailedAnalysisSection,
    KeyFinding,
    ProcessedSource,
    QueryAnalysis,
    ReportMetadata,
    ResearchPlan,
    ResearchReport,
    StatisticItem,
)
from app.services.gemini_service import GeminiService
from app.services.tavily_service import TavilyService

logger = logging.getLogger("researchpilot.orchestrator")

StepCallback = Optional[Callable[[Dict], Awaitable[None]]]


class _QueryAnalysisAndPlan(BaseModel):
    main_topic: str
    intent: str
    scope: str
    time_sensitivity: str = "current"
    sub_questions: List[str]
    search_queries: List[str]


class _DraftFinding(BaseModel):
    title: str
    retrieved_facts: str
    ai_analysis: str
    confidence: Literal["high", "medium", "limited"] = "medium"
    citation_ids: List[int] = Field(default_factory=list)


class _DraftSection(BaseModel):
    heading: str
    content: str
    evidence_notes: str = ""
    citation_ids: List[int] = Field(default_factory=list)


class _DraftStatistic(BaseModel):
    metric: str
    value: str
    context: str
    citation_id: int


class _GeminiReportDraft(BaseModel):
    title: str
    executive_summary: str
    problem_overview: str
    key_findings: List[_DraftFinding]
    detailed_analysis: List[_DraftSection]
    important_statistics: List[_DraftStatistic] = Field(default_factory=list)
    conclusion: str
    related_questions: List[str] = Field(default_factory=list)


class ResearchOrchestrator:
    """Executes the 9-step autonomous research agent workflow."""

    def __init__(
        self,
        settings: Settings,
        tavily_service: TavilyService,
        gemini_service: GeminiService,
        repository: ResearchRepository,
    ) -> None:
        self.settings = settings
        self.tavily = tavily_service
        self.gemini = gemini_service
        self.repository = repository

    async def _emit(
        self,
        callback: StepCallback,
        trace: List[AgentStepTrace],
        *,
        step_number: int,
        step_key: str,
        title: str,
        status: Literal["running", "completed", "error"],
        summary: str,
        duration_ms: Optional[int] = None,
    ) -> None:
        payload = {
            "step_number": step_number,
            "step_key": step_key,
            "title": title,
            "status": status,
            "summary": summary,
            "duration_ms": duration_ms,
        }
        if status in ("completed", "error"):
            trace.append(AgentStepTrace(**payload))
        if callback is not None:
            await callback(payload)

    def _validate_api_keys(self) -> None:
        missing = self.settings.missing_research_keys()
        if missing:
            raise MissingConfigurationError(missing)

    async def run_research(
        self,
        *,
        query: str,
        depth: Literal["standard", "deep"] = "standard",
        focus: Optional[str] = None,
        parent_report: Optional[ResearchReport] = None,
        on_step: StepCallback = None,
    ) -> ResearchReport:
        self._validate_api_keys()

        pipeline_start = time.perf_counter()
        trace: List[AgentStepTrace] = []
        research_id = str(uuid.uuid4())
        current_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Step 1: Query Input
        t0 = time.perf_counter()
        await self._emit(
            on_step,
            trace,
            step_number=1,
            step_key="query_received",
            title="Query Input",
            status="running",
            summary="Validating research prompt and initializing agent session...",
        )
        mode_label = "follow-up investigation" if parent_report else f"{depth} research"
        await self._emit(
            on_step,
            trace,
            step_number=1,
            step_key="query_received",
            title="Query Input",
            status="completed",
            summary=f"Initialized {mode_label} session ({research_id[:8]}).",
            duration_ms=int((time.perf_counter() - t0) * 1000),
        )

        # Step 2: Query Analyzer & Step 3: Research Planner (single structured Gemini call to reduce latency & quota usage)
        t_analyze = time.perf_counter()
        num_queries = 4 if depth == "deep" else 3
        await self._emit(
            on_step,
            trace,
            step_number=2,
            step_key="query_analyzer",
            title="Query Analyzer",
            status="running",
            summary="Analyzing user intent, core topic, and research scope via Gemini...",
        )
        parent_context = ""
        if parent_report is not None:
            parent_context = (
                f"\nParent Research Title: {parent_report.title}\n"
                f"Parent Main Topic: {parent_report.query_analysis.main_topic}\n"
                f"Parent Executive Summary: {parent_report.executive_summary}\n"
            )
        focus_context = f"\nRequested Focus Angle: {focus}" if focus else ""

        analysis_and_plan = await self.gemini.generate_structured(
            system_instruction=(
                "You are the Query Analyzer and Research Planner agents for ResearchPilot AI. "
                "First, extract the core topic, user intent, analytical scope, and time sensitivity. "
                f"Second, decompose the topic into exactly {num_queries} distinct sub-questions and "
                f"{num_queries} concise, high-signal web search queries suitable for Tavily web search."
            ),
            prompt=(
                f"Current Date: {current_date}\n"
                f"User Research Query: {query}"
                f"{focus_context}{parent_context}"
            ),
            response_model=_QueryAnalysisAndPlan,
            temperature=0.15,
        )

        query_analysis = QueryAnalysis(
            main_topic=analysis_and_plan.main_topic,
            intent=analysis_and_plan.intent,
            scope=analysis_and_plan.scope,
            time_sensitivity=analysis_and_plan.time_sensitivity,
        )
        await self._emit(
            on_step,
            trace,
            step_number=2,
            step_key="query_analyzer",
            title="Query Analyzer",
            status="completed",
            summary=f"Identified core topic: {query_analysis.main_topic}",
            duration_ms=int((time.perf_counter() - t_analyze) * 1000),
        )

        t_plan = time.perf_counter()
        await self._emit(
            on_step,
            trace,
            step_number=3,
            step_key="research_planner",
            title="Research Planner",
            status="running",
            summary=f"Decomposing topic into {num_queries} targeted web search queries...",
        )
        search_queries = [q.strip() for q in analysis_and_plan.search_queries if q.strip()][
            :num_queries
        ]
        if not search_queries:
            search_queries = [query]
        plan = ResearchPlan(
            sub_questions=analysis_and_plan.sub_questions[:num_queries] or [query],
            search_queries=search_queries,
        )
        await self._emit(
            on_step,
            trace,
            step_number=3,
            step_key="research_planner",
            title="Research Planner",
            status="completed",
            summary=f"Planned {len(plan.search_queries)} search queries across distinct angles.",
            duration_ms=max(1, int((time.perf_counter() - t_plan) * 1000)),
        )

        # Step 4: Tavily Search Agent
        t0 = time.perf_counter()
        await self._emit(
            on_step,
            trace,
            step_number=4,
            step_key="tavily_search",
            title="Tavily Search Agent",
            status="running",
            summary=f"Executing {len(plan.search_queries)} live Tavily web searches...",
        )
        raw_results = await self.tavily.search_queries(plan.search_queries, depth=depth)
        await self._emit(
            on_step,
            trace,
            step_number=4,
            step_key="tavily_search",
            title="Tavily Search Agent",
            status="completed",
            summary=f"Retrieved {len(raw_results)} raw web results from Tavily.",
            duration_ms=int((time.perf_counter() - t0) * 1000),
        )

        # Step 5: Information Processing
        t0 = time.perf_counter()
        await self._emit(
            on_step,
            trace,
            step_number=5,
            step_key="information_processing",
            title="Information Processing",
            status="running",
            summary="Cleaning snippets, canonicalizing URLs, and deduplicating sources...",
        )
        max_sources = 14 if depth == "deep" else 10
        sources: List[ProcessedSource] = process_and_deduplicate_sources(
            raw_results, max_sources=max_sources
        )
        if not sources:
            raise ExternalServiceError(
                "Tavily",
                "Tavily returned no usable web sources for this query. Try broadening your terms.",
            )
        await self._emit(
            on_step,
            trace,
            step_number=5,
            step_key="information_processing",
            title="Information Processing",
            status="completed",
            summary=f"Deduplicated {len(raw_results)} results into {len(sources)} ranked sources.",
            duration_ms=int((time.perf_counter() - t0) * 1000),
        )

        # Step 6: Gemini Analysis Agent
        t0 = time.perf_counter()
        await self._emit(
            on_step,
            trace,
            step_number=6,
            step_key="gemini_analysis",
            title="Gemini Analysis Agent",
            status="running",
            summary=f"Analyzing {len(sources)} retrieved sources with {self.settings.gemini_model}...",
        )
        evidence_blocks = []
        for src in sources:
            date_note = f" | Date: {src.published_date}" if src.published_date else ""
            evidence_blocks.append(
                f"[{src.citation_id}] {src.title} ({src.domain}{date_note})\n"
                f"URL: {src.url}\n"
                f"Evidence Snippet: {src.snippet}"
            )
        evidence_corpus = "\n\n".join(evidence_blocks)

        draft = await self.gemini.generate_structured(
            system_instruction=(
                "You are the Gemini Analysis Agent for ResearchPilot AI. "
                "Synthesize a rigorous, evidence-grounded research report strictly from the "
                "provided numbered web sources.\n"
                "CRITICAL RULES:\n"
                "1. Never invent facts, URLs, or citation IDs. Only cite integer IDs present in [1..N].\n"
                "2. In every key_finding, clearly separate `retrieved_facts` (objective facts stated "
                "by the sources) from `ai_analysis` (cross-source synthesis, comparison, implications).\n"
                "3. Populate `important_statistics` ONLY when exact numbers, percentages, or counts "
                "explicitly appear in the provided snippets, linked to the exact `citation_id`. "
                "If no verified statistics appear in the sources, return an empty list [].\n"
                "4. Provide 3 to 4 actionable follow-up queries in `related_questions`."
            ),
            prompt=(
                f"Current Date: {current_date}\n"
                f"Original User Query: {query}\n"
                f"Main Topic: {query_analysis.main_topic}\n"
                f"Planned Sub-Questions:\n"
                + "\n".join(f"- {sq}" for sq in plan.sub_questions)
                + f"{parent_context}\n\n"
                f"RETRIEVED WEB SOURCES (cite using exact integer IDs 1..{len(sources)}):\n\n"
                f"{evidence_corpus}"
            ),
            response_model=_GeminiReportDraft,
            temperature=0.2,
        )
        await self._emit(
            on_step,
            trace,
            step_number=6,
            step_key="gemini_analysis",
            title="Gemini Analysis Agent",
            status="completed",
            summary=f"Synthesized {len(draft.key_findings)} key findings and {len(draft.detailed_analysis)} analytical sections.",
            duration_ms=int((time.perf_counter() - t0) * 1000),
        )

        # Step 7: Citation Manager
        t0 = time.perf_counter()
        await self._emit(
            on_step,
            trace,
            step_number=7,
            step_key="citation_manager",
            title="Citation Manager",
            status="running",
            summary="Auditing citation links against verified Tavily source URLs...",
        )
        draft_findings = [
            KeyFinding(
                id=f"finding-{idx}",
                title=f.title,
                retrieved_facts=f.retrieved_facts,
                ai_analysis=f.ai_analysis,
                confidence=f.confidence,
                citation_ids=f.citation_ids,
            )
            for idx, f in enumerate(draft.key_findings, start=1)
        ]
        draft_sections = [
            DetailedAnalysisSection(
                heading=s.heading,
                content=s.content,
                evidence_notes=s.evidence_notes,
                citation_ids=s.citation_ids,
            )
            for s in draft.detailed_analysis
        ]
        draft_stats = [
            StatisticItem(
                metric=st.metric,
                value=st.value,
                context=st.context,
                citation_id=st.citation_id,
            )
            for st in draft.important_statistics
        ]

        findings, sections, statistics, stripped_refs = verify_citations(
            sources=sources,
            findings=draft_findings,
            detailed_sections=draft_sections,
            statistics=draft_stats,
        )
        await self._emit(
            on_step,
            trace,
            step_number=7,
            step_key="citation_manager",
            title="Citation Manager",
            status="completed",
            summary=(
                f"Verified citations across {len(sources)} sources"
                + (f" (removed {stripped_refs} invalid ref(s))." if stripped_refs else ".")
            ),
            duration_ms=int((time.perf_counter() - t0) * 1000),
        )

        # Step 8: Report Generator
        t0 = time.perf_counter()
        await self._emit(
            on_step,
            trace,
            step_number=8,
            step_key="report_generator",
            title="Report Generator",
            status="running",
            summary="Assembling structured research report & follow-up suggestions...",
        )
        total_duration_ms = int((time.perf_counter() - pipeline_start) * 1000)
        report = ResearchReport(
            research_id=research_id,
            title=draft.title,
            original_query=query,
            parent_research_id=parent_report.research_id if parent_report else None,
            depth=depth,
            query_analysis=query_analysis,
            research_plan=plan,
            executive_summary=draft.executive_summary,
            problem_overview=draft.problem_overview,
            key_findings=findings,
            detailed_analysis=sections,
            important_statistics=statistics,
            conclusion=draft.conclusion,
            sources=sources,
            related_questions=draft.related_questions[:4],
            agent_trace=trace,
            metadata=ReportMetadata(
                total_duration_ms=total_duration_ms,
                queries_executed=len(plan.search_queries),
                raw_results_count=len(raw_results),
                deduplicated_sources_count=len(sources),
                gemini_model=getattr(self.gemini, "last_model_used", self.settings.gemini_model),
                storage_mode=self.repository.storage_mode,
            ),
        )
        await self._emit(
            on_step,
            trace,
            step_number=8,
            step_key="report_generator",
            title="Report Generator",
            status="completed",
            summary="Structured report formatted with citations and PDF readiness.",
            duration_ms=int((time.perf_counter() - t0) * 1000),
        )

        # Step 9: Final Output & Persistence
        t0 = time.perf_counter()
        await self._emit(
            on_step,
            trace,
            step_number=9,
            step_key="final_output",
            title="Final Output & Persistence",
            status="running",
            summary="Saving research session and finalizing report output...",
        )
        final_total_ms = int((time.perf_counter() - pipeline_start) * 1000)
        report.metadata.total_duration_ms = final_total_ms
        await self._emit(
            on_step,
            trace,
            step_number=9,
            step_key="final_output",
            title="Final Output & Persistence",
            status="completed",
            summary=f"Saved to {self.repository.storage_mode} storage in {final_total_ms}ms.",
            duration_ms=int((time.perf_counter() - t0) * 1000),
        )
        report.agent_trace = trace
        await self.repository.save_report(report)
        return report

    async def run_follow_up(
        self,
        *,
        parent_research_id: str,
        query: str,
        on_step: StepCallback = None,
    ) -> ResearchReport:
        self._validate_api_keys()
        parent = await self.repository.get_report(parent_research_id)
        return await self.run_research(
            query=query,
            depth=parent.depth,
            parent_report=parent,
            on_step=on_step,
        )
