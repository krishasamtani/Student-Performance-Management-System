import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import Sidebar from './components/Sidebar'
import Toast from './components/Toast'
import ReportDrawer from './components/ReportDrawer'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import Marks from './pages/Marks'
import Attendance from './pages/Attendance'

const emptySummary = { students: 0, average_score: 0, average_attendance: 0, subjects: [], top: [] }

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [students, setStudents] = useState([])
  const [summary, setSummary] = useState(emptySummary)
  const [reportId, setReportId] = useState(null)
  const [toast, setToast] = useState(null)
  const [version, setVersion] = useState(0)
  const timer = useRef(null)

  const notify = useCallback((text, type = 'ok') => {
    setToast({ text, type })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 2600)
  }, [])

  const load = useCallback(async () => {
    try {
      const [s, sm] = await Promise.all([api.students(), api.summary()])
      setStudents(s)
      setSummary(sm)
      setVersion((v) => v + 1)
    } catch {
      notify('Could not reach the server. Is the Flask app running?', 'error')
    }
  }, [notify])

  useEffect(() => { load() }, [load])

  const done = (msg) => { notify(msg); load() }
  const fail = (msg) => notify(msg, 'error')

  async function remove(student) {
    if (!window.confirm(`Delete ${student.name} and all their records?`)) return
    try {
      await api.deleteStudent(student.id)
      done('Student deleted')
    } catch (e) { fail(e.message) }
  }

  return (
    <div className="app">
      <Sidebar page={page} onNavigate={setPage} />
      <main className="main">
        {page === 'dashboard' && <Dashboard summary={summary} onReport={setReportId} />}
        {page === 'students' && (
          <Students students={students} onReport={setReportId} onDelete={remove} onDone={done} onError={fail} />
        )}
        {page === 'marks' && <Marks students={students} version={version} onDone={done} onError={fail} />}
        {page === 'attendance' && <Attendance students={students} onDone={done} onError={fail} />}
      </main>
      {reportId && <ReportDrawer studentId={reportId} onClose={() => setReportId(null)} />}
      <Toast toast={toast} />
    </div>
  )
}
