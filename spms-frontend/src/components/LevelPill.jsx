const cls = { High: 'risk', Medium: 'warn', Low: 'ok' }

export default function LevelPill({ level }) {
  return <span className={`pill ${cls[level] || 'none'}`}>{level} risk</span>
}
