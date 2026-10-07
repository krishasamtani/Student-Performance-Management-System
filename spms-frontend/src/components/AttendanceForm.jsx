import { useState } from 'react'
import { api } from '../api'
import StudentSelect from './StudentSelect'

const today = () => new Date().toISOString().slice(0, 10)

export default function AttendanceForm({ students, studentId, onStudent, onDone, onError }) {
  const [date, setDate] = useState(today())
  const [present, setPresent] = useState(true)

  async function submit(e) {
    e.preventDefault()
    try {
      await api.addAttendance({ student_id: Number(studentId), date, present })
      onDone('Attendance saved')
    } catch (err) { onError(err.message) }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Record attendance</h2>
      <p className="hint">One entry per student per day.</p>
      <StudentSelect students={students} value={studentId} onChange={onStudent} />
      <div className="field"><label htmlFor="date">Date</label>
        <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div className="field"><label>Status</label>
        <div className="toggle">
          <button type="button" className={present ? 'on-present' : ''} onClick={() => setPresent(true)}>Present</button>
          <button type="button" className={!present ? 'on-absent' : ''} onClick={() => setPresent(false)}>Absent</button>
        </div>
      </div>
      <button className="btn teal" type="submit">Save attendance</button>
    </form>
  )
}
