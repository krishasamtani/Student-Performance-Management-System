import { useEffect, useState } from 'react'
import { api } from '../api'
import RiskMeter from './RiskMeter'

export default function PredictionTeaser({ version }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let stale = false
    api.mlPredictions()
      .then((d) => {
        if (stale) return
        const ready = d.students.filter((s) => s.prediction.available)
        ready.sort((a, b) => b.prediction.fail_probability - a.prediction.fail_probability)
        setRows(ready.slice(0, 3))
      })
      .catch(() => { if (!stale) setRows([]) })
    return () => { stale = true }
  }, [version])

  return (
    <div className="card gap-bottom">
      <div className="row-tools">
        <div>
          <h2>Predicted to struggle</h2>
          <span className="sub">Highest chance of failing the final, from the regression model</span>
        </div>
        <a className="link-btn" href="#/predictions">All predictions →</a>
      </div>
      {rows === null ? (
        <div className="empty">Loading predictions</div>
      ) : rows.length === 0 ? (
        <div className="empty"><b>No predictions yet</b>A student needs mid-term marks and attendance.</div>
      ) : (
        <ul className="rank">
          {rows.map((s) => (
            <li key={s.id}>
              <div className="who">
                <a className="name-link" href={`#/student/${s.id}`}><b>{s.name}</b></a>
                <span className="sub">Predicted final {s.prediction.predicted_final}</span>
              </div>
              <div className="teaser-meter"><RiskMeter percent={s.prediction.fail_probability} level={s.prediction.risk_level} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
