import { useEffect, useState } from 'react'
import { api } from '../api'
import GradeBadge from './GradeBadge'

export default function MarksList({ studentId, version, onDone, onError }) {
  const [report, setReport] = useState(null)
  const [marks, setMarks] = useState([])
  const [editId, setEditId] = useState(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    let stale = false
    setEditId(null)
    if (!studentId) { setReport(null); setMarks([]); return }
    Promise.all([api.report(studentId), api.marks(studentId)])
      .then(([r, m]) => { if (!stale) { setReport(r); setMarks(m) } })
      .catch(() => { if (!stale) { setReport(null); setMarks([]) } })
    return () => { stale = true }
  }, [studentId, version])

  const startEdit = (m) => { setEditId(m.id); setDraft(String(m.score)) }

  async function save(m) {
    try {
      await api.updateMark(m.id, draft)
      setEditId(null)
      onDone(`${m.subject} score updated`)
    } catch (err) { onError(err.message) }
  }

  async function remove(m) {
    if (!window.confirm(`Delete the ${m.subject} marks?`)) return
    try {
      await api.deleteMark(m.id)
      onDone(`${m.subject} marks deleted`)
    } catch (err) { onError(err.message) }
  }

  return (
    <div className="card">
      <div className="row-tools">
        <div>
          <h2>{report ? report.name : 'Current marks'}</h2>
          {report && <span className="sub">Average {report.average}</span>}
        </div>
        {report && <GradeBadge grade={report.grade} />}
      </div>
      {marks.length === 0 ? (
        <div className="empty"><b>No marks recorded</b>Saved scores for this student appear here.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Subject</th><th>Score</th><th /></tr></thead>
            <tbody>
              {marks.map((m) => (
                <tr key={m.id}>
                  <td className="name">{m.subject}</td>
                  <td>
                    {editId === m.id ? (
                      <input className="inline-input" type="number" min="0" max="100" autoFocus
                        value={draft} onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') save(m); if (e.key === 'Escape') setEditId(null) }}
                        aria-label={`${m.subject} score`} />
                    ) : m.score}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {editId === m.id ? (
                      <>
                        <button className="btn-sm" onClick={() => save(m)}>Save</button>
                        <button className="btn-sm neutral" onClick={() => setEditId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="btn-sm neutral" onClick={() => startEdit(m)}>Edit</button>
                        <button className="btn-sm danger" onClick={() => remove(m)}>Delete</button>
                      </>
                    )}
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
