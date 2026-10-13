const tone = (v) => (v >= 75 ? 'good' : v >= 50 ? 'mid' : 'low')

export default function ExamProgress({ exams }) {
  const change = exams.length >= 2 ? exams[exams.length - 1].average - exams[0].average : null
  return (
    <div className="card">
      <h2>Progress across exams</h2>
      <p className="hint">Average score in each exam</p>
      {exams.length === 0 ? (
        <div className="empty"><b>No marks yet</b>Enter marks to see progress.</div>
      ) : (
        <>
          <div className="gchart short">
            {exams.map((e) => (
              <div className="gcol" key={e.exam}>
                <span className="gcount">{e.average}</span>
                <div className="gbar-wrap">
                  <div className={`gbar ${tone(e.average)}`} style={{ height: `${e.average}%` }} />
                </div>
                <span className="glabel">{e.exam}</span>
              </div>
            ))}
          </div>
          {change != null && (
            <p className={`trend-note ${change >= 0 ? 'up' : 'down'}`}>
              {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)} points from {exams[0].exam} to {exams[exams.length - 1].exam}
            </p>
          )}
        </>
      )}
    </div>
  )
}
