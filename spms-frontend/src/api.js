async function request(url, method = 'GET', body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = res.status === 204 ? {} : await res.json()
  if (!res.ok) throw new Error(data.error || 'Something went wrong')
  return data
}

// Fetch (not a plain link) so the dev-server proxy forwards the request to Flask.
export async function downloadReportPdf(id, filename) {
  const res = await fetch(`/api/students/${id}/report.pdf`)
  if (!res.ok) throw new Error('Could not create the PDF report card')
  const url = URL.createObjectURL(await res.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
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
  saveAttendance: (date, records) => request('/api/attendance/bulk', 'POST', { date, records }),
  addMark: (m) => request('/api/marks', 'POST', m),
}
