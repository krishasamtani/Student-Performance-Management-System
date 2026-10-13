import { useEffect, useState } from 'react'
import MarksForm from '../components/MarksForm'
import MarksList from '../components/MarksList'

export default function Marks({ students, version, onDone, onError }) {
  const [studentId, setStudentId] = useState('')

  // Keep the selection valid when students are added or deleted.
  useEffect(() => {
    if (students.length === 0) { if (studentId) setStudentId(''); return }
    if (!students.some((s) => String(s.id) === studentId)) setStudentId(String(students[0].id))
  }, [students, studentId])

  return (
    <>
      <div className="page-head">
        <h1>Marks</h1>
        <p>Enter scores, then correct or remove them any time.</p>
      </div>
      <div className="grid-form">
        <MarksForm students={students} studentId={studentId} onStudent={setStudentId}
          onDone={onDone} onError={onError} />
        <MarksList studentId={studentId} version={version} onDone={onDone} onError={onError} />
      </div>
    </>
  )
}
