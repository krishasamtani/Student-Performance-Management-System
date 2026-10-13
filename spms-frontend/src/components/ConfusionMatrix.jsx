export default function ConfusionMatrix({ c }) {
  const cell = (value, label, good) => (
    <div className={`cm-cell ${good ? 'good' : 'bad'}`}>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  )
  return (
    <div className="cm" role="table" aria-label="Confusion matrix">
      <div className="cm-corner" />
      <div className="cm-head">Predicted pass</div>
      <div className="cm-head">Predicted fail</div>
      <div className="cm-side">Actually passed</div>
      {cell(c.tn, 'correct', true)}
      {cell(c.fp, 'false alarm', false)}
      <div className="cm-side">Actually failed</div>
      {cell(c.fn, 'missed', false)}
      {cell(c.tp, 'caught', true)}
    </div>
  )
}
