import { useState } from 'react'
import { api } from '../api'

export default function StudentForm({ onDone, onError }) {
  const [form, setForm] = useState({ roll_no: '', name: '', course: '' })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    try {
      await api.addStudent(form)
      setForm({ roll_no: '', name: '', course: '' })
      onDone('Student added')
    } catch (err) { onError(err.message) }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Add a student</h2>
      <p className="hint">Roll numbers must be unique.</p>
      <div className="field"><label htmlFor="roll">Roll number</label>
        <input id="roll" value={form.roll_no} onChange={set('roll_no')} placeholder="e.g. IT2026-014" /></div>
      <div className="field"><label htmlFor="name">Full name</label>
        <input id="name" value={form.name} onChange={set('name')} placeholder="e.g. Asha Mehta" /></div>
      <div className="field"><label htmlFor="course">Course</label>
        <input id="course" value={form.course} onChange={set('course')} placeholder="e.g. BSc IT" /></div>
      <button className="btn teal" type="submit">Add student</button>
    </form>
  )
}
