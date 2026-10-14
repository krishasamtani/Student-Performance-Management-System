import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import StatCard from '../components/StatCard'
import ScatterPlot from '../components/ScatterPlot'
import ConfusionMatrix from '../components/ConfusionMatrix'
import LoadError from '../components/LoadError'

const pct = (v) => `${Math.round(v * 100)}%`

export default function Model({ version, onDone, onError }) {
  const [m, setM] = useState(null)
  const [source, setSource] = useState('auto')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setError('')
    return api.mlModel().then(setM).catch((e) => setError(e.message))
  }, [])

  useEffect(() => { load() }, [load, version])

  async function retrain() {
    setBusy(true)
    try {
      setM(await api.mlRetrain(source))
      onDone('Model retrained')
    } catch (e) { onError(e.message) }
    finally { setBusy(false) }
  }

  if (error) return <LoadError title="Could not load the model" message={error} onRetry={load} />
  if (!m) return <div className="card"><div className="empty">Loading model</div></div>
  const lin = m.linear
  const log = m.logistic

  return (
    <>
      <div className="page-head">
        <h1>Model</h1>
        <p>How the predictions are made, and how well they work.</p>
      </div>

      <div className={`notice ${m.source === 'demo' ? 'warn' : ''}`}>
        <b>Trained on:</b> {m.source_label} · {m.n_total} students · {m.trained_at}
        {m.source === 'demo' && ' · Demo data is generated, so accuracy shows the method works, not how your real students will do.'}
      </div>

      <div className="grid-stats">
        <StatCard label="Linear regression R²" value={lin.r2} tone="blue" />
        <StatCard label="Average error" value={lin.mae} unit="marks" tone="amber" />
        <StatCard label="Logistic accuracy" value={pct(log.accuracy)} />
        <StatCard label="Students who fail" value={pct(log.fail_rate)} tone="red" />
      </div>

      <div className="grid-2 even gap-bottom">
        <div className="card">
          <h2>Retrain the model</h2>
          <p className="hint">
            Your data: <b>{m.real_data.ready}</b> of {m.real_data.needed} students have mid-term marks,
            final marks and attendance.
          </p>
          <div className="retrain">
            <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Training data">
              <option value="auto">Automatic (your data once there is enough)</option>
              <option value="demo">Demo dataset</option>
              <option value="real">My students' data</option>
            </select>
            <button className="btn teal" onClick={retrain} disabled={busy}>{busy ? 'Training' : 'Retrain'}</button>
          </div>
          <div className="progress-line" role="img" aria-label={`${m.real_data.ready} of ${m.real_data.needed} students ready`}>
            <span style={{ width: `${Math.min(100, (m.real_data.ready / m.real_data.needed) * 100)}%` }} />
          </div>
        </div>
        <div className="card">
          <h2>How it works</h2>
          <p className="explain">
            <b>Linear regression</b> draws the best straight-line relationship between a student's
            mid-term average and attendance and their final score, so it can predict the final score.
          </p>
          <p className="explain">
            <b>Logistic regression</b> turns the same two inputs into a probability that the final score
            falls below {m.pass_mark}. {m.n_train} students were used to learn, and {m.n_test} were held back to test it.
          </p>
        </div>
      </div>

      <div className="grid-2 even gap-bottom">
        <div className="card">
          <h2>Linear regression</h2>
          <p className="hint">Predicts the final score</p>
          <table className="plain">
            <tbody>
              <tr><td>Starting point (intercept)</td><td><b>{lin.intercept}</b></td></tr>
              {lin.coefficients.map((c) => (
                <tr key={c.feature}>
                  <td>Each +1 in {c.label.toLowerCase()}</td>
                  <td><b>{c.value > 0 ? '+' : ''}{c.value}</b> marks</td>
                </tr>
              ))}
              <tr><td>R² on the test set</td><td><b>{lin.r2}</b></td></tr>
              <tr><td>Average error</td><td><b>{lin.mae}</b> marks</td></tr>
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Logistic regression</h2>
          <p className="hint">Predicts whether a student fails</p>
          <table className="plain">
            <tbody>
              <tr><td>Accuracy</td><td><b>{pct(log.accuracy)}</b></td></tr>
              <tr><td>Precision (flagged who really fail)</td><td><b>{pct(log.precision)}</b></td></tr>
              <tr><td>Recall (failing students caught)</td><td><b>{pct(log.recall)}</b></td></tr>
              {log.coefficients.map((c) => (
                <tr key={c.feature}>
                  <td>{c.label} weight</td>
                  <td><b>{c.value}</b> <span className="sub">{c.value < 0 ? 'protects' : 'raises risk'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid-2 even">
        <div className="card">
          <h2>Actual vs predicted</h2>
          <p className="hint">Test students. Dots near the dashed diagonal were predicted well.</p>
          <ScatterPlot points={m.scatter} passMark={m.pass_mark} />
        </div>
        <div className="card">
          <h2>Pass or fail results</h2>
          <p className="hint">Logistic regression on the {m.n_test} test students</p>
          <ConfusionMatrix c={log.confusion} />
        </div>
      </div>
    </>
  )
}
