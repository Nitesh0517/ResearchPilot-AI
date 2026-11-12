import {
  CheckCircle2,
  Database,
  Globe,
  KeyRound,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { useHealth } from '../hooks/useHealth'

function StatusPill({ ok, labelOk = 'Configured', labelMissing = 'Missing' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {ok ? labelOk : labelMissing}
    </span>
  )
}

export function SettingsPage() {
  const { health, loading, error, refresh } = useHealth()
  const env = health?.environment

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#101828]">
            Settings & API Status
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Verify live backend connectivity, environment configuration, and model settings.
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Status
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-xs text-rose-800">
          <strong>Backend Unreachable:</strong> {error.message}. Make sure the FastAPI server
          is running on port 8000.
        </div>
      )}

      {/* Integration Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-[#6366F1]">
                <Globe className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#101828]">Tavily Search API</h3>
                <p className="text-[11px] font-mono text-slate-500">TAVILY_API_KEY</p>
              </div>
            </div>
            <StatusPill ok={Boolean(env?.tavily_configured)} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-600">
            Powers autonomous web search, content extraction, and real-time URL discovery.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-[#6366F1]">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#101828]">Google Gemini API</h3>
                <p className="text-[11px] font-mono text-slate-500">GEMINI_API_KEY</p>
              </div>
            </div>
            <StatusPill ok={Boolean(env?.gemini_configured)} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-600">
            Active model:{' '}
            <span className="font-mono font-semibold text-slate-800">
              {env?.gemini_model || 'gemini-3.5-flash-lite'}
            </span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-[#6366F1]">
                <Database className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#101828]">MongoDB Persistence</h3>
                <p className="text-[11px] font-mono text-slate-500">MONGODB_URI</p>
              </div>
            </div>
            <StatusPill
              ok={env?.mongodb_status === 'connected'}
              labelOk="Connected"
              labelMissing={
                env?.mongodb_configured ? env?.mongodb_status || 'Error' : 'Not Set'
              }
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-600">
            {env?.mongodb_status === 'connected'
              ? 'Research reports are persisted in MongoDB.'
              : 'Using local in-memory session storage. Set MONGODB_URI for database persistence.'}
          </p>
        </div>
      </div>

      {/* Secure Environment Configuration Instructions */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4.5 w-4.5 text-[#6366F1]" />
          <h2 className="text-base font-bold text-[#101828]">
            Backend Environment Configuration
          </h2>
        </div>

        <p className="text-xs leading-relaxed text-slate-600">
          For security, API keys are never exposed in frontend code or stored in browser
          storage. Configure them in a <code className="font-mono font-semibold">.env</code>{' '}
          file at the repository root (or inside <code className="font-mono">backend/.env</code>)
          and restart the FastAPI server.
        </p>

        <pre className="overflow-x-auto rounded-xl bg-[#101828] p-4 text-xs font-mono text-slate-200 leading-relaxed">
{`TAVILY_API_KEY=tvly-your-real-api-key
GEMINI_API_KEY=your-google-gemini-api-key
MONGODB_URI=mongodb://localhost:27017
GEMINI_MODEL=gemini-3.5-flash-lite`}
        </pre>
      </section>

      {/* Application Information */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center gap-2">
          <Server className="h-4.5 w-4.5 text-[#6366F1]" />
          <h2 className="text-base font-bold text-[#101828]">Application Information</h2>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-3.5">
            <p className="text-slate-500">Platform</p>
            <p className="mt-1 font-semibold text-[#101828]">ResearchPilot AI</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-3.5">
            <p className="text-slate-500">Event Track</p>
            <p className="mt-1 font-semibold text-[#101828]">
              Global AI Hackathon (Tavily)
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-3.5">
            <p className="text-slate-500">API Version</p>
            <p className="mt-1 font-semibold text-[#101828]">
              {health?.version || '1.0.0'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-[#F8FAFC] p-3.5">
            <p className="text-slate-500">Citation Policy</p>
            <p className="mt-1 font-semibold text-emerald-700 inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Strict Source Grounding
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
