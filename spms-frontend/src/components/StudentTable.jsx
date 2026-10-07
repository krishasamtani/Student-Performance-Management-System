import { useState } from 'react'
import GradeBadge from './GradeBadge'

export default function StudentTable({ students, onReport, onDelete }) {
  const [q, setQ] = useState('')
  const shown = students.filter((s) =>
    `${s.name} ${s.roll_no} ${s.course}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="card">
      <div className="row-tools">
        <div>
          <h2>All students</h2>
          <span className="sub">{students.length} enrolled</span>
        </div>
        <input className="search" type="search" placeholder="Search students" value={q}
          onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
      </div>
      {shown.length === 0 ? (
        <div className="empty"><b>No students found</b>Add a student with the form to get started.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Student</th><th>Course</th><th>Average</th><th>Grade</th><th>Attendance</th><th /></tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id}>
                  <td><span className="name">{s.name}</span><div className="sub">{s.roll_no}</div></td>
                  <td>{s.course}</td>
                  <td>{s.average ?? '-'}</td>
                  <td><GradeBadge grade={s.grade} /></td>
                  <td>{s.attendance != null ? `${s.attendance}%` : '-'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn-sm" onClick={() => onReport(s.id)}>Report</button>
                    <button className="btn-sm danger" onClick={() => onDelete(s)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
