import { useEffect, useState } from 'react'
import { api } from '../api'
import { gradeFor } from '../utils'
import GradeBadge from '../components/GradeBadge'
import RiskMeter from '../components/RiskMeter'
import LevelPill from '../components/LevelPill'
import DriverBars from '../components/DriverBars'

export default function WhatIf() {
  const [midterm, setMidterm] = useState(60)
  const [attendance, setAttendance] = useState(75)
  const [result, setResult] = useState(null)
  const [people, setPeople] = useState([])
  const [picked, setPicked] = useState('')

  useEffect(() => {
    api.mlPredictions()
      .then((d) => setPeople(d.students.filter((s) => s.prediction.available)))
      .catch(() => setPeople([]))
  }, [])

  // Re-run the model shortly after the sliders stop moving.
  useEffect(() => {
    let stale = false
    const timer = setTimeout(() => {
      api.mlPredict(midterm, attendance).then((r) => { if (!stale) setResult(r) }).catch(() => {})
    }, 120)
    return () => { stale = true; clearTimeout(timer) }
  }, [midterm, attendance])

  function pick(id) {
    setPicked(id)
    const s = people.find((p) => String(p.id) === id)
    if (s) { setMidterm(Math.round(s.midterm_avg)); setAttendance(Math.round(s.attendance)) }
  }

  const slider = (id, label, value, set) => (
    <div className="field">
      <label htmlFor={id}>{label} <b className="slider-value">{value}{id === 'att' ? '%' : ''}</b></label>
      <input id={id} type="range" min="0" max="100" value={value}
        onChange={(e) => { set(Number(e.target.value)); setPicked('') }} />
    </div>
  )

  return (
    <>
      <div className="page-head">
        <h1>What-if lab</h1>
        <p>Move the sliders and watch the model's prediction change.</p>
      </div>
      <div className="grid-2 even">
        <div className="card">
          <h2>Inputs</h2>
          <p className="hint">Start from a real student, or set any values you like.</p>
          <div className="field">
            <label htmlFor="whatif-student">Start from a student</label>
            <select id="whatif-student" value={picked} onChange={(e) => pick(e.target.value)}>
              <option value="">Custom values</option>
              {people.map((s) => <option key={s.id} value={s.id}>{s.roll_no} · {s.name}</option>)}
            </select>
          </div>
          {slider('mid', 'Mid-term average', midterm, setMidterm)}
          {slider('att', 'Attendance', attendance, setAttendance)}
          <p className="hint" style={{ marginTop: 6 }}>
            Tip: lower the attendance slider and see how much it changes the chance of failing.
          </p>
        </div>
        <div className="card">
          <h2>Model prediction</h2>
          {!result ? (
            <div className="empty">Running the model</div>
          ) : (
            <>
              <div className="whatif-hero">
                <div>
                  <span className="sub">Predicted final score</span>
                  <div className="big-number">{result.predicted_final}</div>
                </div>
                <GradeBadge grade={gradeFor(result.predicted_final)} />
              </div>
              <div className="whatif-risk">
                <div className="row-tools">
                  <span className="sub">Chance of failing (below 50)</span>
                  <LevelPill level={result.risk_level} />
                </div>
                <RiskMeter percent={result.fail_probability} level={result.risk_level} />
              </div>
              <h3 className="mini-title">What is driving the risk</h3>
              <DriverBars drivers={result.drivers} />
              <p className="hint" style={{ marginTop: 14 }}>
                {result.main_driver
                  ? `${result.main_driver} is the biggest factor pushing this student toward failing.`
                  : 'Neither input is pushing this student strongly toward failing.'}
              </p>
            </>
          )}
        </div>
      </div>
    </>
  )
}
