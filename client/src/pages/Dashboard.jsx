import { SeverityBadge, SubjectChip, DeliverableTypeBadge } from '../components/Badges.jsx'
import { dailyWorkload, formatDay, formatTime, minutesAgoLabel } from '../lib/overload.js'
import { TriangleAlert } from 'lucide-react'

export default function Dashboard({ data, onDismissAlert, onNavigate }) {
  const { profile, subjects, announcements, deliverables, alerts } = data
  const maxCapacity = profile?.maxDailyCapacityHours ?? 6

  const withSubject = deliverables.map((d) => ({ ...d, subject: d.subject ?? subjects.find((s) => s.id === d.subjectId) }))
  const today = dailyWorkload(withSubject, maxCapacity, 1)[0]
  const upcoming = dailyWorkload(withSubject, maxCapacity, 2) // today + tomorrow -> next 48h

  const examsThisWeek = withSubject.filter((d) => d.type === 'EXAM').length
  const pendingCount = withSubject.filter((d) => d.status !== 'done').length

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <p className="eyebrow">Academic Advisory Pulse</p>
          <h1>Welcome back, {profile?.name ?? 'Student'}!</h1>
          <p className="lede">Here's your academic workload summary and risk mitigation feed for today.</p>
        </div>
      </header>

      <section className={`risk-banner risk-${today.riskLevel}`}>
        <TriangleAlert className="risk-banner-icon" aria-hidden="true" />
        <div className="risk-banner-body">
          <div className="risk-banner-top">
            <strong>Academic Risk Threshold</strong>
            <span className={`badge risk-${today.riskLevel}`}>{today.riskLevel.toUpperCase()}</span>
          </div>
          <p>
            {today.items.length > 0
              ? `${today.items.length} deliverable${today.items.length === 1 ? '' : 's'} due today, projecting ${today.hours.toFixed(1)}h of work against your ${maxCapacity}h max.`
              : 'Nothing due today. Capacity is clear.'}
          </p>
        </div>
        <div className="risk-banner-meter">
          <strong>{today.hours.toFixed(1)}h</strong>
          <span className="muted"> / {maxCapacity}h max</span>
        </div>
      </section>

      <section className="stat-grid">
        <div className="card stat-card">
          <span className="stat-number">{pendingCount}</span>
          <span className="stat-label">Deliverables — Total Pending Tasks</span>
        </div>
        <div className="card stat-card">
          <span className="stat-number">{examsThisWeek}</span>
          <span className="stat-label">Scheduled — Upcoming Exams This Week</span>
        </div>
        <div className="card stat-card">
          <span className="stat-number">{announcements.length}</span>
          <span className="stat-label">Ingested — Unread Announcements</span>
        </div>
      </section>

      <section className="two-col">
        <div className="col">
          <h2>Active Alerts Stack <span className="muted">({alerts.length})</span></h2>
          {alerts.length === 0 && <p className="muted empty-state">No active alerts. You're clear.</p>}
          <div className="alert-stack">
            {alerts.map((alert) => (
              <div key={alert.id} className={`card alert-card severity-${alert.severity.toLowerCase()}`}>
                <div className="alert-card-top">
                  <SeverityBadge severity={alert.severity} />
                  <span className="muted small">{minutesAgoLabel(alert.createdMinutesAgo)}</span>
                </div>
                <strong>{alert.title}</strong>
                <p>{alert.message}</p>
                {alert.context && <p className="muted small">{alert.context}</p>}
                <button className="ghost-btn" onClick={() => onDismissAlert(alert.id)}>Dismiss</button>
              </div>
            ))}
          </div>
        </div>

        <div className="col">
          <h2>Next 48 Hours Feed <span className="muted">({upcoming.reduce((n, d) => n + d.items.length, 0)} items)</span></h2>
          {upcoming.every((day) => day.items.length === 0) && (
            <p className="muted empty-state">Nothing due in the next 48 hours.</p>
          )}
          {upcoming.map((day) => (
            day.items.length > 0 && (
              <div key={day.date.toISOString()} className="day-group">
                <h3>{formatDay(day.date.toISOString())}</h3>
                <ul className="list">
                  {day.items.map((item) => (
                    <li key={item.id} className="card deliverable-row">
                      <div>
                        <div className="deliverable-row-top">
                          <SubjectChip subject={item.subject} />
                          <DeliverableTypeBadge type={item.type} />
                        </div>
                        <strong>{item.title}</strong>
                        <p className="muted small">Due {formatTime(item.dueAt)} · {item.subject?.name}</p>
                      </div>
                      {item.hoursEstimate > 0 && <span className="hours-pill">{item.hoursEstimate}h est.</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )
          ))}
          <button className="ghost-btn" onClick={() => onNavigate('calendar')}>Open full calendar →</button>
        </div>
      </section>
    </div>
  )
}
