import GradeBadge from './GradeBadge'

export default function TopPerformers({ top = [], onOpen }) {
  return (
    <div className="card">
      <h2>Top performers</h2>
      <p className="hint">Highest average score</p>
      {top.length === 0 ? (
        <div className="empty"><b>Nobody ranked yet</b>Marks will rank students here.</div>
      ) : (
        <ul className="rank">
          {top.map((t) => (
            <li key={t.id}>
              <div className="avatar">{t.name.charAt(0).toUpperCase()}</div>
              <div className="who">
                <b>{t.name}</b>
                <span className="sub">{t.roll_no}</span>
              </div>
              <span className="score">{t.average}</span>
              <GradeBadge grade={t.grade} />
              <button className="btn-sm" onClick={() => onOpen(t.id)}>Report</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}