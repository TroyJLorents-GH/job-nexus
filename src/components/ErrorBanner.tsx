import { AlertCircle, X } from 'lucide-react'
import { errorMessage } from '../lib/errors'

interface ErrorBannerProps {
  /** A thrown value, or a plain string. Renders nothing when falsy. */
  error: unknown
  /** What the user was trying to do, e.g. "save this job". */
  action?: string
  onDismiss?: () => void
  className?: string
}

/**
 * Inline failure notice. Every mutation in this app should render one — a write
 * that fails with no visible message is how an expired-rules outage went
 * unnoticed for four months.
 */
export function ErrorBanner({ error, action, onDismiss, className = '' }: ErrorBannerProps) {
  if (!error) return null

  const detail = errorMessage(error)
  const message = action ? `Couldn't ${action}. ${detail}` : detail

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 ${className}`}
    >
      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" aria-hidden="true" />
      <p className="flex-1 text-sm text-red-800">{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="flex-shrink-0 rounded p-0.5 text-red-500 hover:bg-red-100 hover:text-red-700"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
