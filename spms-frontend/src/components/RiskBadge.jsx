export default function RiskBadge({ student }) {
  if (student.at_risk) {
    return <span className="pill risk" title={student.risk_reasons.join('. ')}>At risk</span>
  }
  if (student.average == null && student.attendance == null) {
    return <span className="pill none">No data</span>
  }
  return <span className="pill ok">On track</span>
}
