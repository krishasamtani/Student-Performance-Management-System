import { useEffect, useState } from 'react'
import { api, downloadReportPdf } from '../api'
import Icon from './Icon'
import ProgressBar, { toneFor } from './ProgressBar'

export default function ReportDrawer({ studentId, onClose }) {
  const [r, setR] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.report(studentId).then(setR).catch(() => setR(null))
  }, [studentId])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function download() {
    setBusy(true)
    setError('')
    try {
      await downloadReportPdf(studentId, `report-${r.roll_no}.pdf`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const subjects = r ? Object.entries(r.subjects) : []

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Performance report">
        <div className="drawer-head">
          <div>
            <h2>{r ? r.name : 'Loading report'}</h2>
            {r && <div className="sub">{r.roll_no} · {r.course}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close report"><Icon name="close" size={20} /></button>
        </div>
        {r && (
          <>
            {r.at_risk && (
              <div className="risk-banner">
                <b>At risk</b>
                <ul>{r.risk_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              </div>
            )}
            <div className="report-hero">
              <div className={`report-grade g-${toneFor(r.average)}`}>{r.grade}</div>
              <div className="report-meta">
                <div>Average score: <b>{r.average}</b></div>
                <div>Attendance: <b>{r.attendance_percent}%</b></div>
                <div className="sub">{r.days_recorded} days recorded</div>
              </div>
            </div>
            <h3>Subject scores</h3>
            {subjects.length === 0 ? (
              <div className="empty"><b>No marks yet</b>Enter marks to build this report.</div>
            ) : (
              subjects.map(([name, score]) => <ProgressBar key={name} label={name} value={score} />)
            )}
            <button className="btn teal download" onClick={download} disabled={busy}>
              {busy ? 'Creating PDF' : 'Download PDF report card'}
            </button>
            {error && <p className="form-error">{error}</p>}
          </>
        )}
      </aside>
    </>
  )
}
