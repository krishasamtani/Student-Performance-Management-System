import { useState } from 'react'
import { api } from '../api'
import StudentSelect from './StudentSelect'

export default function MarksForm({ students, studentId, onStudent, onDone, onError }) {
  const [subject, setSubject] = useState('')
  const [score, setScore] = useState('')

  async function submit(e) {
    e.preventDefault()
    try {
      await api.addMark({ student_id: Number(studentId), subject, score })
      setSubject(''); setScore('')
      onDone('Marks saved')
    } catch (err) { onError(err.message) }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Enter marks</h2>
      <p className="hint">Scores are out of 100.</p>
      <StudentSelect students={students} value={studentId} onChange={onStudent} />
      <div className="field"><label htmlFor="subject">Subject</label>
        <input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" /></div>
      <div className="field"><label htmlFor="score">Score</label>
        <input id="score" type="number" min="0" max="100" value={score} onChange={(e) => setScore(e.target.value)} placeholder="0 to 100" /></div>
      <button className="btn teal" type="submit">Save marks</button>
    </form>
  )
}
