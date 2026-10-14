import { useEffect, useState } from 'react'
import { api } from '../api'
import StatCard from '../components/StatCard'
import RiskMeter from '../components/RiskMeter'
import LevelPill from '../components/LevelPill'
import LoadError from '../components/LoadError'

const sorters = {
  risk: (a, b) => b.prediction.fail_probability - a.prediction.fail_probability,
  low: (a, b) => a.prediction.predicted_final - b.prediction.predicted_final,
  name: (a, b) => a.name.localeCompare(b.name),
}

export default function Predictions({ version }) {
  const [data, setData] = useState(null)
  const [sortBy, setSortBy] = useState('risk')
  const [error, setError] = useState('')

  const load = () => {
    setError('')
    return api.mlPredictions().then(setData).catch((e) => setError(e.message))
  }

  useEffect(() => { load() }, [version]) // eslint-disable-line react-hooks/exhaustive-deps

  const ready = data ? data.students.filter((s) => s.prediction.available).sort(sorters[sortBy]) : []
  const waiting = data ? data.students.filter((s) => !s.prediction.available) : []
  const failing = ready.filter((s) => s.prediction.fail_probability >= 50).length
  const high = ready.filter((s) => s.prediction.risk_level === 'High').length
  const avgFinal = ready.length
    ? (ready.reduce((sum, s) => sum + s.prediction.predicted_final, 0) / ready.length).toFixed(1) : '-'

  return (
    <>
      <div className="page-head">
        <h1>Predictions</h1>
        <p>Who is likely to struggle in the final exam, and why.</p>
      </div>
      {error ? (
        <LoadError title="Could not load predictions" message={error} onRetry={load} />
      ) : data === null ? (
        <div className="card"><div className="empty">Loading predictions</div></div>
      ) : (
        <>
          <div className="notice">
            Estimated with linear and logistic regression trained on <b>{data.source_label}</b>.{' '}
            <a href="#/model">See how the model works</a>
          </div>
          <div className="grid-stats">
            <StatCard label="Predicted to fail" value={failing} tone="red" />
            <StatCard label="High risk" value={high} tone="amber" />
            <StatCard label="Average predicted final" value={avgFinal} unit="/ 100" tone="blue" />
            <StatCard label="Waiting for data" value={waiting.length} />
          </div>
          <div className="card gap-bottom">
            <div className="row-tools">
              <div>
                <h2>Student predictions</h2>
                <span className="sub">Based on mid-term average and attendance</span>
              </div>
              <select className="select-inline" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort predictions">
                <option value="risk">Highest risk first</option>
                <option value="low">Lowest predicted score first</option>
                <option value="name">Name</option>
              </select>
            </div>
            {ready.length === 0 ? (
              <div className="empty"><b>No predictions yet</b>Add mid-term marks and attendance for a student.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Student</th><th>Mid-term</th><th>Attendance</th><th>Predicted final</th>
                      <th>Chance of failing</th><th>Level</th><th>Main driver</th><th>Actual final</th></tr>
                  </thead>
                  <tbody>
                    {ready.map((s) => (
                      <tr key={s.id}>
                        <td><a className="name name-link" href={`#/student/${s.id}`}>{s.name}</a><div className="sub">{s.roll_no}</div></td>
                        <td>{s.midterm_avg}</td>
                        <td>{s.attendance}%</td>
                        <td><b>{s.prediction.predicted_final}</b></td>
                        <td className="meter-cell"><RiskMeter percent={s.prediction.fail_probability} level={s.prediction.risk_level} /></td>
                        <td><LevelPill level={s.prediction.risk_level} /></td>
                        <td>{s.prediction.main_driver || <span className="sub">None</span>}</td>
                        <td>{s.actual_final ?? <span className="sub">Not taken</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {waiting.length > 0 && (
            <div className="card">
              <h2>Waiting for data</h2>
              <p className="hint">These students need a little more information before a prediction is possible.</p>
              <ul className="rank">
                {waiting.map((s) => (
                  <li key={s.id}>
                    <div className="who"><a className="name-link" href={`#/student/${s.id}`}><b>{s.name}</b></a>
                      <span className="sub">{s.roll_no} · {s.course}</span></div>
                    <span className="pill none">{s.prediction.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  )
}
