// Loading, empty, error and data are four different screens. This renders
// the first three consistently so every page doesn't reinvent them.

export function Loading({ label = 'Loading' }) {
  return <p className="muted">{label}...</p>
}

export function ErrorState({ error, onRetry }) {
  return (
    <p className="error" role="alert">
      {error.message} <button onClick={onRetry}>Try again</button>
    </p>
  )
}

export function EmptyState({ children }) {
  return <p className="muted empty-state">{children}</p>
}
