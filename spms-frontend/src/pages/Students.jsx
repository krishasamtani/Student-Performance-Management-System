import { useState } from 'react'
import StudentForm from '../components/StudentForm'
import StudentTable from '../components/StudentTable'
import EditStudentModal from '../components/EditStudentModal'

export default function Students({ students, onReport, onDelete, onDone, onError }) {
  const [editing, setEditing] = useState(null)

  return (
    <>
      <div className="page-head">
        <h1>Students</h1>
        <p>Add, search, sort and edit every student.</p>
      </div>
      <div className="stack">
        <StudentForm onDone={onDone} onError={onError} />
        <StudentTable students={students} onReport={onReport} onEdit={setEditing} onDelete={onDelete} />
      </div>
      {editing && (
        <EditStudentModal student={editing} onClose={() => setEditing(null)} onDone={onDone} onError={onError} />
      )}
    </>
  )
}
