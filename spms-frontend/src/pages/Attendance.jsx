import ClassAttendance from '../components/ClassAttendance'
import ProgressBar from '../components/ProgressBar'

export default function Attendance({ students, onDone, onError }) {
  const tracked = students.filter((s) => s.attendance != null)

  return (
    <>
      <div className="page-head">
        <h1>Attendance</h1>
        <p>Mark the whole class for a day and keep an eye on attendance rates.</p>
      </div>
      <div className="grid-2 even">
        <ClassAttendance students={students} onDone={onDone} onError={onError} />
        <div className="card">
          <h2>Attendance rate</h2>
          <p className="hint">Share of recorded days each student was present</p>
          {tracked.length === 0 ? (
            <div className="empty"><b>No attendance recorded</b>Save a day to start tracking.</div>
          ) : (
            tracked.map((s) => <ProgressBar key={s.id} label={s.name} value={s.attendance} suffix="%" />)
          )}
        </div>
      </div>
    </>
  )
}
