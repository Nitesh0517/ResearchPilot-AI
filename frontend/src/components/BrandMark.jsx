import { Compass } from 'lucide-react'

export function BrandMark({ dark = false, size = 'md' }) {
  const boxSize = size === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl'
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'

  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`flex ${boxSize} items-center justify-center bg-gradient-to-br from-[#6366F1] to-[#4338CA] text-white shadow-sm shadow-indigo-500/30`}
      >
        <Compass className={iconSize} />
      </div>
      <div className="flex flex-col leading-none">
        <span
          className={`text-base font-bold tracking-tight ${
            dark ? 'text-white' : 'text-[#101828]'
          }`}
        >
          ResearchPilot <span className="text-[#6366F1]">AI</span>
        </span>
        <span
          className={`mt-0.5 text-[10px] font-medium uppercase tracking-wider ${
            dark ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          Tavily × Gemini Agent
        </span>
      </div>
    </div>
  )
}
