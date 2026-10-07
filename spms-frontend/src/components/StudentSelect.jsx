export default function StudentSelect({ students, value, onChange }) {
  return (
    <div className="field">
      <label htmlFor="student">Student</label>
      <select id="student" value={value} onChange={(e) => onChange(e.target.value)}>
        {students.length === 0 && <option value="">No students yet</option>}
        {students.map((s) => (
          <option key={s.id} value={s.id}>{s.roll_no} · {s.name}</option>
        ))}
      </select>
    </div>
  )
}
