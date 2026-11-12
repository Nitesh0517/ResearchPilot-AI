from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.models.research import ResearchReport

NAVY = colors.HexColor("#101828")
INDIGO = colors.HexColor("#6366F1")
SLATE = colors.HexColor("#334155")
MUTED = colors.HexColor("#64748B")
SURFACE = colors.HexColor("#F8FAFC")
BORDER = colors.HexColor("#E2E8F0")


def _safe(text: str) -> str:
    return escape(text or "").replace("\n", "<br/>")


def generate_report_pdf(report: ResearchReport) -> bytes:
    """Render a ResearchReport into a professionally styled PDF binary."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=LETTER,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title=report.title,
        author="ResearchPilot AI",
    )

    base = getSampleStyleSheet()
    styles = {
        "kicker": ParagraphStyle(
            "Kicker",
            parent=base["Normal"],
            fontSize=8.5,
            leading=11,
            textColor=INDIGO,
            fontName="Helvetica-Bold",
        ),
        "title": ParagraphStyle(
            "ReportTitle",
            parent=base["Heading1"],
            fontSize=19,
            leading=24,
            textColor=NAVY,
            fontName="Helvetica-Bold",
            spaceAfter=6,
        ),
        "meta": ParagraphStyle(
            "Meta",
            parent=base["Normal"],
            fontSize=9,
            leading=13,
            textColor=MUTED,
            spaceAfter=10,
        ),
        "h2": ParagraphStyle(
            "SectionH2",
            parent=base["Heading2"],
            fontSize=13,
            leading=17,
            textColor=NAVY,
            fontName="Helvetica-Bold",
            spaceBefore=12,
            spaceAfter=6,
        ),
        "h3": ParagraphStyle(
            "SectionH3",
            parent=base["Heading3"],
            fontSize=10.5,
            leading=14,
            textColor=NAVY,
            fontName="Helvetica-Bold",
            spaceBefore=8,
            spaceAfter=3,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontSize=9.5,
            leading=14.5,
            textColor=SLATE,
            spaceAfter=6,
        ),
        "label": ParagraphStyle(
            "Label",
            parent=base["Normal"],
            fontSize=8.5,
            leading=12,
            textColor=INDIGO,
            fontName="Helvetica-Bold",
            spaceAfter=2,
        ),
        "ref": ParagraphStyle(
            "Reference",
            parent=base["Normal"],
            fontSize=8.5,
            leading=12.5,
            textColor=SLATE,
            spaceAfter=5,
        ),
    }

    story = []

    story.append(Paragraph("RESEARCHPILOT AI • AUTONOMOUS INTELLIGENCE REPORT", styles["kicker"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(_safe(report.title), styles["title"]))
    story.append(
        Paragraph(
            _safe(
                f"Query: {report.original_query}\n"
                f"Generated: {report.created_at} | Sources Verified: {len(report.sources)} | "
                f"Model: {report.metadata.gemini_model}"
            ),
            styles["meta"],
        )
    )
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=10))

    # Executive Summary
    story.append(Paragraph("1. Executive Summary", styles["h2"]))
    story.append(Paragraph(_safe(report.executive_summary), styles["body"]))

    # Problem Overview
    story.append(Paragraph("2. Problem Overview", styles["h2"]))
    story.append(Paragraph(_safe(report.problem_overview), styles["body"]))

    # Key Findings
    story.append(Paragraph("3. Key Findings (Retrieved Facts vs. AI Analysis)", styles["h2"]))
    for idx, finding in enumerate(report.key_findings, start=1):
        cites = ", ".join(f"[{cid}]" for cid in finding.citation_ids) or "None"
        story.append(
            Paragraph(
                _safe(f"{idx}. {finding.title} (Confidence: {finding.confidence.upper()} | Sources: {cites})"),
                styles["h3"],
            )
        )
        story.append(Paragraph("Retrieved Facts (Source Evidence):", styles["label"]))
        story.append(Paragraph(_safe(finding.retrieved_facts), styles["body"]))
        story.append(Paragraph("AI-Generated Analysis:", styles["label"]))
        story.append(Paragraph(_safe(finding.ai_analysis), styles["body"]))

    # Detailed Analysis
    story.append(Paragraph("4. Detailed Analysis", styles["h2"]))
    for section in report.detailed_analysis:
        cites = ", ".join(f"[{cid}]" for cid in section.citation_ids)
        heading_text = f"{section.heading} ({cites})" if cites else section.heading
        story.append(Paragraph(_safe(heading_text), styles["h3"]))
        story.append(Paragraph(_safe(section.content), styles["body"]))
        if section.evidence_notes:
            story.append(
                Paragraph(
                    _safe(f"Source Basis: {section.evidence_notes}"),
                    styles["meta"],
                )
            )

    # Statistics
    story.append(Paragraph("5. Source-Backed Statistics", styles["h2"]))
    if report.important_statistics:
        table_data = [["Metric", "Value", "Context", "Ref"]]
        for stat in report.important_statistics:
            table_data.append(
                [
                    Paragraph(_safe(stat.metric), styles["ref"]),
                    Paragraph(_safe(stat.value), styles["ref"]),
                    Paragraph(_safe(stat.context), styles["ref"]),
                    Paragraph(f"[{stat.citation_id}]", styles["ref"]),
                ]
            )
        table = Table(table_data, colWidths=[1.6 * inch, 1.1 * inch, 3.6 * inch, 0.55 * inch])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 8.5),
                    ("BACKGROUND", (0, 1), (-1, -1), SURFACE),
                    ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("PADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        story.append(table)
        story.append(Spacer(1, 8))
    else:
        story.append(
            Paragraph(
                "No explicit quantitative statistics were reported in the retrieved sources.",
                styles["body"],
            )
        )

    # Conclusion
    story.append(Paragraph("6. Conclusion", styles["h2"]))
    story.append(Paragraph(_safe(report.conclusion), styles["body"]))

    # References
    story.append(Paragraph("7. References & Source URLs", styles["h2"]))
    for src in report.sources:
        story.append(
            Paragraph(
                _safe(f"[{src.citation_id}] {src.title} ({src.domain})\n{src.url}"),
                styles["ref"],
            )
        )

    doc.build(story)
    return buffer.getvalue()
