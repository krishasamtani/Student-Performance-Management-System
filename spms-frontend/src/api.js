const API_BASE = "http://127.0.0.1:5000";

async function request(url, method = 'GET', body) {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = res.status === 204 ? {} : await res.json()
  if (!res.ok) throw new Error(data.error || 'Something went wrong')
  return data
}

export const api = {
  students: () => request('/api/students'),
  summary: () => request('/api/summary'),
  report: (id) => request(`/api/students/${id}/report`),
  addStudent: (s) => request('/api/students', 'POST', s),
  deleteStudent: (id) => request(`/api/students/${id}`, 'DELETE'),
  addMark: (m) => request('/api/marks', 'POST', m),
  addAttendance: (a) => request('/api/attendance', 'POST', a),
}