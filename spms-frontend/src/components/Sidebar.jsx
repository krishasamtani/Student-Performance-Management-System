import Icon from './Icon'

const items = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'students', label: 'Students' },
  { id: 'marks', label: 'Marks' },
  { id: 'attendance', label: 'Attendance' },
]

export default function Sidebar({ page, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">SP</div>
        <div>
          <div className="brand-name">Student Performance</div>
          <div className="brand-sub">Management System</div>
        </div>
      </div>
      <nav className="nav" aria-label="Main">
        {items.map((it) => (
          <button key={it.id} className={page === it.id ? 'active' : ''}
            onClick={() => onNavigate(it.id)} aria-current={page === it.id ? 'page' : undefined}>
            <Icon name={it.id} /> {it.label}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">Flask · React · Docker</div>
    </aside>
  )
}
