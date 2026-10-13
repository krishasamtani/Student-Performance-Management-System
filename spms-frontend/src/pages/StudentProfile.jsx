import { useEffect, useState } from 'react'
import { api, downloadReportPdf } from '../api'
import { EXAMS } from '../utils'
import Icon from '../components/Icon'
import GradeBadge from '../components/GradeBadge'
import StatCard from '../components/StatCard'
import RiskMeter from '../components/RiskMeter'
import LevelPill from '../components/LevelPill'
import ExamProgress from '../components/ExamProgress'
import AttendanceCalendar from '../components/AttendanceCalendar'

export default function StudentProfile({ id, version, onError }) {
  const [r, setR] = useState(null)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let stale = false
    api.report(id)
      .then((d) => { if (!stale) { setR(d); setMissing(false) } })
      .catch(() => { if (!stale) { setR(null); setMissing(true) } })
    return () => { stale = true }
  }, [id, version])

  async function download() {
    setBusy(true)
    try { await downloadReportPdf(id, `report-${r.roll_no}.pdf`) } catch (e) { onError(e.message) } finally { setBusy(false) }
  }

  if (missing) {
    return (
      <div className="card">
        <div className="empty"><b>Student not found</b><a href="#/students">Back to students</a></div>
      </div>
    )
  }
  if (!r) return <div className="card"><div className="empty">Loading student</div></div>

  const subjects = [...new Set(r.marks.map((m) => m.subject))]
  const examsUsed = EXAMS.filter((e) => r.marks.some((m) => m.exam_type === e))
  const score = (subject, exam) => r.marks.find((m) => m.subject === subject && m.exam_type === exam)?.score
  const p = r.prediction

  return (
    <>
      <a className="back-link" href="#/students"><Icon name="back" size={16} /> Students</a>
      <div className="page-head profile-head">
        <div>
          <h1>{r.name}</h1>
          <p>{r.roll_no} · {r.course}</p>
        </div>
        <button className="btn teal download-btn" onClick={download} disabled={busy}>
          {busy ? 'Creating PDF' : 'Download PDF report card'}
        </button>
      </div>

      {r.at_risk && (
        <div className="risk-banner gap-bottom">
          <b>At risk</b>
          <ul>{r.risk_reasons.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}

      <div className="grid-stats">
        <StatCard label="Average score" value={r.average} unit="/ 100" tone="blue" />
        <div className="card stat">
          <div className="stat-label">Overall grade</div>
          <div className="stat-value"><GradeBadge grade={r.grade} /></div>
        </div>
        <StatCard label="Attendance" value={r.attendance_percent} unit="%" tone="amber" />
        <StatCard label="Days recorded" value={r.days_recorded} />
      </div>

      <div className="grid-2 even gap-bottom">
        <ExamProgress exams={r.exams} />
        <div className="card">
          <h2>Model outlook</h2>
          <p className="hint">Predicted from mid-term average and attendance</p>
          {p && p.available ? (
            <>
              <div className="whatif-hero">
                <div>
                  <span className="sub">Predicted final score</span>
                  <div className="big-number">{p.predicted_final}</div>
                </div>
                <LevelPill level={p.risk_level} />
              </div>
              <span className="sub">Chance of failing</span>
              <RiskMeter percent={p.fail_probability} level={p.risk_level} />
              <p className="hint" style={{ marginTop: 14 }}>
                {p.main_driver ? `Main driver: ${p.main_driver.toLowerCase()}.` : 'No single factor is pushing toward failing.'}
                {r.actual_final != null && ` Actual final average so far: ${r.actual_final}.`}
              </p>
              <a className="link-btn" href="#/what-if">Try different values in the what-if lab →</a>
            </>
          ) : (
            <div className="empty">
              <b>No prediction yet</b>{p ? p.reason : 'Not enough data'}. Add it on the Marks or Attendance page.
            </div>
          )}
        </div>
      </div>

      <div className="card gap-bottom">
        <h2>Marks by exam</h2>
        <p className="hint">Every score recorded for this student</p>
        {subjects.length === 0 ? (
          <div className="empty"><b>No marks yet</b>Enter marks on the Marks page.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Subject</th>{examsUsed.map((e) => <th key={e}>{e}</th>)}</tr></thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s}>
                    <td className="name">{s}</td>
                    {examsUsed.map((e) => <td key={e}>{score(s, e) ?? '-'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AttendanceCalendar studentId={id} version={version} />
    </>
  )
}
