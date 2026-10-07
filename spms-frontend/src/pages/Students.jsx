import StudentForm from '../components/StudentForm'
import StudentTable from '../components/StudentTable'

export default function Students({ students, onReport, onDelete, onDone, onError }) {
  return (
    <>
      <div className="page-head">
        <h1>Students</h1>
        <p>Add, search and review every student.</p>
      </div>
      <div className="grid-form">
        <StudentForm onDone={onDone} onError={onError} />
        <StudentTable students={students} onReport={onReport} onDelete={onDelete} />
      </div>
    </>
  )
}
