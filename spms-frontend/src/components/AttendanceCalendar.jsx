import { useEffect, useState } from 'react'
import { api } from '../api'

const pad = (n) => String(n).padStart(2, '0')
const monthOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
const shift = (month, delta) => {
  const [y, m] = month.split('-').map(Number)
  return monthOf(new Date(y, m - 1 + delta, 1))
}

export default function AttendanceCalendar({ studentId, version }) {
  const [month, setMonth] = useState(monthOf(new Date()))
  const [days, setDays] = useState({})

  useEffect(() => {
    let stale = false
    api.studentAttendance(studentId, month)
      .then((rows) => { if (!stale) setDays(Object.fromEntries(rows.map((r) => [r.date, r.present]))) })
      .catch(() => { if (!stale) setDays({}) })
    return () => { stale = true }
  }, [studentId, month, version])

  const [y, m] = month.split('-').map(Number)
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7 // weeks start on Monday
  const count = new Date(y, m, 0).getDate()
  const present = Object.values(days).filter(Boolean).length
  const absent = Object.values(days).length - present
  const title = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="card">
      <div className="row-tools">
        <div>
          <h2>Attendance calendar</h2>
          <span className="sub">{present} present · {absent} absent this month</span>
        </div>
        <div className="cal-nav">
          <button className="btn-sm neutral" onClick={() => setMonth(shift(month, -1))} aria-label="Previous month">‹</button>
          <b>{title}</b>
          <button className="btn-sm neutral" onClick={() => setMonth(shift(month, 1))} aria-label="Next month">›</button>
        </div>
      </div>
      <div className="cal">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div className="cal-head" key={d}>{d}</div>)}
        {Array.from({ length: offset }, (_, i) => <div key={`o${i}`} />)}
        {Array.from({ length: count }, (_, i) => {
          const key = `${month}-${pad(i + 1)}`
          const state = days[key] === undefined ? 'none' : days[key] ? 'present' : 'absent'
          return <div key={key} className={`cal-day ${state}`} title={state === 'none' ? 'Not recorded' : state}>{i + 1}</div>
        })}
      </div>
      <div className="legend">
        <span><i className="dot present" /> Present</span>
        <span><i className="dot absent" /> Absent</span>
        <span><i className="dot none" /> Not recorded</span>
      </div>
    </div>
  )
}
