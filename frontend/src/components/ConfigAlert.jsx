import { AlertTriangle, ArrowRight, KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'

export function ConfigAlert({ missingKeys = [], message, compact = false }) {
  if (!missingKeys?.length && !message) return null

  return (
    <div
      className={`rounded-2xl border border-amber-200 bg-amber-50/80 ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          {missingKeys.length > 0 ? (
            <KeyRound className="h-4.5 w-4.5" />
          ) : (
            <AlertTriangle className="h-4.5 w-4.5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-amber-950">
            API Configuration Required
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-amber-900">
            {message ||
              'ResearchPilot AI requires real Tavily and Google Gemini API keys to execute live web research. Hardcoded fallback results are disabled.'}
          </p>
          {missingKeys.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {missingKeys.map((keyName) => (
                <span
                  key={keyName}
                  className="inline-flex items-center rounded-md border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-mono font-semibold text-amber-900"
                >
                  {keyName}
                </span>
              ))}
            </div>
          )}
        </div>
        <Link
          to="/settings"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#101828] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#1D2939] transition-colors self-start"
        >
          View Settings
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
