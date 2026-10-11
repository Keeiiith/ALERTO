import { BookOpen, CalendarDays, ChartNoAxesCombined, House, Megaphone } from 'lucide-react'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: House },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'overload', label: 'Overload Analysis', icon: ChartNoAxesCombined },
  { id: 'subjects', label: 'Subjects', icon: BookOpen },
]

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">A</span>
        <div>
          <div className="brand-name">ALERTO</div>
          <div className="brand-sub">Academic Pulse</div>
        </div>
      </div>

      <nav className="nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item${activePage === item.id ? ' active' : ''}`}
            onClick={() => onNavigate(item.id)}
            aria-current={activePage === item.id ? 'page' : undefined}
          >
            <item.icon className="nav-icon" aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
