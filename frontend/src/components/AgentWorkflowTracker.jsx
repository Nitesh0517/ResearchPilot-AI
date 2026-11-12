import { motion } from 'framer-motion'
import {
  AlertTriangle,
  BookOpenCheck,
  Check,
  Database,
  FileText,
  Filter,
  Globe,
  Layers,
  Loader2,
  Search,
  Sparkles,
} from 'lucide-react'

export const WORKFLOW_STEPS = [
  {
    step_number: 1,
    step_key: 'query_received',
    title: 'Query Input',
    description: 'Validating research prompt & initializing agent session',
    icon: Search,
  },
  {
    step_number: 2,
    step_key: 'query_analyzer',
    title: 'Query Analyzer',
    description: 'Understanding user intent, scope & core topic via Gemini',
    icon: Sparkles,
  },
  {
    step_number: 3,
    step_key: 'research_planner',
    title: 'Research Planner',
    description: 'Decomposing topic into targeted web research sub-questions',
    icon: Layers,
  },
  {
    step_number: 4,
    step_key: 'tavily_search',
    title: 'Tavily Search Agent',
    description: 'Retrieving live multi-source web evidence via Tavily API',
    icon: Globe,
  },
  {
    step_number: 5,
    step_key: 'information_processing',
    title: 'Information Processing',
    description: 'Cleaning content, ranking relevance & deduplicating URLs',
    icon: Filter,
  },
  {
    step_number: 6,
    step_key: 'gemini_analysis',
    title: 'Gemini Analysis Agent',
    description: 'Synthesizing cross-source findings without unsupported claims',
    icon: Sparkles,
  },
  {
    step_number: 7,
    step_key: 'citation_manager',
    title: 'Citation Manager',
    description: 'Verifying every finding against retrieved source URLs',
    icon: BookOpenCheck,
  },
  {
    step_number: 8,
    step_key: 'report_generator',
    title: 'Report Generator',
    description: 'Structuring executive summary, statistics & references',
    icon: FileText,
  },
  {
    step_number: 9,
    step_key: 'final_output',
    title: 'Final Output & Persistence',
    description: 'Storing research session & preparing downloadable PDF report',
    icon: Database,
  },
]

export function AgentWorkflowTracker({ stepsMap = {}, isRunning = false }) {
  const completedCount = WORKFLOW_STEPS.filter(
    (step) => stepsMap[step.step_key]?.status === 'completed'
  ).length
  const progressPercent = Math.round((completedCount / WORKFLOW_STEPS.length) * 100)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-2.5 w-2.5 rounded-full ${
                isRunning
                  ? 'bg-[#6366F1] animate-pulse'
                  : completedCount === WORKFLOW_STEPS.length
                    ? 'bg-emerald-500'
                    : 'bg-slate-300'
              }`}
            />
            <h3 className="text-sm font-semibold text-[#101828]">
              Autonomous Research Agent Pipeline
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Live execution across Tavily Web Search and Google Gemini synthesis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {completedCount} / {WORKFLOW_STEPS.length} steps
          </span>
          <span className="text-xs font-mono font-semibold text-[#6366F1]">
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#6366F1] to-[#4338CA]"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        />
      </div>

      {/* Steps Grid */}
      <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {WORKFLOW_STEPS.map((step) => {
          const live = stepsMap[step.step_key]
          const status = live?.status || 'pending'
          const Icon = step.icon

          const cardStyle =
            status === 'completed'
              ? 'border-emerald-200/80 bg-emerald-50/40'
              : status === 'running'
                ? 'border-indigo-300 bg-indigo-50/60 ring-2 ring-indigo-500/15'
                : status === 'error'
                  ? 'border-rose-200 bg-rose-50/60'
                  : 'border-slate-200/80 bg-slate-50/50'

          return (
            <div
              key={step.step_key}
              className={`rounded-xl border p-3.5 transition-all ${cardStyle}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${
                      status === 'completed'
                        ? 'bg-emerald-600 text-white'
                        : status === 'running'
                          ? 'bg-[#6366F1] text-white'
                          : status === 'error'
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {status === 'completed' ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : status === 'running' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : status === 'error' ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">
                      {step.step_number}. {step.title}
                    </p>
                  </div>
                </div>
                {live?.duration_ms != null && status === 'completed' && (
                  <span className="text-[10px] font-mono text-slate-500">
                    {live.duration_ms}ms
                  </span>
                )}
              </div>

              <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                {live?.summary || step.description}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
