import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import Sidebar from './components/Sidebar'
import Toast from './components/Toast'
import ReportDrawer from './components/ReportDrawer'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import StudentProfile from './pages/StudentProfile'
import Marks from './pages/Marks'
import Attendance from './pages/Attendance'
import Courses from './pages/Courses'
import Predictions from './pages/Predictions'
import WhatIf from './pages/WhatIf'
import Model from './pages/Model'
import DataTools from './pages/DataTools'

const emptySummary = {
  students: 0, average_score: 0, average_attendance: 0, subjects: [], top: [],
  grade_distribution: [], attendance_trend: [], at_risk: [], at_risk_count: 0,
  risk_rules: { score: 50, attendance: 75 },
}

// Pages are addressed by the URL hash, e.g. #/students or #/student/12.
function parseHash() {
  const [page = '', id] = window.location.hash.replace(/^#\/?/, '').split('/')
  return { page: page || 'dashboard', id: id ? Number(id) : null }
}

export default function App() {
  const [route, setRoute] = useState(parseHash)
  const [students, setStudents] = useState([])
  const [summary, setSummary] = useState(emptySummary)
  const [reportId, setReportId] = useState(null)
  const [toast, setToast] = useState(null)
  const [version, setVersion] = useState(0)
  const timer = useRef(null)

  useEffect(() => {
    const onHash = () => { setRoute(parseHash()); setReportId(null); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

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

  const { page, id } = route
  return (
    <div className="app">
      <Sidebar page={page} />
      <main className="main">
        {page === 'dashboard' && <Dashboard summary={summary} version={version} onReport={setReportId} />}
        {page === 'students' && (
          <Students students={students} onReport={setReportId} onDelete={remove} onDone={done} onError={fail} />
        )}
        {page === 'student' && <StudentProfile id={id} version={version} onError={fail} />}
        {page === 'marks' && <Marks students={students} version={version} onDone={done} onError={fail} />}
        {page === 'attendance' && <Attendance students={students} onDone={done} onError={fail} />}
        {page === 'courses' && <Courses version={version} />}
        {page === 'predictions' && <Predictions version={version} />}
        {page === 'what-if' && <WhatIf />}
        {page === 'model' && <Model version={version} onDone={done} onError={fail} />}
        {page === 'data' && <DataTools onDone={done} onError={fail} />}
        {!['dashboard', 'students', 'student', 'marks', 'attendance', 'courses', 'predictions', 'what-if', 'model', 'data'].includes(page) && (
          <div className="card"><div className="empty"><b>Page not found</b><a href="#/dashboard">Go to the dashboard</a></div></div>
        )}
      </main>
      {reportId && <ReportDrawer studentId={reportId} onClose={() => setReportId(null)} />}
      <Toast toast={toast} />
    </div>
  )
}
