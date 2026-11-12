import re
from typing import Any, Dict, List, Set, Tuple
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from app.models.research import (
    DetailedAnalysisSection,
    KeyFinding,
    ProcessedSource,
    StatisticItem,
)

TRACKING_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "ref",
}


def canonicalize_url(raw_url: str) -> str:
    """Normalize URLs for accurate deduplication while preserving valid paths/queries."""
    parsed = urlparse(raw_url.strip())
    if not parsed.scheme or not parsed.netloc:
        return raw_url.strip()

    filtered_query = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if k.lower() not in TRACKING_PARAMS
    ]
    cleaned_path = parsed.path.rstrip("/") or "/"
    return urlunparse(
        (
            parsed.scheme.lower(),
            parsed.netloc.lower(),
            cleaned_path,
            "",
            urlencode(filtered_query),
            "",
        )
    )


def extract_domain(url: str) -> str:
    netloc = urlparse(url).netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    return netloc or "web-source"


def clean_snippet(text: str, max_chars: int = 1200) -> str:
    collapsed = re.sub(r"\s+", " ", (text or "")).strip()
    if len(collapsed) > max_chars:
        return collapsed[: max_chars - 3].rstrip() + "..."
    return collapsed


def process_and_deduplicate_sources(
    raw_results: List[Dict[str, Any]],
    max_sources: int = 12,
) -> List[ProcessedSource]:
    """Step 5: Clean, deduplicate by canonical URL, rank by relevance, and index sources."""
    best_by_url: Dict[str, Dict[str, Any]] = {}

    for item in raw_results:
        url = (item.get("url") or "").strip()
        content = clean_snippet(item.get("content") or "")
        if not url or not content:
            continue

        canonical = canonicalize_url(url)
        score = float(item.get("score") or 0.0)
        existing = best_by_url.get(canonical)

        if existing is None or score > float(existing.get("score") or 0.0):
            best_by_url[canonical] = {
                "title": clean_snippet(item.get("title") or extract_domain(url), max_chars=220),
                "url": url,
                "domain": extract_domain(url),
                "snippet": content,
                "relevance_score": round(score, 4),
                "published_date": item.get("published_date"),
                "sub_query": item.get("sub_query") or "",
            }

    ranked = sorted(
        best_by_url.values(),
        key=lambda row: row["relevance_score"],
        reverse=True,
    )[:max_sources]

    sources: List[ProcessedSource] = []
    for idx, row in enumerate(ranked, start=1):
        sources.append(
            ProcessedSource(
                citation_id=idx,
                title=row["title"],
                url=row["url"],
                domain=row["domain"],
                snippet=row["snippet"],
                relevance_score=row["relevance_score"],
                published_date=row["published_date"],
                sub_query=row["sub_query"],
            )
        )
    return sources


def verify_citations(
    *,
    sources: List[ProcessedSource],
    findings: List[KeyFinding],
    detailed_sections: List[DetailedAnalysisSection],
    statistics: List[StatisticItem],
) -> Tuple[List[KeyFinding], List[DetailedAnalysisSection], List[StatisticItem], int]:
    """
    Step 7: Audit all citation references against retrieved sources.
    Strips any unverified citation IDs and drops any statistics lacking a valid source.
    """
    valid_ids: Set[int] = {src.citation_id for src in sources}
    removed_invalid_refs = 0

    verified_findings: List[KeyFinding] = []
    for finding in findings:
        clean_ids = []
        for cid in finding.citation_ids:
            if cid in valid_ids and cid not in clean_ids:
                clean_ids.append(cid)
            elif cid not in valid_ids:
                removed_invalid_refs += 1

        confidence = finding.confidence
        if not clean_ids:
            confidence = "limited"

        verified_findings.append(
            finding.model_copy(
                update={
                    "citation_ids": clean_ids,
                    "confidence": confidence,
                }
            )
        )

    verified_sections: List[DetailedAnalysisSection] = []
    for section in detailed_sections:
        clean_ids = []
        for cid in section.citation_ids:
            if cid in valid_ids and cid not in clean_ids:
                clean_ids.append(cid)
            elif cid not in valid_ids:
                removed_invalid_refs += 1
        verified_sections.append(section.model_copy(update={"citation_ids": clean_ids}))

    verified_stats: List[StatisticItem] = []
    for stat in statistics:
        if stat.citation_id in valid_ids:
            verified_stats.append(stat)
        else:
            removed_invalid_refs += 1

    return verified_findings, verified_sections, verified_stats, removed_invalid_refs
