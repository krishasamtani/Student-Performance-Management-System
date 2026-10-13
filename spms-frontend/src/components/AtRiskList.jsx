export default function AtRiskList({ students, rules, onOpen }) {
  return (
    <div className="card gap-bottom">
      <h2>Students at risk</h2>
      <p className="hint">Average below {rules.score} or attendance below {rules.attendance}%</p>
      {students.length === 0 ? (
        <div className="empty"><b>No students at risk</b>Everyone is meeting both targets.</div>
      ) : (
        <ul className="rank">
          {students.map((s) => (
            <li key={s.id}>
              <div className="avatar risk-avatar">{s.name.charAt(0).toUpperCase()}</div>
              <div className="who">
                <b>{s.name}</b>
                <span className="sub">{s.roll_no} · {s.course}</span>
              </div>
              <div className="chips">
                {s.risk_reasons.map((r) => <span key={r} className="pill risk">{r}</span>)}
              </div>
              <button className="btn-sm" onClick={() => onOpen(s.id)}>Report</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
