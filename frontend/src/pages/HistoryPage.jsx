import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Clock,
  FileText,
  Globe,
  Search,
  Trash2,
} from 'lucide-react'
import { HistoryListSkeleton } from '../components/LoadingSkeleton'
import { useToast } from '../hooks/useToast'
import { deleteReport, fetchHistory, normalizeApiError } from '../services/api'

export function HistoryPage() {
  const { showToast } = useToast()
  const [items, setItems] = useState([])
  const [searchText, setSearchText] = useState('')
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  const [storageMode, setStorageMode] = useState('local')

  const loadHistory = useCallback(
    async (query = '') => {
      setLoading(true)
      try {
        const data = await fetchHistory(query)
        setItems(data.items || [])
        setStorageMode(data.storage_mode || 'local')
      } catch (err) {
        const normalized = normalizeApiError(err)
        showToast({
          type: 'error',
          title: 'Failed to load history',
          description: normalized.message,
        })
      } finally {
        setLoading(false)
      }
    },
    [showToast]
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadHistory(searchText.trim())
    }, 200)
    return () => window.clearTimeout(timer)
  }, [searchText, loadHistory])

  const handleDelete = async (researchId, title) => {
    setDeletingId(researchId)
    try {
      await deleteReport(researchId)
      setItems((prev) => prev.filter((item) => item.research_id !== researchId))
      showToast({
        type: 'success',
        title: 'Report deleted',
        description: `Removed "${title}" from research history.`,
      })
    } catch (err) {
      const normalized = normalizeApiError(err)
      showToast({
        type: 'error',
        title: 'Delete failed',
        description: normalized.message,
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#101828]">
            Research History
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Reopen, inspect, or remove saved investigations ({storageMode === 'mongodb' ? 'MongoDB persistent store' : 'session storage'}).
          </p>
        </div>

        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl bg-[#6366F1] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#4F46E5] self-start"
        >
          New Investigation
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Search & Filter */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex items-center gap-3 px-2">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Filter research reports by title, topic, or original query..."
            className="w-full bg-transparent py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => setSearchText('')}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <HistoryListSkeleton />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-base font-semibold text-[#101828]">
            {searchText ? 'No matching research reports' : 'No saved research yet'}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {searchText
              ? 'Try a different keyword or clear the search filter.'
              : 'Launch a research query in the workspace to save your first report.'}
          </p>
          <Link
            to="/dashboard"
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#101828] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D2939]"
          >
            Go to Workspace
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.research_id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-[#6366F1] font-medium">
                    <Globe className="h-3 w-3" />
                    {item.sources_count} sources
                  </span>
                  {item.parent_research_id && (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-[#4F46E5]">
                      Follow-up
                    </span>
                  )}
                </div>

                <Link
                  to={`/research/${item.research_id}`}
                  className="mt-1.5 block text-base font-bold text-[#101828] hover:text-[#6366F1] transition-colors truncate"
                >
                  {item.title}
                </Link>
                <p className="mt-1 text-xs text-slate-600 line-clamp-1">
                  Query: {item.original_query}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to={`/research/${item.research_id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2 text-xs font-semibold text-[#101828] hover:border-[#6366F1] hover:text-[#6366F1] transition-colors"
                >
                  Open Report
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>

                <button
                  type="button"
                  disabled={deletingId === item.research_id}
                  onClick={() => handleDelete(item.research_id, item.title)}
                  className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50/70 p-2 text-rose-600 hover:bg-rose-100 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Delete report"
                  aria-label={`Delete ${item.title}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
