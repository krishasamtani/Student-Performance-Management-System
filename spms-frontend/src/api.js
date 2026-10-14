async function request(url, method = 'GET', body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = {}
  if (res.status !== 204) {
    try {
      data = await res.json()
    } catch {
      throw new Error(`The server sent an unexpected response (${res.status}). Is the backend updated and running?`)
    }
  }
  if (!res.ok) throw new Error(data.error || 'Something went wrong')
  return data
}

// Fetch (not a plain link) so the dev-server proxy forwards the request to Flask.
export async function downloadFile(url, filename) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`The download failed (${res.status}). Is the backend updated and running?`)
  const href = URL.createObjectURL(await res.blob())
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(href)
}

export const downloadReportPdf = (id, filename) => downloadFile(`/api/students/${id}/report.pdf`, filename)

export async function importCsv(kind, file) {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch(`/api/import/${kind}`, { method: 'POST', body })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Import failed')
  return data
}

export const api = {
  students: () => request('/api/students'),
  summary: () => request('/api/summary'),
  subjects: () => request('/api/subjects'),
  report: (id) => request(`/api/students/${id}/report`),
  addStudent: (s) => request('/api/students', 'POST', s),
  deleteStudent: (id) => request(`/api/students/${id}`, 'DELETE'),
  updateStudent: (id, s) => request(`/api/students/${id}`, 'PUT', s),
  marks: (id) => request(`/api/students/${id}/marks`),
  updateMark: (id, score) => request(`/api/marks/${id}`, 'PUT', { score }),
  deleteMark: (id) => request(`/api/marks/${id}`, 'DELETE'),
  attendanceFor: (date) => request(`/api/attendance?date=${date}`),
  courses: () => request('/api/courses'),
  studentAttendance: (id, month) => request(`/api/students/${id}/attendance?month=${month}`),
  mlModel: () => request('/api/ml/model'),
  mlRetrain: (source) => request('/api/ml/retrain', 'POST', { source }),
  mlPredict: (midterm_avg, attendance) => request('/api/ml/predict', 'POST', { midterm_avg, attendance }),
  mlPredictions: () => request('/api/ml/predictions'),
  saveAttendance: (date, records) => request('/api/attendance/bulk', 'POST', { date, records }),
  addMark: (m) => request('/api/marks', 'POST', m),
}
