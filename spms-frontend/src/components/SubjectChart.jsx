import ProgressBar from './ProgressBar'

export default function SubjectChart({ subjects = [] }) {
  return (
    <div className="card">
      <h2>Average score by subject</h2>
      <p className="hint">Across all students</p>
      {subjects.length === 0 ? (
        <div className="empty"><b>No marks yet</b>Add marks to see subject averages.</div>
      ) : (
        subjects.map((s) => <ProgressBar key={s.subject} label={s.subject} value={s.average} />)
      )}
    </div>
  )
}