import { useEffect, useState } from 'react'
import AttendanceForm from '../components/AttendanceForm'
import ProgressBar from '../components/ProgressBar'

export default function Attendance({ students, onDone, onError, onRefresh }) {
  const [studentId, setStudentId] = useState('')

  useEffect(() => {
    if (!studentId && students.length) setStudentId(String(students[0].id))
  }, [students, studentId])

  const tracked = students.filter((s) => s.attendance != null)

  return (
    <>
      <div className="page-head">
        <h1>Attendance</h1>
        <p>Mark who was in class and keep an eye on attendance rates.</p>
      </div>
      <div className="grid-form">
        <AttendanceForm 
          students={students} 
          studentId={studentId} 
          onStudent={setStudentId}
          onDone={(msg) => {
            if (onRefresh) onRefresh(); // Save hote hi data reload karega
            onDone(msg);
          }} 
          onError={onError} 
        />
        <div className="card">
          <h2>Attendance rate</h2>
          <p className="hint">Share of recorded days each student was present</p>
          {tracked.length === 0 ? (
            <div className="empty"><b>No attendance recorded</b>Save an entry to start tracking.</div>
          ) : (
            tracked.map((s) => <ProgressBar key={s.id} label={s.name} value={s.attendance} suffix="%" />)
          )}
        </div>
      </div>
    </>
  )
}