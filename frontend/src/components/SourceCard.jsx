import { ExternalLink, Globe } from 'lucide-react'

export function SourceCard({ source, highlighted = false }) {
  const scorePercent =
    typeof source.relevance_score === 'number'
      ? Math.round(Math.min(1, Math.max(0, source.relevance_score)) * 100)
      : null

  return (
    <article
      id={`source-${source.citation_id}`}
      className={`group rounded-2xl border bg-white p-4 transition-all ${
        highlighted
          ? 'border-[#6366F1] ring-2 ring-[#6366F1]/25 shadow-md'
          : 'border-slate-200 hover:border-slate-300 shadow-xs'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-[#101828] px-1.5 text-xs font-mono font-semibold text-white">
            [{source.citation_id}]
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 truncate">
            <Globe className="h-3 w-3 text-slate-500 shrink-0" />
            {source.domain}
          </span>
        </div>

        {scorePercent !== null && (
          <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-[#6366F1]">
            {scorePercent}% match
          </span>
        )}
      </div>

      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2.5 flex items-start justify-between gap-2 text-sm font-semibold text-[#101828] hover:text-[#6366F1] transition-colors"
      >
        <span className="line-clamp-2">{source.title}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-1 text-slate-400 group-hover:text-[#6366F1]" />
      </a>

      <p className="mt-2 text-xs leading-relaxed text-slate-600 line-clamp-3">
        {source.snippet}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
        <span className="truncate max-w-[240px]" title={source.url}>
          {source.url}
        </span>
        {source.published_date && <span>Published: {source.published_date}</span>}
      </div>
    </article>
  )
}
