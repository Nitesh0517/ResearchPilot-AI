import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  Clock,
  Compass,
  FileText,
  Globe,
  Layers,
  Search,
  Sparkles,
  Square,
} from 'lucide-react'
import { AgentWorkflowTracker, WORKFLOW_STEPS } from '../components/AgentWorkflowTracker'
import { ConfigAlert } from '../components/ConfigAlert'
import { useHealth } from '../hooks/useHealth'
import { useToast } from '../hooks/useToast'
import { fetchHistory, normalizeApiError, streamResearchRequest } from '../services/api'

const SUGGESTED_TOPICS = [
  {
    title: 'Agentic AI Frameworks in Production',
    query: 'Compare enterprise adoption, reliability, and orchestration patterns of AI agent frameworks in 2026',
    tag: 'AI Engineering',
  },
  {
    title: 'Grid-Scale Energy Storage & AI Data Centers',
    query: 'How are hyperscale AI data centers driving grid-scale battery storage and nuclear power agreements?',
    tag: 'Energy & Infra',
  },
  {
    title: 'Quantum-Safe Cryptography Migration',
    query: 'What are NIST post-quantum cryptography standards and enterprise migration timelines?',
    tag: 'Cybersecurity',
  },
  {
    title: 'GLP-1 Therapies Beyond Diabetes',
    query: 'Summarize clinical evidence and regulatory approvals for GLP-1 medications in cardiovascular and kidney health',
    tag: 'Biotech',
  },
]

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { health } = useHealth()

  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [depth, setDepth] = useState('standard')
  const [focus, setFocus] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [stepsMap, setStepsMap] = useState({})
  const [runError, setRunError] = useState(null)

  const [historyItems, setHistoryItems] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const abortRef = useRef(null)
  const autoRanRef = useRef(false)

  const loadRecentHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const data = await fetchHistory()
      setHistoryItems(data.items || [])
    } catch {
      setHistoryItems([])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRecentHistory()
  }, [loadRecentHistory])

  const executeResearch = useCallback(
    async (targetQuery) => {
      const trimmed = targetQuery.trim()
      if (trimmed.length < 3) {
        showToast({
          type: 'error',
          title: 'Query too short',
          description: 'Please enter a research question of at least 3 characters.',
        })
        return
      }

      if (abortRef.current) {
        abortRef.current.abort()
      }
      const controller = new AbortController()
      abortRef.current = controller

      setIsRunning(true)
      setRunError(null)

      const initialSteps = {}
      for (const s of WORKFLOW_STEPS) {
        initialSteps[s.step_key] = { ...s, status: 'pending' }
      }
      setStepsMap(initialSteps)

      try {
        const report = await streamResearchRequest(
          '/research/stream',
          {
            query: trimmed,
            depth,
            focus: focus.trim() || null,
          },
          {
            signal: controller.signal,
            onStep: (stepEvent) => {
              setStepsMap((prev) => ({
                ...prev,
                [stepEvent.step_key]: {
                  ...prev[stepEvent.step_key],
                  ...stepEvent,
                },
              }))
            },
            onError: (err) => {
              setRunError(err)
            },
          }
        )

        if (report?.research_id) {
          showToast({
            type: 'success',
            title: 'Research report ready',
            description: `Synthesized ${report.sources?.length || 0} verified sources.`,
          })
          navigate(`/research/${report.research_id}`, { state: { report } })
        }
      } catch (err) {
        if (err?.name === 'AbortError') {
          showToast({
            type: 'info',
            title: 'Research cancelled',
            description: 'The active research pipeline was stopped.',
          })
          return
        }
        const normalized = normalizeApiError(err)
        setRunError(normalized)
        showToast({
          type: 'error',
          title: 'Research could not complete',
          description: normalized.message,
        })
      } finally {
        setIsRunning(false)
      }
    },
    [depth, focus, navigate, showToast]
  )

  useEffect(() => {
    const initialQuery = searchParams.get('q')
    const autoRun = searchParams.get('autoRun') === '1'
    if (initialQuery && autoRun && !autoRanRef.current) {
      autoRanRef.current = true
      setQuery(initialQuery)
      setSearchParams({}, { replace: true })
      executeResearch(initialQuery)
    }
  }, [executeResearch, searchParams, setSearchParams])

  const handleSubmit = (e) => {
    e.preventDefault()
    executeResearch(query)
  }

  const handleCancel = () => {
    abortRef.current?.abort()
  }

  const env = health?.environment
  const missingKeys = []
  if (env && !env.tavily_configured) missingKeys.push('TAVILY_API_KEY')
  if (env && !env.gemini_configured) missingKeys.push('GEMINI_API_KEY')

  const totalReports = historyItems.length
  const totalSourcesVerified = historyItems.reduce(
    (sum, item) => sum + (item.sources_count || 0),
    0
  )
  const avgDurationSec =
    totalReports > 0
      ? (
          historyItems.reduce((sum, item) => sum + (item.duration_ms || 0), 0) /
          totalReports /
          1000
        ).toFixed(1)
      : '—'

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#101828]">
            Research Workspace
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Launch an autonomous Tavily + Gemini investigation with verified web citations.
          </p>
        </div>
        <Link
          to="/history"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 self-start"
        >
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          All Reports ({totalReports})
        </Link>
      </div>

      {/* Missing API Keys Alert */}
      {missingKeys.length > 0 && (
        <ConfigAlert
          missingKeys={missingKeys}
          message="Configure the missing environment variable(s) in .env to run live Tavily web searches and Gemini analysis."
        />
      )}

      {/* Runtime Error Alert */}
      {runError && (
        <ConfigAlert
          missingKeys={runError.missingKeys}
          message={runError.message}
        />
      )}

      {/* Real Research Statistics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Saved Reports</span>
            <FileText className="h-4 w-4 text-[#6366F1]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#101828]">{totalReports}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Stored in {env?.mongodb_status === 'connected' ? 'MongoDB' : 'local session memory'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Sources Verified</span>
            <Globe className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#101828]">{totalSourcesVerified}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Deduplicated web citations across sessions
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Avg Pipeline Time</span>
            <Layers className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#101828]">
            {avgDurationSec === '—' ? '—' : `${avgDurationSec}s`}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            End-to-end 9-step agent execution
          </p>
        </div>
      </div>

      {/* Research Input Card */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs"
      >
        <label htmlFor="research-query" className="block text-sm font-semibold text-[#101828]">
          Research Question or Investigation Topic
        </label>
        <textarea
          id="research-query"
          rows={3}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isRunning}
          placeholder="e.g., Analyze the current state of solid-state EV battery manufacturing, major industry players, timelines, and remaining technical bottlenecks."
          className="mt-2.5 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6366F1] focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-60"
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Research Depth
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {[
                { value: 'standard', label: 'Standard (3 queries)' },
                { value: 'deep', label: 'Deep (4 queries)' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isRunning}
                  onClick={() => setDepth(opt.value)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                    depth === opt.value
                      ? 'border-[#6366F1] bg-indigo-50 text-[#4F46E5]'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="research-focus" className="block text-xs font-semibold text-slate-700">
              Optional Domain / Angle Focus
            </label>
            <input
              id="research-focus"
              type="text"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              disabled={isRunning}
              placeholder="e.g., Enterprise risk, 2025-2026 benchmarks, regulatory"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#6366F1] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-[#6366F1]" />
            <span>
              Model: <strong className="font-semibold text-slate-700">{env?.gemini_model || 'gemini-3.5-flash-lite'}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {isRunning && (
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Stop Agent
              </button>
            )}
            <button
              type="submit"
              disabled={isRunning}
              className="inline-flex items-center gap-2 rounded-xl bg-[#6366F1] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4F46E5] transition-colors disabled:opacity-60 cursor-pointer shadow-sm shadow-indigo-500/20"
            >
              <Search className="h-4 w-4" />
              {isRunning ? 'Researching Live Web...' : 'Start Autonomous Research'}
            </button>
          </div>
        </div>
      </form>

      {/* Live Agent Workflow Progress */}
      {(isRunning || Object.keys(stepsMap).length > 0) && (
        <AgentWorkflowTracker stepsMap={stepsMap} isRunning={isRunning} />
      )}

      {/* Bottom Grid: Suggested Topics + Recent History */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Suggested Topics */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-[#6366F1]" />
            <h2 className="text-sm font-semibold text-[#101828]">
              Suggested Research Investigations
            </h2>
          </div>
          <div className="mt-4 space-y-2.5">
            {SUGGESTED_TOPICS.map((topic) => (
              <button
                key={topic.title}
                type="button"
                disabled={isRunning}
                onClick={() => {
                  setQuery(topic.query)
                  executeResearch(topic.query)
                }}
                className="w-full text-left rounded-xl border border-slate-200 bg-[#F8FAFC] p-3.5 hover:border-[#6366F1] hover:bg-indigo-50/30 transition-all cursor-pointer group disabled:opacity-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#101828] group-hover:text-[#6366F1]">
                    {topic.title}
                  </span>
                  <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                    {topic.tag}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 line-clamp-2">{topic.query}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Recent History */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#6366F1]" />
              <h2 className="text-sm font-semibold text-[#101828]">
                Recent Research Sessions
              </h2>
            </div>
            <Link
              to="/history"
              className="text-xs font-semibold text-[#6366F1] hover:text-[#4F46E5]"
            >
              View all
            </Link>
          </div>

          <div className="mt-4 space-y-2.5">
            {historyLoading ? (
              <div className="space-y-2.5 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : historyItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
                <p className="text-xs font-medium text-slate-600">
                  No saved research reports yet.
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Submit a query above to generate your first evidence-backed report.
                </p>
              </div>
            ) : (
              historyItems.slice(0, 4).map((item) => (
                <Link
                  key={item.research_id}
                  to={`/research/${item.research_id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[#F8FAFC] p-3.5 hover:border-[#6366F1] hover:bg-white transition-all group"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#101828] truncate group-hover:text-[#6366F1]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 truncate">
                      {item.sources_count} sources •{' '}
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-[#6366F1]" />
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
