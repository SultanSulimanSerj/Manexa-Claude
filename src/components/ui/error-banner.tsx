'use client'

interface ErrorBannerProps {
  message: string | null
  onDismiss?: () => void
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  if (!message) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-red-600 hover:text-red-800"
          aria-label="Закрыть"
        >
          ×
        </button>
      )}
    </div>
  )
}
