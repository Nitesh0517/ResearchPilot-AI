import json
from typing import Any, Dict, List

import pytest
from fastapi.testclient import TestClient

from app.agents.orchestrator import (
    _DraftFinding,
    _DraftSection,
    _DraftStatistic,
    _GeminiReportDraft,
    _QueryAnalysisAndPlan,
)
from app.agents.processor import (
    canonicalize_url,
    process_and_deduplicate_sources,
    verify_citations,
)
from app.config import Settings
from app.main import create_app
from app.models.research import (
    DetailedAnalysisSection,
    KeyFinding,
    ProcessedSource,
    QueryAnalysis,
    ResearchPlan,
    StatisticItem,
)
from app.services.pdf_service import generate_report_pdf


class FakeTavilyService:
    async def search_queries(self, queries: List[str], depth: str = "standard") -> List[Dict[str, Any]]:
        return [
            {
                "title": "AI Data Center Grid Demand 2026",
                "url": "https://energy.example.org/reports/ai-grid?utm_source=test",
                "content": "Global data center electricity demand reached 460 TWh in recent projections.",
                "score": 0.95,
                "published_date": "2026-03-10",
                "sub_query": queries[0],
            },
            {
                "title": "AI Data Center Grid Demand Duplicate",
                "url": "https://energy.example.org/reports/ai-grid/",
                "content": "Lower score duplicate should be deduplicated.",
                "score": 0.62,
                "published_date": "2026-03-10",
                "sub_query": queries[0],
            },
            {
                "title": "Grid Storage Procurement Trends",
                "url": "https://gridnews.example.com/storage-2026",
                "content": "Utility-scale battery deployments expanded 38% year-over-year.",
                "score": 0.89,
                "published_date": "2026-05-01",
                "sub_query": queries[-1],
            },
        ]


class FakeGeminiService:
    async def generate_structured(
        self,
        *,
        system_instruction: str,
        prompt: str,
        response_model,
        temperature: float = 0.2,
    ):
        if response_model is _QueryAnalysisAndPlan:
            return _QueryAnalysisAndPlan(
                main_topic="AI Data Center Energy Demand",
                intent="Evaluate grid demand and storage growth",
                scope="Global utility and hyperscaler power trends",
                time_sensitivity="2025-2026",
                sub_questions=[
                    "What is projected AI data center electricity demand?",
                    "How are utilities scaling battery storage?",
                ],
                search_queries=[
                    "AI data center electricity demand 2026",
                    "utility battery storage hyperscaler data centers",
                ],
            )
        if response_model is QueryAnalysis:
            return QueryAnalysis(
                main_topic="AI Data Center Energy Demand",
                intent="Evaluate grid demand and storage growth",
                scope="Global utility and hyperscaler power trends",
                time_sensitivity="2025-2026",
            )
        if response_model is ResearchPlan:
            return ResearchPlan(
                sub_questions=[
                    "What is projected AI data center electricity demand?",
                    "How are utilities scaling battery storage?",
                ],
                search_queries=[
                    "AI data center electricity demand 2026",
                    "utility battery storage hyperscaler data centers",
                ],
            )
        return _GeminiReportDraft(
            title="AI Data Center Power Demand & Grid Storage Analysis",
            executive_summary="Retrieved reports highlight rising data center power demand [1] paired with storage expansion [2].",
            problem_overview="Hyperscale AI clusters require continuous power, testing regional transmission capacity [1].",
            key_findings=[
                _DraftFinding(
                    title="Electricity demand projections",
                    retrieved_facts="Data center electricity demand reached 460 TWh in cited projections.",
                    ai_analysis="Rapid compute scaling is concentrating load growth in key grid hubs.",
                    confidence="high",
                    citation_ids=[1, 99],  # 99 is invalid and must be stripped by Citation Manager
                ),
                _DraftFinding(
                    title="Utility-scale storage adoption",
                    retrieved_facts="Utility-scale battery deployments expanded 38% year-over-year.",
                    ai_analysis="Co-located storage helps buffer peak AI training workloads.",
                    confidence="medium",
                    citation_ids=[2],
                ),
            ],
            detailed_analysis=[
                _DraftSection(
                    heading="Power Load & Infrastructure",
                    content="Grid operators are upgrading substations to handle multi-hundred-megawatt campuses.",
                    evidence_notes="Supported by Energy report [1] and GridNews [2].",
                    citation_ids=[1, 2],
                )
            ],
            important_statistics=[
                _DraftStatistic(
                    metric="Projected Data Center Electricity",
                    value="460 TWh",
                    context="Reported demand baseline across global facilities.",
                    citation_id=1,
                ),
                _DraftStatistic(
                    metric="Hallucinated Stat",
                    value="999%",
                    context="Invalid source ref should be dropped.",
                    citation_id=77,
                ),
            ],
            conclusion="Evidence shows coordinated grid investment and storage deployment are critical [1][2].",
            related_questions=[
                "Which US ISOs face the tightest interconnection queues?",
                "How do nuclear PPAs compare with battery-backed renewables?",
            ],
        )


def _make_settings(**overrides) -> Settings:
    defaults = {
        "tavily_api_key": "",
        "gemini_api_key": "",
        "mongodb_uri": "",
        "local_history_file": "",
    }
    defaults.update(overrides)
    return Settings(**defaults)


def test_url_canonicalization_and_deduplication():
    u1 = canonicalize_url("https://Example.com/path/?utm_source=x&id=2#section")
    u2 = canonicalize_url("https://example.com/path?id=2")
    assert u1 == u2

    sources = process_and_deduplicate_sources(
        [
            {"title": "Low", "url": "https://a.com/doc/", "content": "first", "score": 0.4},
            {"title": "High", "url": "https://a.com/doc?utm_medium=cpc", "content": "second", "score": 0.9},
            {"title": "Other", "url": "https://b.com/post", "content": "third", "score": 0.7},
        ]
    )
    assert len(sources) == 2
    assert sources[0].title == "High"
    assert sources[0].citation_id == 1
    assert sources[1].citation_id == 2


def test_citation_manager_strips_fabricated_refs_and_stats():
    sources = [
        ProcessedSource(
            citation_id=1,
            title="Real Source",
            url="https://example.com",
            domain="example.com",
            snippet="Real snippet",
            relevance_score=0.9,
        )
    ]
    findings = [
        KeyFinding(
            id="f1",
            title="Finding 1",
            retrieved_facts="Fact",
            ai_analysis="Analysis",
            confidence="high",
            citation_ids=[1, 42],
        ),
        KeyFinding(
            id="f2",
            title="Finding 2",
            retrieved_facts="Fact",
            ai_analysis="Analysis",
            confidence="high",
            citation_ids=[99],
        ),
    ]
    sections = [
        DetailedAnalysisSection(heading="Sec", content="Body", citation_ids=[1, 5])
    ]
    stats = [
        StatisticItem(metric="Valid", value="10%", context="Real", citation_id=1),
        StatisticItem(metric="Fake", value="99%", context="Fake", citation_id=3),
    ]

    v_findings, v_sections, v_stats, stripped = verify_citations(
        sources=sources,
        findings=findings,
        detailed_sections=sections,
        statistics=stats,
    )
    assert v_findings[0].citation_ids == [1]
    assert v_findings[1].citation_ids == []
    assert v_findings[1].confidence == "limited"
    assert v_sections[0].citation_ids == [1]
    assert len(v_stats) == 1
    assert v_stats[0].metric == "Valid"
    assert stripped == 4


def test_health_and_missing_keys_never_simulate_results():
    app = create_app(_make_settings())
    with TestClient(app) as client:
        health = client.get("/api/health")
        assert health.status_code == 200
        body = health.json()
        assert body["status"] == "configuration_required"
        assert body["environment"]["tavily_configured"] is False
        assert body["environment"]["gemini_configured"] is False

        resp = client.post("/api/research", json={"query": "Quantum computing in 2026"})
        assert resp.status_code == 503
        err = resp.json()
        assert err["error_code"] == "CONFIGURATION_MISSING"
        assert "TAVILY_API_KEY" in err["missing_keys"]
        assert "GEMINI_API_KEY" in err["missing_keys"]

        bad_input = client.post("/api/research", json={"query": "  "})
        assert bad_input.status_code == 422


def test_full_research_pipeline_history_followup_and_pdf():
    app = create_app(_make_settings(tavily_api_key="tvly-test", gemini_api_key="gm-test"))
    with TestClient(app) as client:
        app.state.orchestrator.tavily = FakeTavilyService()
        app.state.orchestrator.gemini = FakeGeminiService()

        # 1. Create primary research report
        res = client.post(
            "/api/research",
            json={"query": "AI data center grid demand", "depth": "standard"},
        )
        assert res.status_code == 200
        report = res.json()
        rid = report["research_id"]

        assert len(report["sources"]) == 2
        assert report["key_findings"][0]["citation_ids"] == [1]
        assert len(report["important_statistics"]) == 1
        assert len(report["agent_trace"]) == 9

        # 2. History & Search filter
        hist = client.get("/api/research/history").json()
        assert hist["total"] == 1
        assert hist["items"][0]["research_id"] == rid

        filtered = client.get("/api/research/history", params={"q": "Grid Storage"}).json()
        assert filtered["total"] == 1

        # 3. Get single report
        fetched = client.get(f"/api/research/{rid}")
        assert fetched.status_code == 200
        assert fetched.json()["title"] == report["title"]

        # 4. Download PDF
        pdf_resp = client.get(f"/api/research/{rid}/pdf")
        assert pdf_resp.status_code == 200
        assert pdf_resp.headers["content-type"] == "application/pdf"
        assert pdf_resp.content.startswith(b"%PDF-1.")

        # 5. Follow-up research
        follow = client.post(
            "/api/research/follow-up",
            json={"parent_research_id": rid, "query": "Battery storage economics"},
        )
        assert follow.status_code == 200
        follow_report = follow.json()
        assert follow_report["parent_research_id"] == rid

        # 6. Delete report and verify 404
        deleted = client.delete(f"/api/research/{rid}")
        assert deleted.status_code == 200
        assert deleted.json()["deleted"] is True

        missing = client.get(f"/api/research/{rid}")
        assert missing.status_code == 404


def test_sse_stream_endpoint_emits_steps_and_complete():
    app = create_app(_make_settings(tavily_api_key="tvly-test", gemini_api_key="gm-test"))
    with TestClient(app) as client:
        app.state.orchestrator.tavily = FakeTavilyService()
        app.state.orchestrator.gemini = FakeGeminiService()

        with client.stream(
            "POST",
            "/api/research/stream",
            json={"query": "AI grid energy demand", "depth": "standard"},
        ) as resp:
            assert resp.status_code == 200
            raw_stream = "".join(resp.iter_text())

        assert "event: step" in raw_stream
        assert "event: complete" in raw_stream
        complete_chunk = raw_stream.split("event: complete\ndata: ")[1].split("\n\n")[0]
        complete_data = json.loads(complete_chunk)
        assert complete_data["report"]["metadata"]["deduplicated_sources_count"] == 2


def test_pdf_generator_handles_special_xml_characters():
    from app.models.research import ReportMetadata, ResearchReport

    report = ResearchReport(
        research_id="pdf-test-1",
        title="R&D <Benchmarks> & Market Analysis",
        original_query="A & B < C",
        query_analysis=QueryAnalysis(main_topic="R&D", intent="Compare", scope="Global"),
        research_plan=ResearchPlan(sub_questions=["Q1"], search_queries=["Q1"]),
        executive_summary="Summary with <tags> & ampersands.",
        problem_overview="Overview",
        key_findings=[
            KeyFinding(
                id="f1",
                title="Finding & Test",
                retrieved_facts="Fact < 100 & > 10",
                ai_analysis="Analysis",
                confidence="high",
                citation_ids=[1],
            )
        ],
        detailed_analysis=[
            DetailedAnalysisSection(heading="Sec & 1", content="Content", citation_ids=[1])
        ],
        important_statistics=[],
        conclusion="Conclusion",
        sources=[
            ProcessedSource(
                citation_id=1,
                title="Source & Co <Report>",
                url="https://example.com/?a=1&b=2",
                domain="example.com",
                snippet="Snippet",
            )
        ],
        related_questions=["Next?"],
        metadata=ReportMetadata(
            total_duration_ms=100,
            queries_executed=1,
            raw_results_count=1,
            deduplicated_sources_count=1,
            gemini_model="gemini-flash-latest",
            storage_mode="memory",
        ),
    )
    pdf_bytes = generate_report_pdf(report)
    assert pdf_bytes.startswith(b"%PDF-1.")
    assert len(pdf_bytes) > 1000


def test_rate_limit_timeout_and_missing_parent_error_mapping():
    from app.exceptions import ExternalRateLimitError, ExternalTimeoutError

    class RateLimitedTavily:
        async def search_queries(self, queries: List[str], depth: str = "standard"):
            raise ExternalRateLimitError("Tavily")

    class TimeoutGemini:
        async def generate_structured(self, **kwargs):
            raise ExternalTimeoutError("Google Gemini")

    app = create_app(_make_settings(tavily_api_key="tvly-test", gemini_api_key="gm-test"))
    with TestClient(app) as client:
        # Missing parent on follow-up -> 404
        missing_parent = client.post(
            "/api/research/follow-up",
            json={"parent_research_id": "nonexistent-id", "query": "Follow up question"},
        )
        assert missing_parent.status_code == 404
        assert missing_parent.json()["error_code"] == "REPORT_NOT_FOUND"

        # Rate limit from Tavily -> 429
        app.state.orchestrator.gemini = FakeGeminiService()
        app.state.orchestrator.tavily = RateLimitedTavily()
        rate_limited = client.post("/api/research", json={"query": "Valid research query"})
        assert rate_limited.status_code == 429
        assert rate_limited.json()["error_code"] == "RATE_LIMIT_EXCEEDED"

        # Timeout from Gemini -> 504
        app.state.orchestrator.gemini = TimeoutGemini()
        timed_out = client.post("/api/research", json={"query": "Valid research query"})
        assert timed_out.status_code == 504
        assert timed_out.json()["error_code"] == "UPSTREAM_TIMEOUT"

