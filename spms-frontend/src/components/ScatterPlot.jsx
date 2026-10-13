const W = 520, H = 340, L = 44, R = 16, T = 14, B = 40

// Actual vs predicted final scores on the held-out test set. Points on the diagonal are perfect.
export default function ScatterPlot({ points, passMark }) {
  const x = (v) => L + ((W - L - R) * v) / 100
  const y = (v) => H - B - ((H - T - B) * v) / 100
  const ticks = [0, 25, 50, 75, 100]
  return (
    <svg className="scatter" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label="Actual versus predicted final scores for the test students">
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid-line" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
          <text x={L - 8} y={y(t) + 4} textAnchor="end">{t}</text>
          <text x={x(t)} y={H - B + 18} textAnchor="middle">{t}</text>
        </g>
      ))}
      <line className="target-line" x1={x(0)} y1={y(0)} x2={x(100)} y2={y(100)} />
      <line className="pass-line" x1={x(passMark)} x2={x(passMark)} y1={y(0)} y2={y(100)} />
      <line className="pass-line" x1={x(0)} x2={x(100)} y1={y(passMark)} y2={y(passMark)} />
      {points.map((p, i) => (
        <circle key={i} className="scatter-dot" cx={x(p.actual)} cy={y(p.predicted)} r="4.5">
          <title>Actual {p.actual}, predicted {p.predicted}</title>
        </circle>
      ))}
      <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle">Actual final score</text>
      <text transform={`translate(12 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle">Predicted final score</text>
    </svg>
  )
}
