// Shows how much each input pushes the chance of failing up (red) or down (green).
export default function DriverBars({ drivers }) {
  const scale = Math.max(1, ...drivers.map((d) => Math.abs(d.effect)))
  return (
    <div className="drivers">
      {drivers.map((d) => {
        const width = (Math.abs(d.effect) / scale) * 50
        const raises = d.effect > 0
        return (
          <div className="drv-row" key={d.feature}>
            <div className="drv-text">
              <b>{d.label}</b>
              <span className="sub">{d.value}{d.feature === 'attendance' ? '%' : ''}</span>
            </div>
            <div className="drv-track" role="img"
              aria-label={`${d.label} ${raises ? 'raises' : 'lowers'} the chance of failing`}>
              <span className="drv-center" />
              <span className={`drv-fill ${raises ? 'up' : 'down'}`}
                style={raises ? { left: '50%', width: `${width}%` } : { right: '50%', width: `${width}%` }} />
            </div>
            <span className={`drv-tag ${raises ? 'up' : 'down'}`}>{raises ? 'Raises risk' : 'Lowers risk'}</span>
          </div>
        )
      })}
    </div>
  )
}
