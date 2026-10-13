import { useEffect, useState } from 'react'
import { api } from '../api'

export default function EditStudentModal({ student, onClose, onDone, onError }) {
  const [form, setForm] = useState({ roll_no: student.roll_no, name: student.name, course: student.course })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(e) {
    e.preventDefault()
    try {
      await api.updateStudent(student.id, form)
      onClose()
      onDone('Student updated')
    } catch (err) { onError(err.message) }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <form className="modal" role="dialog" aria-label="Edit student" onSubmit={submit}>
        <h2>Edit student</h2>
        <p className="hint">Marks and attendance stay with the student.</p>
        <div className="field"><label htmlFor="e-name">Full name</label>
          <input id="e-name" autoFocus value={form.name} onChange={set('name')} /></div>
        <div className="field"><label htmlFor="e-roll">Roll number</label>
          <input id="e-roll" value={form.roll_no} onChange={set('roll_no')} /></div>
        <div className="field"><label htmlFor="e-course">Course</label>
          <input id="e-course" value={form.course} onChange={set('course')} /></div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn teal">Save changes</button>
        </div>
      </form>
    </>
  )
}
