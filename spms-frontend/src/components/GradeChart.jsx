const tone = { 'A+': 'good', A: 'good', B: 'blue', C: 'mid', D: 'low', F: 'low' }

export default function GradeChart({ data }) {
  const total = data.reduce((sum, d) => sum + d.count, 0)
  const max = Math.max(1, ...data.map((d) => d.count))

  return (
    <div className="card">
      <h2>Grade distribution</h2>
      <p className="hint">Students per overall grade</p>
      {total === 0 ? (
        <div className="empty"><b>No grades yet</b>Grades appear once marks are entered.</div>
      ) : (
        <div className="gchart" role="img"
          aria-label={data.map((d) => `${d.grade}: ${d.count}`).join(', ')}>
          {data.map((d) => (
            <div className="gcol" key={d.grade}>
              <span className="gcount">{d.count}</span>
              <div className="gbar-wrap">
                <div className={`gbar ${tone[d.grade]}`} style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 4 : 0 }} />
              </div>
              <span className="glabel">{d.grade}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
