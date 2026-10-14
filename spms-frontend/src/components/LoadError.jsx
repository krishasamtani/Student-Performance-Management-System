export default function LoadError({ title, message, onRetry }) {
  return (
    <div className="card">
      <div className="empty">
        <b>{title}</b>
        <span>{message}</span>
        <p className="hint" style={{ marginTop: 10 }}>
          If you just updated the code, rebuild the backend with <code>docker compose up -d --build</code>,
          then try again.
        </p>
        {onRetry && <button className="btn ghost retry-btn" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  )
}
