export function CitationBadge({ citationId, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(citationId)}
      className="inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-mono font-semibold text-[#6366F1] hover:bg-[#6366F1] hover:text-white transition-colors cursor-pointer"
      title={`Jump to source [${citationId}]`}
    >
      [{citationId}]
    </button>
  )
}
