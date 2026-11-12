import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  FileDown,
  FileText,
  Layers,
  MessageSquarePlus,
  Send,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { AgentWorkflowTracker, WORKFLOW_STEPS } from '../components/AgentWorkflowTracker'
import { CitationBadge } from '../components/CitationBadge'
import { ConfigAlert } from '../components/ConfigAlert'
import { ReportSkeleton } from '../components/LoadingSkeleton'
import { SourceCard } from '../components/SourceCard'
import { useToast } from '../hooks/useToast'
import {
  downloadReportPdf,
  fetchReport,
  normalizeApiError,
  streamResearchRequest,
} from '../services/api'

export function ResultsPage() {
  const { researchId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [report, setReport] = useState(location.state?.report || null)
  const [loading, setLoading] = useState(!location.state?.report)
  const [error, setError] = useState(null)
  const [highlightedCitation, setHighlightedCitation] = useState(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const [followUpQuery, setFollowUpQuery] = useState('')
  const [followUpRunning, setFollowUpRunning] = useState(false)
  const [followUpSteps, setFollowUpSteps] = useState({})
  const [followUpError, setFollowUpError] = useState(null)

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchReport(researchId)
      setReport(data)
    } catch (err) {
      setError(normalizeApiError(err))
    } finally {
      setLoading(false)
    }
  }, [researchId])

  useEffect(() => {
    if (!location.state?.report || location.state?.report?.research_id !== researchId) {
      loadReport()
    } else {
      setReport(location.state.report)
      setLoading(false)
    }
  }, [researchId, location.state, loadReport])

  const handleCitationSelect = (citationId) => {
    setHighlightedCitation(citationId)
    const el = document.getElementById(`source-${citationId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    window.setTimeout(() => {
      setHighlightedCitation((curr) => (curr === citationId ? null : curr))
    }, 2600)
  }

  const handleDownloadPdf = async () => {
    if (!report) return
    setDownloadingPdf(true)
    try {
      const slug = (report.title || 'research-report')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 60)
      await downloadReportPdf(report.research_id, slug || 'research-report')
      showToast({
        type: 'success',
        title: 'PDF downloaded',
        description: 'Your structured research report has been exported.',
      })
    } catch (err) {
      const normalized = normalizeApiError(err)
      showToast({
        type: 'error',
        title: 'PDF export failed',
        description: normalized.message,
      })
    } finally {
      setDownloadingPdf(false)
    }
  }

  const launchFollowUp = async (queryText) => {
    const trimmed = queryText.trim()
    if (trimmed.length < 3 || !report) return

    setFollowUpRunning(true)
    setFollowUpError(null)

    const initSteps = {}
    for (const s of WORKFLOW_STEPS) {
      initSteps[s.step_key] = { ...s, status: 'pending' }
    }
    setFollowUpSteps(initSteps)

    try {
      const childReport = await streamResearchRequest(
        '/research/follow-up/stream',
        {
          parent_research_id: report.research_id,
          query: trimmed,
        },
        {
          onStep: (stepEvent) => {
            setFollowUpSteps((prev) => ({
              ...prev,
              [stepEvent.step_key]: {
                ...prev[stepEvent.step_key],
                ...stepEvent,
              },
            }))
          },
          onError: (err) => setFollowUpError(err),
        }
      )

      if (childReport?.research_id) {
        setFollowUpQuery('')
        setFollowUpSteps({})
        showToast({
          type: 'success',
          title: 'Follow-up research complete',
          description: `Generated report with ${childReport.sources?.length || 0} sources.`,
        })
        navigate(`/research/${childReport.research_id}`, {
          state: { report: childReport },
        })
      }
    } catch (err) {
      const normalized = normalizeApiError(err)
      setFollowUpError(normalized)
      showToast({
        type: 'error',
        title: 'Follow-up research failed',
        description: normalized.message,
      })
    } finally {
      setFollowUpRunning(false)
    }
  }

  if (loading) {
    return <ReportSkeleton />
  }

  if (error || !report) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
        <ShieldAlert className="mx-auto h-10 w-10 text-rose-500" />
        <h2 className="mt-4 text-lg font-bold text-[#101828]">
          Unable to Load Research Report
        </h2>
        <p className="mt-1.5 text-sm text-slate-600">
          {error?.message || 'This research session was not found.'}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#6366F1] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4F46E5]"
          >
            New Research
          </Link>
          <Link
            to="/history"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            View History
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Workspace
          </Link>
          {report.parent_research_id && (
            <Link
              to={`/research/${report.parent_research_id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-[#4F46E5] hover:bg-indigo-100"
            >
              View Parent Report
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={downloadingPdf}
          className="inline-flex items-center gap-2 rounded-xl bg-[#101828] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1D2939] transition-colors disabled:opacity-60 cursor-pointer shadow-xs"
        >
          <FileDown className="h-4 w-4" />
          {downloadingPdf ? 'Generating PDF...' : 'Download PDF Report'}
        </button>
      </div>

      {/* Report Header & Executive Summary */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 font-semibold text-[#6366F1]">
            <Sparkles className="h-3 w-3" />
            Evidence-Grounded Report
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {new Date(report.created_at).toLocaleString()}
          </span>
          <span>•</span>
          <span>{report.sources?.length || 0} verified sources</span>
          {report.metadata?.total_duration_ms && (
            <>
              <span>•</span>
              <span>{(report.metadata.total_duration_ms / 1000).toFixed(1)}s pipeline</span>
            </>
          )}
        </div>

        <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#101828]">
          {report.title}
        </h1>
        <p className="mt-2 text-xs font-medium text-slate-500">
          Original Query: <span className="text-slate-700">“{report.original_query}”</span>
        </p>

        {/* Executive Summary */}
        <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/40 p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#4F46E5]">
            Executive Summary
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-800 whitespace-pre-line">
            {report.executive_summary}
          </p>
        </div>

        {/* Problem Overview */}
        <div className="mt-6">
          <h2 className="text-base font-bold text-[#101828]">Problem Overview</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
            {report.problem_overview}
          </p>
        </div>

        {/* Research Plan Sub-Questions */}
        {report.research_plan?.sub_questions?.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Layers className="h-3.5 w-3.5 text-[#6366F1]" />
              Agent Investigation Questions
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {report.research_plan.sub_questions.map((subQ, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5 text-xs text-slate-700"
                >
                  <span className="font-mono font-semibold text-[#6366F1] mr-1.5">
                    Q{i + 1}.
                  </span>
                  {subQ}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Key Findings: Facts vs AI Analysis */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#101828]">Key Findings</h2>
            <p className="text-xs text-slate-500">
              Retrieved source facts are explicitly separated from Gemini comparative analysis.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {(report.key_findings || []).map((finding, idx) => (
            <article
              key={finding.id || idx}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-semibold text-[#6366F1]">
                    Finding #{idx + 1}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                      finding.confidence === 'high'
                        ? 'bg-emerald-50 text-emerald-700'
                        : finding.confidence === 'medium'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {finding.confidence} evidence
                  </span>
                </div>

                <h3 className="mt-2 text-base font-bold text-[#101828]">
                  {finding.title}
                </h3>

                <div className="mt-3 rounded-xl border border-slate-200 bg-[#F8FAFC] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Retrieved Facts (Source Evidence)
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-800">
                    {finding.retrieved_facts}
                  </p>
                </div>

                <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#4F46E5]">
                    AI-Generated Analysis
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700">
                    {finding.ai_analysis}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100">
                <span className="text-[11px] font-medium text-slate-500 mr-1">
                  Citations:
                </span>
                {finding.citation_ids?.length > 0 ? (
                  finding.citation_ids.map((cid) => (
                    <CitationBadge
                      key={cid}
                      citationId={cid}
                      onSelect={handleCitationSelect}
                    />
                  ))
                ) : (
                  <span className="text-[11px] text-slate-400">No direct citation</span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Detailed Analysis */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#6366F1]" />
          <h2 className="text-lg font-bold text-[#101828]">Detailed Analysis</h2>
        </div>

        <div className="space-y-6">
          {(report.detailed_analysis || []).map((section, idx) => (
            <div
              key={idx}
              className="pb-6 border-b border-slate-100 last:pb-0 last:border-b-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold text-[#101828]">
                  {section.heading}
                </h3>
                <div className="flex flex-wrap gap-1">
                  {(section.citation_ids || []).map((cid) => (
                    <CitationBadge
                      key={cid}
                      citationId={cid}
                      onSelect={handleCitationSelect}
                    />
                  ))}
                </div>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                {section.content}
              </p>
              {section.evidence_notes && (
                <p className="mt-2.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 border border-slate-100">
                  <strong className="font-semibold text-slate-700">Source Basis: </strong>
                  {section.evidence_notes}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Important Statistics (Only when supported by sources) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[#6366F1]" />
          <h2 className="text-lg font-bold text-[#101828]">
            Source-Backed Statistics
          </h2>
        </div>

        {report.important_statistics?.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.important_statistics.map((stat, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 flex flex-col justify-between"
              >
                <div>
                  <p className="text-xs font-medium text-slate-500">{stat.metric}</p>
                  <p className="mt-1 text-xl font-extrabold text-[#101828]">
                    {stat.value}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    {stat.context}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/70 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Verified source</span>
                  <CitationBadge
                    citationId={stat.citation_id}
                    onSelect={handleCitationSelect}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            No explicit quantitative statistics were reported in the retrieved web sources for
            this query. ResearchPilot AI never fabricates numbers.
          </p>
        )}
      </section>

      {/* Conclusion */}
      <section className="rounded-2xl border border-slate-200 bg-[#101828] p-6 sm:p-7 text-white shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
          <CheckCircle2 className="h-4 w-4" />
          Conclusion
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-200 whitespace-pre-line">
          {report.conclusion}
        </p>
      </section>

      {/* Verified Sources & Citations */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="h-5 w-5 text-[#6366F1]" />
          <h2 className="text-lg font-bold text-[#101828]">
            Verified Sources & References ({report.sources?.length || 0})
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {(report.sources || []).map((source) => (
            <SourceCard
              key={source.citation_id}
              source={source}
              highlighted={highlightedCitation === source.citation_id}
            />
          ))}
        </div>
      </section>

      {/* Related Questions & Follow-up Research */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="h-5 w-5 text-[#6366F1]" />
          <div>
            <h2 className="text-base font-bold text-[#101828]">
              Continue Investigation (Follow-up Research)
            </h2>
            <p className="text-xs text-slate-500">
              Select a suggested question or enter your own follow-up query grounded in this
              report.
            </p>
          </div>
        </div>

        {followUpError && (
          <ConfigAlert
            compact
            missingKeys={followUpError.missingKeys}
            message={followUpError.message}
          />
        )}

        {report.related_questions?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {report.related_questions.map((rq, idx) => (
              <button
                key={idx}
                type="button"
                disabled={followUpRunning}
                onClick={() => launchFollowUp(rq)}
                className="rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:border-[#6366F1] hover:bg-indigo-50/40 hover:text-[#4F46E5] transition-colors cursor-pointer disabled:opacity-50"
              >
                {rq}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            launchFollowUp(followUpQuery)
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <input
            type="text"
            value={followUpQuery}
            onChange={(e) => setFollowUpQuery(e.target.value)}
            disabled={followUpRunning}
            placeholder="Ask a deeper follow-up question based on these findings..."
            className="flex-1 rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6366F1] focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            disabled={followUpRunning || followUpQuery.trim().length < 3}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6366F1] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#4F46E5] transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
            {followUpRunning ? 'Investigating...' : 'Run Follow-Up'}
          </button>
        </form>

        {(followUpRunning || Object.keys(followUpSteps).length > 0) && (
          <AgentWorkflowTracker stepsMap={followUpSteps} isRunning={followUpRunning} />
        )}
      </section>
    </div>
  )
}
