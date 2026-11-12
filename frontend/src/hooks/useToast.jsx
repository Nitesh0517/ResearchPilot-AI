import { createContext, useCallback, useContext, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const showToast = useCallback(
    ({ title, description, type = 'info', duration = 4500 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setToasts((prev) => [...prev, { id, title, description, type }])
      if (duration > 0) {
        window.setTimeout(() => {
          dismissToast(id)
        }, duration)
      }
      return id
    },
    [dismissToast]
  )

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0 pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const palette =
              toast.type === 'success'
                ? {
                    border: 'border-emerald-200',
                    bg: 'bg-white',
                    icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />,
                  }
                : toast.type === 'error'
                  ? {
                      border: 'border-rose-200',
                      bg: 'bg-white',
                      icon: <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />,
                    }
                  : {
                      border: 'border-indigo-200',
                      bg: 'bg-white',
                      icon: <Info className="h-5 w-5 text-indigo-600 shrink-0" />,
                    }

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${palette.border} ${palette.bg} p-4 shadow-lg shadow-slate-900/5`}
              >
                {palette.icon}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
                  {toast.description && (
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                      {toast.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  aria-label="Close notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}
