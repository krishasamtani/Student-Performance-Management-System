import { useMemo, useState } from 'react'
import GradeBadge from './GradeBadge'
import RiskBadge from './RiskBadge'

const GRADES = ['A+', 'A', 'B', 'C', 'D', 'F']
const RANK = { 'A+': 0, A: 1, B: 2, C: 3, D: 4, F: 5 }
const COLUMNS = [
  { key: 'name', label: 'Student' },
  { key: 'course', label: 'Course' },
  { key: 'average', label: 'Average' },
  { key: 'grade', label: 'Grade' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'at_risk', label: 'Status' },
]

function valueOf(s, key) {
  if (key === 'grade') return s.grade === '-' ? null : RANK[s.grade]
  if (key === 'at_risk') return s.at_risk ? 0 : 1
  return s[key]
}

// Empty values always sort to the bottom, whichever direction is chosen.
function compare(a, b, { key, dir }) {
  const x = valueOf(a, key)
  const y = valueOf(b, key)
  if (x == null && y == null) return 0
  if (x == null) return 1
  if (y == null) return -1
  const r = typeof x === 'string'
    ? x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' })
    : x - y
  return dir === 'asc' ? r : -r
}

export default function StudentTable({ students, onReport, onEdit, onDelete }) {
  const [q, setQ] = useState('')
  const [course, setCourse] = useState('all')
  const [grade, setGrade] = useState('all')
  const [riskOnly, setRiskOnly] = useState(false)
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })

  const courses = useMemo(() => [...new Set(students.map((s) => s.course))].sort(), [students])

  const shown = useMemo(() => {
    const text = q.toLowerCase()
    return students
      .filter((s) =>
        (!riskOnly || s.at_risk) &&
        (course === 'all' || s.course === course) &&
        (grade === 'all' || (grade === 'none' ? s.grade === '-' : s.grade === grade)) &&
        `${s.name} ${s.roll_no} ${s.course}`.toLowerCase().includes(text))
      .sort((a, b) => compare(a, b, sort))
  }, [students, q, course, grade, riskOnly, sort])

  const filtersOn = q !== '' || course !== 'all' || grade !== 'all' || riskOnly
  const clear = () => { setQ(''); setCourse('all'); setGrade('all'); setRiskOnly(false) }
  const toggleSort = (key) =>
    setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  return (
    <div className="card">
      <div className="row-tools">
        <div>
          <h2>All students</h2>
          <span className="sub">
            {filtersOn ? `Showing ${shown.length} of ${students.length}` : `${students.length} enrolled`}
          </span>
        </div>
        <input className="search" type="search" placeholder="Search students" value={q}
          onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
      </div>

      <div className="filters">
        <select value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Filter by course">
          <option value="all">All courses</option>
          {courses.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={grade} onChange={(e) => setGrade(e.target.value)} aria-label="Filter by grade">
          <option value="all">All grades</option>
          {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
          <option value="none">No grade yet</option>
        </select>
        <label className="check">
          <input type="checkbox" checked={riskOnly} onChange={(e) => setRiskOnly(e.target.checked)} />
          At risk only
        </label>
        {filtersOn && <button className="link-btn" onClick={clear}>Clear filters</button>}
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          {students.length === 0
            ? <><b>No students yet</b>Add your first student with the form.</>
            : <><b>No students match these filters</b>Try removing a filter or searching for something else.</>}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button className="th-sort" onClick={() => toggleSort(c.key)}>
                      {c.label}
                      <span className="sort-icon" aria-hidden="true">
                        {sort.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                      </span>
                    </button>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id}>
                  <td><span className="name">{s.name}</span><div className="sub">{s.roll_no}</div></td>
                  <td>{s.course}</td>
                  <td>{s.average ?? '-'}</td>
                  <td><GradeBadge grade={s.grade} /></td>
                  <td>{s.attendance != null ? `${s.attendance}%` : '-'}</td>
                  <td><RiskBadge student={s} /></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn-sm" onClick={() => onReport(s.id)}>Report</button>
                    <button className="btn-sm neutral" onClick={() => onEdit(s)}>Edit</button>
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
