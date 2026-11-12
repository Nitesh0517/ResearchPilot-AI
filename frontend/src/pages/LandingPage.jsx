import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Database,
  FileDown,
  Globe,
  Layers,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { BrandMark } from '../components/BrandMark'

const EXAMPLE_QUERIES = [
  'Impact of open-weight LLMs on enterprise AI adoption in 2025-2026',
  'Solid-state battery commercialization timeline and manufacturing bottlenecks',
  'EU AI Act compliance requirements for foundation model providers',
]

const FEATURES = [
  {
    icon: Globe,
    title: 'Live Tavily Web Intelligence',
    description:
      'Executes multi-angle web searches across current sources, extracting titles, domains, URLs, and full context snippets.',
  },
  {
    icon: Sparkles,
    title: 'Gemini Cross-Source Synthesis',
    description:
      'Google Gemini compares evidence across independent publications to surface consensus, nuances, and key takeaways.',
  },
  {
    icon: ShieldCheck,
    title: 'Fact vs. Analysis Separation',
    description:
      'Explicitly separates retrieved source facts from AI-generated interpretation and never fabricates citations or statistics.',
  },
  {
    icon: BookOpenCheck,
    title: 'Verified Source Citations',
    description:
      'Every finding and quantitative claim is validated by our Citation Manager against real retrieved Tavily URLs.',
  },
  {
    icon: FileDown,
    title: 'Executive PDF Reports',
    description:
      'Exports structured reports with executive summary, problem overview, findings, analysis, conclusion, and references.',
  },
  {
    icon: Database,
    title: 'Persistent Research Memory',
    description:
      'Save sessions to MongoDB, search historical investigations, and launch evidence-grounded follow-up research.',
  },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Query Analyzer & Planner',
    detail: 'Identifies core intent and decomposes complex questions into targeted sub-queries.',
  },
  {
    step: '02',
    title: 'Tavily Search & Deduplication',
    detail: 'Searches the live web in parallel, removes duplicate URLs, and ranks high-signal evidence.',
  },
  {
    step: '03',
    title: 'Gemini Synthesis & Citation Audit',
    detail: 'Produces structured insights while auditing every [n] reference against retrieved sources.',
  },
  {
    step: '04',
    title: 'Structured Report & PDF Export',
    detail: 'Delivers an interactive report with clickable citations, follow-up prompts, and PDF download.',
  },
]

export function LandingPage() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) {
      navigate('/dashboard')
      return
    }
    navigate(`/dashboard?q=${encodeURIComponent(trimmed)}&autoRun=1`)
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/">
            <BrandMark />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-[#101828] transition-colors">
              Features
            </a>
            <a href="#workflow" className="hover:text-[#101828] transition-colors">
              Agent Workflow
            </a>
            <Link to="/history" className="hover:text-[#101828] transition-colors">
              History
            </Link>
            <Link to="/settings" className="hover:text-[#101828] transition-colors">
              API Status
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#101828] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#1D2939] transition-colors shadow-xs"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-white via-[#F8FAFC] to-[#F8FAFC] pt-14 pb-20 sm:pt-20 sm:pb-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 flex justify-center">
          <div className="h-72 w-[720px] rounded-full bg-indigo-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-3.5 py-1 text-xs font-semibold text-[#4F46E5]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Global AI Hackathon — Tavily Autonomous Research Agent
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="mt-6 text-4xl font-extrabold tracking-tight text-[#101828] sm:text-5xl lg:text-6xl leading-[1.1]"
          >
            Autonomous Web Research &{' '}
            <span className="bg-gradient-to-r from-[#6366F1] to-[#4338CA] bg-clip-text text-transparent">
              Evidence-Grounded
            </span>{' '}
            Intelligence
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="mx-auto mt-5 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600"
          >
            ResearchPilot AI plans multi-step investigations, searches the live web via Tavily,
            analyzes evidence with Google Gemini, and delivers citation-verified reports with
            downloadable PDFs.
          </motion.p>

          {/* Main Hero Search Bar */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className="mx-auto mt-9 max-w-2xl"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/5 focus-within:border-[#6366F1] focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all">
              <div className="flex flex-1 items-center gap-3 px-3 py-2">
                <Search className="h-5 w-5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask a complex research question (e.g., AI grid energy demand)..."
                  className="w-full bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6366F1] px-5 py-3 text-sm font-semibold text-white hover:bg-[#4F46E5] transition-colors cursor-pointer shrink-0"
              >
                Launch Agent
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.form>

          {/* Example Pills */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-medium text-slate-500">Try:</span>
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() =>
                  navigate(`/dashboard?q=${encodeURIComponent(example)}&autoRun=1`)
                }
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-[#6366F1] hover:text-[#6366F1] transition-colors cursor-pointer"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#6366F1]">
            Built for Verifiable Research
          </p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#101828]">
            Not a chatbot. A full-stack autonomous research pipeline.
          </h2>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-indigo-200 hover:shadow-md transition-all"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-[#6366F1]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-[#101828]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {feature.description}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* How It Works */}
      <section id="workflow" className="border-t border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6366F1]">
                9-Step Agent Architecture
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#101828]">
                How ResearchPilot AI investigates every query
              </h2>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#6366F1] hover:text-[#4F46E5]"
            >
              Open Research Workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.step}
                className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5"
              >
                <span className="inline-flex rounded-lg bg-[#101828] px-2.5 py-1 text-xs font-mono font-bold text-white">
                  STEP {item.step}
                </span>
                <h3 className="mt-4 text-base font-semibold text-[#101828]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl bg-[#101828] p-6 sm:p-8 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                <Layers className="h-4 w-4" />
                Ready to investigate with live web citations?
              </div>
              <h3 className="mt-2 text-xl sm:text-2xl font-bold">
                Start your first autonomous research report
              </h3>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Live Tavily Search
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Gemini Structured Analysis
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  PDF Export & MongoDB History
                </span>
              </div>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-[#6366F1] px-5 py-3 text-sm font-semibold text-white hover:bg-[#4F46E5] transition-colors shrink-0"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
