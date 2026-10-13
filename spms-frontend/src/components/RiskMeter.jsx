export default function RiskMeter({ percent, level }) {
  return (
    <div className="meter" role="img" aria-label={`${percent}% chance of failing`}>
      <div className="meter-track">
        <span className={`meter-fill ${level.toLowerCase()}`} style={{ width: `${Math.max(percent, 2)}%` }} />
      </div>
      <span className="meter-value">{percent}%</span>
    </div>
  )
}
