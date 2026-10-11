import { SubjectChip } from '../components/Badges.jsx'
import { dateKey, formatDay, formatTime } from '../lib/overload.js'
import { EmptyState } from '../components/AsyncState.jsx'

// Announcements past this age are dropped from the view -- a syllabus
// change from a month ago isn't actionable anymore, and the list would
// otherwise just grow forever as Canvas syncs run. They stay in the
// database (nothing here deletes rows), they just stop showing up.
const VISIBLE_WINDOW_DAYS = 14

export default function Announcements({ data }) {
  const { announcements } = data

  const cutoff = Date.now() - VISIBLE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const recent = announcements.filter((a) => new Date(a.receivedAt).getTime() >= cutoff)

  const byDay = new Map()
  for (const a of recent) {
    const key = dateKey(a.receivedAt)
    if (!byDay.has(key)) byDay.set(key, { date: a.receivedAt, items: [] })
    byDay.get(key).items.push(a)
  }
  for (const day of byDay.values()) {
    day.items.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
  }
  const days = Array.from(byDay.values()).sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <p className="eyebrow">Feed</p>
          <h1>Announcements Hub</h1>
          <p className="lede">
            What was announced, grouped by day. Announcements older than {VISIBLE_WINDOW_DAYS} days drop off
            automatically since they're no longer actionable.
          </p>
        </div>
      </header>

      {days.length === 0 && (
        <EmptyState>
          No announcements in the last {VISIBLE_WINDOW_DAYS} days. Sync Canvas on the Subjects page to pull in the
          latest.
        </EmptyState>
      )}

      <div className="announcement-list">
        {days.map((day) => (
          <div key={day.date} className="day-group">
            <h3>{formatDay(day.date)}</h3>
            <ul className="list">
              {day.items.map((a) => (
                <li key={a.id} className="card deliverable-row">
                  <div>
                    <div className="deliverable-row-top">
                      <SubjectChip subject={a.subject} />
                      <strong>{a.subject?.name ?? 'Unknown subject'}</strong>
                    </div>
                    <p>There's an announcement: {a.summary[0] ?? 'No details available.'}</p>
                  </div>
                  <span className="muted small">{formatTime(a.receivedAt)} · {a.source}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}