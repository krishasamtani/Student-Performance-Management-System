import Icon from './Icon'

const groups = [
  { label: 'Overview', items: [{ id: 'dashboard', label: 'Dashboard' }] },
  {
    label: 'Manage',
    items: [
      { id: 'students', label: 'Students' },
      { id: 'marks', label: 'Marks' },
      { id: 'attendance', label: 'Attendance' },
      { id: 'courses', label: 'Courses' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { id: 'predictions', label: 'Predictions' },
      { id: 'what-if', label: 'What-if lab', icon: 'whatif' },
      { id: 'model', label: 'Model' },
    ],
  },
  { label: 'Data', items: [{ id: 'data', label: 'Import & export' }] },
]

export default function Sidebar({ page }) {
  // A student's profile page belongs to the Students section.
  const active = page === 'student' ? 'students' : page
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
        {groups.map((g) => (
          <div className="nav-group" key={g.label}>
            <div className="nav-label">{g.label}</div>
            {g.items.map((it) => (
              <a key={it.id} href={`#/${it.id}`} className={active === it.id ? 'active' : ''}
                aria-current={active === it.id ? 'page' : undefined}>
                <Icon name={it.icon || it.id} /> {it.label}
              </a>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">Flask · React · scikit-learn</div>
    </aside>
  )
}
