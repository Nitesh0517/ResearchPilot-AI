from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class ResearchRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=1500)
    depth: Literal["standard", "deep"] = "standard"
    focus: Optional[str] = Field(default=None, max_length=300)

    @field_validator("query")
    @classmethod
    def strip_query(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 3:
            raise ValueError("Research query must contain at least 3 non-whitespace characters.")
        return cleaned


class FollowUpRequest(BaseModel):
    parent_research_id: str = Field(..., min_length=1, max_length=128)
    query: str = Field(..., min_length=3, max_length=1500)

    @field_validator("query")
    @classmethod
    def strip_query(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 3:
            raise ValueError("Follow-up query must contain at least 3 non-whitespace characters.")
        return cleaned


class QueryAnalysis(BaseModel):
    main_topic: str
    intent: str
    scope: str
    time_sensitivity: str = "current"


class ResearchPlan(BaseModel):
    sub_questions: List[str]
    search_queries: List[str]


class ProcessedSource(BaseModel):
    citation_id: int
    title: str
    url: str
    domain: str
    snippet: str
    relevance_score: float = 0.0
    published_date: Optional[str] = None
    sub_query: str = ""


class KeyFinding(BaseModel):
    id: str
    title: str
    retrieved_facts: str
    ai_analysis: str
    confidence: Literal["high", "medium", "limited"] = "medium"
    citation_ids: List[int] = Field(default_factory=list)


class DetailedAnalysisSection(BaseModel):
    heading: str
    content: str
    evidence_notes: str = ""
    citation_ids: List[int] = Field(default_factory=list)


class StatisticItem(BaseModel):
    metric: str
    value: str
    context: str
    citation_id: int


class AgentStepTrace(BaseModel):
    step_number: int
    step_key: str
    title: str
    status: Literal["pending", "running", "completed", "error"] = "completed"
    summary: str = ""
    duration_ms: Optional[int] = None


class ReportMetadata(BaseModel):
    total_duration_ms: int
    queries_executed: int
    raw_results_count: int
    deduplicated_sources_count: int
    gemini_model: str
    storage_mode: str


class ResearchReport(BaseModel):
    research_id: str
    title: str
    original_query: str
    parent_research_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    depth: Literal["standard", "deep"] = "standard"
    query_analysis: QueryAnalysis
    research_plan: ResearchPlan
    executive_summary: str
    problem_overview: str
    key_findings: List[KeyFinding]
    detailed_analysis: List[DetailedAnalysisSection]
    important_statistics: List[StatisticItem] = Field(default_factory=list)
    conclusion: str
    sources: List[ProcessedSource]
    related_questions: List[str] = Field(default_factory=list)
    agent_trace: List[AgentStepTrace] = Field(default_factory=list)
    metadata: ReportMetadata


class HistorySummary(BaseModel):
    research_id: str
    title: str
    original_query: str
    parent_research_id: Optional[str] = None
    created_at: str
    sources_count: int
    duration_ms: int = 0
    depth: Literal["standard", "deep"] = "standard"


class HistoryResponse(BaseModel):
    items: List[HistorySummary]
    total: int
    storage_mode: str


class DeleteResponse(BaseModel):
    deleted: bool
    research_id: str


class EnvironmentStatus(BaseModel):
    tavily_configured: bool
    gemini_configured: bool
    mongodb_configured: bool
    mongodb_status: str
    gemini_model: str


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: EnvironmentStatus
    storage_mode: str
    timestamp: str
