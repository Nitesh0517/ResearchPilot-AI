export function ReportSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="h-4 w-32 rounded-full bg-slate-200" />
        <div className="mt-4 h-8 w-3/4 rounded-lg bg-slate-200" />
        <div className="mt-4 space-y-2.5">
          <div className="h-4 w-full rounded bg-slate-100" />
          <div className="h-4 w-11/12 rounded bg-slate-100" />
          <div className="h-4 w-4/5 rounded bg-slate-100" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((idx) => (
          <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="h-4 w-24 rounded-full bg-indigo-100" />
            <div className="mt-3 h-5 w-2/3 rounded bg-slate-200" />
            <div className="mt-3 space-y-2">
              <div className="h-3.5 w-full rounded bg-slate-100" />
              <div className="h-3.5 w-5/6 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HistoryListSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4].map((idx) => (
        <div
          key={idx}
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5"
        >
          <div className="space-y-2.5 flex-1">
            <div className="h-5 w-1/2 rounded bg-slate-200" />
            <div className="h-3.5 w-3/4 rounded bg-slate-100" />
          </div>
          <div className="h-9 w-24 rounded-xl bg-slate-100 ml-4" />
        </div>
      ))}
    </div>
  )
}
