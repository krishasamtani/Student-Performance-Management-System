export function toneFor(value) {
  if (value >= 75) return 'good'
  if (value >= 50) return 'mid'
  return 'low'
}

export default function ProgressBar({ label, value, suffix = '' }) {
  return (
    <div className="bar-row">
      <span className="label" title={label}>{label}</span>
      <div className="bar" role="img" aria-label={`${label} ${value}${suffix}`}>
        <span className={toneFor(value)} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="value">{value}{suffix}</span>
    </div>
  )
}
