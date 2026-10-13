const W = 560, H = 210, L = 40, R = 14, T = 14, B = 30

export default function AttendanceTrend({ data, target }) {
  const iw = W - L - R
  const ih = H - T - B
  const x = (i) => (data.length === 1 ? L + iw / 2 : L + (iw * i) / (data.length - 1))
  const y = (v) => T + ih - (ih * v) / 100
  const step = Math.ceil(data.length / 6)

  return (
    <div className="card">
      <h2>Attendance trend</h2>
      <p className="hint">Share of students present, by day</p>
      {data.length === 0 ? (
        <div className="empty"><b>No attendance yet</b>Record attendance to see the trend.</div>
      ) : (
        <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`Attendance by day, latest ${data[data.length - 1].percent}%`}>
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line className="grid-line" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
              <text x={L - 8} y={y(v) + 4} textAnchor="end">{v}%</text>
            </g>
          ))}
          <line className="target-line" x1={L} x2={W - R} y1={y(target)} y2={y(target)} />
          <text className="target-label" x={W - R} y={y(target) - 6} textAnchor="end">{target}% target</text>
          <polyline className="trend-line" fill="none"
            points={data.map((d, i) => `${x(i)},${y(d.percent)}`).join(' ')} />
          {data.map((d, i) => (
            <g key={d.date}>
              <circle className="trend-dot" cx={x(i)} cy={y(d.percent)} r="4">
                <title>{d.date}: {d.percent}% present ({d.records} students)</title>
              </circle>
              {(i % step === 0 || i === data.length - 1) && (
                <text x={x(i)} y={H - 8} textAnchor="middle">{d.date.slice(5)}</text>
              )}
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}
