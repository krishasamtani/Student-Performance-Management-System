import { useEffect, useState } from 'react'
import { api } from '../api'
import ProgressBar from '../components/ProgressBar'
import LoadError from '../components/LoadError'

export default function Courses({ version }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  const load = () => {
    setError('')
    return api.courses().then(setRows).catch((e) => setError(e.message))
  }

  useEffect(() => { load() }, [version]) // eslint-disable-line react-hooks/exhaustive-deps

  const scored = (rows || []).filter((c) => c.average_score != null)
  const attended = (rows || []).filter((c) => c.average_attendance != null)

  return (
    <>
      <div className="page-head">
        <h1>Courses</h1>
        <p>Compare how each course is performing.</p>
      </div>
      {error ? (
        <LoadError title="Could not load courses" message={error} onRetry={load} />
      ) : rows === null ? (
        <div className="card"><div className="empty">Loading courses</div></div>
      ) : rows.length === 0 ? (
        <div className="card"><div className="empty"><b>No courses yet</b>Courses appear once you add students.</div></div>
      ) : (
        <>
          <div className="grid-2 even gap-bottom">
            <div className="card">
              <h2>Average score by course</h2>
              <p className="hint">Mean of each student's average</p>
              {scored.length === 0
                ? <div className="empty">No marks yet</div>
                : scored.map((c) => <ProgressBar key={c.course} label={c.course} value={c.average_score} />)}
            </div>
            <div className="card">
              <h2>Attendance by course</h2>
              <p className="hint">Share of recorded days present</p>
              {attended.length === 0
                ? <div className="empty">No attendance yet</div>
                : attended.map((c) => <ProgressBar key={c.course} label={c.course} value={c.average_attendance} suffix="%" />)}
            </div>
          </div>
          <div className="card">
            <h2>Course summary</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Course</th><th>Students</th><th>Average score</th><th>Attendance</th><th>Pass rate</th><th>At risk</th></tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.course}>
                      <td className="name">{c.course}</td>
                      <td>{c.students}</td>
                      <td>{c.average_score ?? '-'}</td>
                      <td>{c.average_attendance != null ? `${c.average_attendance}%` : '-'}</td>
                      <td>{c.pass_rate != null ? `${c.pass_rate}%` : '-'}</td>
                      <td>{c.at_risk > 0 ? <span className="pill risk">{c.at_risk}</span> : <span className="pill ok">0</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  )
}
