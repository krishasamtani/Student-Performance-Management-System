import { useEffect, useState } from 'react'
import { api } from '../api'
import Icon from './Icon'
import ProgressBar, { toneFor } from './ProgressBar'

export default function ReportDrawer({ studentId, onClose }) {
  const [r, setR] = useState(null)

  useEffect(() => {
    api.report(studentId).then(setR).catch(() => setR(null))
  }, [studentId])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const subjects = r ? Object.entries(r.subjects) : []
  const attendanceHistory = r ? r.attendance_history || [] : []

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
            <div className="report-hero">
              <div className={`report-grade g-${toneFor(r.average)}`}>{r.grade}</div>
              <div className="report-meta">
                <div>Average score: <b>{r.average}</b></div>
                <div>Attendance: <b>{r.attendance_percent}%</b></div>
                <div className="sub">{attendanceHistory.length} days recorded</div>
              </div>
            </div>

            <h3>Subject scores</h3>
            {subjects.length === 0 ? (
              <div className="empty"><b>No marks yet</b>Enter marks to build this report.</div>
            ) : (
              subjects.map(([name, score]) => <ProgressBar key={name} label={name} value={score} />)
            )}

            <h3 style={{ marginTop: '24px' }}>Attendance history</h3>
            {attendanceHistory.length === 0 ? (
              <div className="empty"><b>No attendance recorded</b>Save entries to track presence.</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {attendanceHistory.map((att, i) => (
                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '14px' }}>
                    <span>{att.date}</span>
                    <b style={{ color: att.present ? '#10b981' : '#ef4444' }}>
                      {att.present ? 'Present' : 'Absent'}
                    </b>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </aside>
    </>
  )
}