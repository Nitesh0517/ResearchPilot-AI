import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  History,
  Home,
  LayoutDashboard,
  Menu,
  Settings,
  Sparkles,
  X,
} from 'lucide-react'
import { BrandMark } from '../components/BrandMark'
import { useHealth } from '../hooks/useHealth'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Research Workspace', icon: LayoutDashboard },
  { to: '/history', label: 'Research History', icon: History },
  { to: '/settings', label: 'Settings & API Status', icon: Settings },
]

export function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { health } = useHealth()

  const env = health?.environment
  const allReady = Boolean(env?.tavily_configured && env?.gemini_configured)

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#101828] text-slate-200 p-4">
      <div>
        <div className="flex items-center justify-between px-2 py-2">
          <Link to="/" onClick={() => setMobileOpen(false)}>
            <BrandMark dark />
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Workspace
          </p>
          <nav className="mt-2 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#6366F1] text-white shadow-sm shadow-indigo-500/25'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>
        </div>

        <div className="mt-6 px-1">
          <Link
            to="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            Back to Landing Page
          </Link>
        </div>
      </div>

      {/* Live API Status Pill */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white">Agent Status</span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              allReady
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-amber-500/15 text-amber-300'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                allReady ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            {allReady ? 'Live Ready' : 'Setup Needed'}
          </span>
        </div>
        <div className="mt-2.5 space-y-1.5 text-[11px] text-slate-400">
          <div className="flex items-center justify-between">
            <span>Tavily Search</span>
            <span className={env?.tavily_configured ? 'text-emerald-300' : 'text-amber-300'}>
              {env?.tavily_configured ? 'Connected' : 'Missing Key'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Google Gemini</span>
            <span className={env?.gemini_configured ? 'text-emerald-300' : 'text-amber-300'}>
              {env?.gemini_configured ? 'Connected' : 'Missing Key'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Storage</span>
            <span className="text-slate-300">
              {env?.mongodb_status === 'connected' ? 'MongoDB' : 'Local Session'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-68 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] h-full">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/85 backdrop-blur-md px-4 sm:px-6 lg:px-8 h-14">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-[#6366F1]" />
              <span>Global AI Hackathon • Tavily Autonomous Research Agent</span>
            </div>
          </div>

          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#6366F1] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#4F46E5] transition-colors shadow-xs"
          >
            New Research
          </Link>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
