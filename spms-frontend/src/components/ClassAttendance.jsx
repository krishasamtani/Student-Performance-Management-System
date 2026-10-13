import { useEffect, useState } from 'react'
import { api } from '../api'

const today = () => new Date().toISOString().slice(0, 10)

export default function ClassAttendance({ students, onDone, onError }) {
  const [date, setDate] = useState(today())
  const [status, setStatus] = useState({}) // student id -> true (present) / false (absent)
  const [busy, setBusy] = useState(false)

  // Load whatever was already saved for the chosen day.
  useEffect(() => {
    let stale = false
    api.attendanceFor(date)
      .then((rows) => {
        if (!stale) setStatus(Object.fromEntries(rows.map((r) => [r.student_id, r.present])))
      })
      .catch(() => { if (!stale) setStatus({}) })
    return () => { stale = true }
  }, [date])

  const setOne = (id, present) => setStatus((cur) => ({ ...cur, [id]: present }))
  const setAll = (present) => setStatus(Object.fromEntries(students.map((s) => [s.id, present])))

  const marked = students.filter((s) => status[s.id] !== undefined)
  const present = marked.filter((s) => status[s.id]).length
  const absent = marked.length - present

  async function save() {
    if (marked.length === 0) { onError('Mark at least one student first'); return }
    setBusy(true)
    try {
      await api.saveAttendance(date, marked.map((s) => ({ student_id: s.id, present: status[s.id] })))
      onDone(`Attendance saved for ${marked.length} students`)
    } catch (err) { onError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="card">
      <h2>Class attendance</h2>
      <p className="hint">Pick a day, mark everyone, then save once.</p>
      <div className="att-tools">
        <div className="field">
          <label htmlFor="att-date">Date</label>
          <input id="att-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
        <div className="att-bulk">
          <button type="button" className="btn-sm" onClick={() => setAll(true)}>All present</button>
          <button type="button" className="btn-sm neutral" onClick={() => setAll(false)}>All absent</button>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="empty"><b>No students yet</b>Add students first, then mark their attendance here.</div>
      ) : (
        <>
          <ul className="roll">
            {students.map((s) => (
              <li key={s.id}>
                <div className="avatar">{s.name.charAt(0).toUpperCase()}</div>
                <div className="who"><b>{s.name}</b><span className="sub">{s.roll_no}</span></div>
                <div className="seg" role="group" aria-label={`Attendance for ${s.name}`}>
                  <button type="button" className={status[s.id] === true ? 'on-present' : ''}
                    aria-pressed={status[s.id] === true} onClick={() => setOne(s.id, true)}>Present</button>
                  <button type="button" className={status[s.id] === false ? 'on-absent' : ''}
                    aria-pressed={status[s.id] === false} onClick={() => setOne(s.id, false)}>Absent</button>
                </div>
              </li>
            ))}
          </ul>
          <p className="att-summary">
            {present} present · {absent} absent · {students.length - marked.length} not marked
          </p>
          <button className="btn teal" onClick={save} disabled={busy}>
            {busy ? 'Saving attendance' : 'Save attendance'}
          </button>
        </>
      )}
    </div>
  )
}
