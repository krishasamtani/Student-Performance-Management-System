export default function StatCard({ label, value, unit, tone = '' }) {
  return (
    <div className={`card stat ${tone}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {unit && <small> {unit}</small>}
      </div>
    </div>
  )
}
