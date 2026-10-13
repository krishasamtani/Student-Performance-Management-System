import { useRef, useState } from 'react'
import { downloadFile, importCsv } from '../api'

const TEMPLATES = {
  students: 'roll_no,name,course\n2401201,Asha Mehta,BSc IT\n2401202,Rohan Shah,BCA\n',
  marks: 'roll_no,subject,exam_type,score\n2401201,Mathematics,Mid-term,72\n2401201,Mathematics,Final,78\n',
}

export default function DataTools({ onDone, onError }) {
  const [kind, setKind] = useState('students')
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const input = useRef(null)

  const exportBtn = (name, label) => (
    <button className="btn ghost export-btn" key={name}
      onClick={() => downloadFile(`/api/export/${name}.csv`, `${name}.csv`).catch((e) => onError(e.message))}>
      {label}
    </button>
  )

  function template() {
    const url = URL.createObjectURL(new Blob([TEMPLATES[kind]], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url; a.download = `${kind}-template.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  async function submit() {
    if (!file) { onError('Choose a CSV file first'); return }
    setBusy(true)
    try {
      const res = await importCsv(kind, file)
      setResult(res)
      setFile(null)
      if (input.current) input.current.value = ''
      onDone(`Imported ${res.imported} rows`)
    } catch (e) { onError(e.message) } finally { setBusy(false) }
  }

  return (
    <>
      <div className="page-head">
        <h1>Import & export</h1>
        <p>Move data in and out of the system with CSV files.</p>
      </div>
      <div className="grid-2 even">
        <div className="card">
          <h2>Export</h2>
          <p className="hint">Download your data to open in Excel or Google Sheets.</p>
          <div className="export-list">
            {exportBtn('students', 'Students and results')}
            {exportBtn('marks', 'All marks')}
            {exportBtn('attendance', 'Attendance records')}
          </div>
        </div>
        <div className="card">
          <h2>Import</h2>
          <p className="hint">Add many students or marks at once. Rows with problems are skipped and listed.</p>
          <div className="field">
            <label htmlFor="import-kind">What are you importing?</label>
            <select id="import-kind" value={kind} onChange={(e) => { setKind(e.target.value); setResult(null) }}>
              <option value="students">Students (roll_no, name, course)</option>
              <option value="marks">Marks (roll_no, subject, exam_type, score)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="import-file">CSV file</label>
            <input id="import-file" ref={input} type="file" accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files[0] || null)} />
          </div>
          <div className="modal-actions">
            <button className="btn ghost" type="button" onClick={template}>Download template</button>
            <button className="btn teal" type="button" onClick={submit} disabled={busy}>{busy ? 'Importing' : 'Import file'}</button>
          </div>
          {kind === 'marks' && <p className="hint" style={{ marginTop: 12 }}>
            Students must already exist. exam_type can be Unit test, Mid-term or Final (blank means Mid-term).
          </p>}
        </div>
      </div>

      {result && (
        <div className="card" style={{ marginTop: 20 }}>
          <h2>Import result</h2>
          <p className="hint">{result.imported} imported · {result.skipped} skipped</p>
          {result.errors.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Row</th><th>Problem</th></tr></thead>
                <tbody>{result.errors.map((e) => <tr key={`${e.row}-${e.message}`}><td>{e.row}</td><td>{e.message}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  )
}
