import { useEffect, useState } from 'react'
import { api } from '../api'
import MarksForm from '../components/MarksForm'
import ProgressBar from '../components/ProgressBar'
import GradeBadge from '../components/GradeBadge'

export default function Marks({ students, version, onDone, onError }) {
  const [studentId, setStudentId] = useState('')
  const [report, setReport] = useState(null)

  useEffect(() => {
    if (!studentId && students.length) setStudentId(String(students[0].id))
  }, [students, studentId])

  useEffect(() => {
    if (!studentId) { setReport(null); return }
    api.report(studentId).then(setReport).catch(() => setReport(null))
  }, [studentId, version])

  const subjects = report ? Object.entries(report.subjects) : []

  return (
    <>
      <div className="page-head">
        <h1>Marks</h1>
        <p>Enter scores and see how a student is doing right away.</p>
      </div>
      <div className="grid-form">
        <MarksForm students={students} studentId={studentId} onStudent={setStudentId}
          onDone={onDone} onError={onError} />
        <div className="card">
          <div className="row-tools">
            <div>
              <h2>{report ? report.name : 'Current marks'}</h2>
              {report && <span className="sub">Average {report.average}</span>}
            </div>
            {report && <GradeBadge grade={report.grade} />}
          </div>
          {subjects.length === 0 ? (
            <div className="empty"><b>No marks recorded</b>Saved scores for this student appear here.</div>
          ) : (
            subjects.map(([name, score]) => <ProgressBar key={name} label={name} value={score} />)
          )}
        </div>
      </div>
    </>
  )
}
