import { useState } from 'react'
import { updateProfile } from '../api/index.js'
import { SeverityBadge } from '../components/Badges.jsx'
import { dailyWorkload, formatDay, minutesAgoLabel } from '../lib/overload.js'

const CHANNEL_MATRIX = [
  { severity: 'CRITICAL', description: 'Schedule clash / daily overlap', email: true, sms: true },
  { severity: 'HIGH', description: 'Capacity strain / prep overlap', email: true, sms: true },
  { severity: 'MODERATE', description: 'Upcoming exam prep / materials', email: true, sms: false },
  { severity: 'LOW', description: 'General course announcement / feed sync', email: true, sms: false },
]

export default function OverloadAnalysis({ data, onReload }) {
  const { subjects, deliverables, alerts, profile } = data
  const [capacity, setCapacity] = useState(profile?.maxDailyCapacityHours ?? 6)
  const [saving, setSaving] = useState(false)

  const withSubject = deliverables.map((d) => ({ ...d, subject: d.subject ?? subjects.find((s) => s.id === d.subjectId) }))
  const week = dailyWorkload(withSubject, capacity, 7)
  const maxBar = Math.max(capacity * 1.6, ...week.map((d) => d.hours), 1)
  const average = week.reduce((sum, d) => sum + d.hours, 0) / week.length
  const peakDay = week.reduce((peak, d) => (d.hours > peak.hours ? d : peak), week[0])

  async function handleSaveCapacity(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await updateProfile({ maxDailyCapacityHours: Number(capacity) })
      await onReload()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <p className="eyebrow">Analytics & Thresholds</p>
          <h1>Overload Analysis & Insights</h1>
          <p className="lede">Workload calculation metrics, capacity modeling, and automated alert delivery settings.</p>
        </div>
      </header>

      <section className="card">
        <h2>Projected Workload vs. Capacity</h2>
        <p className="muted small">Daily estimated academic hours across the week compared to your {capacity}h max capacity ceiling.</p>

        <div className="bar-chart">
          {week.map((day) => (
            <div key={day.date.toISOString()} className="bar-col">
              <span className="bar-value">{day.hours > 0 ? `${day.hours.toFixed(1)}h` : ''}</span>
              <div className="bar-track">
                <div
                  className={`bar-fill risk-${day.riskLevel}`}
                  style={{ height: `${Math.max((day.hours / maxBar) * 100, day.hours > 0 ? 4 : 0)}%` }}
                />
                <div className="bar-capacity-line" style={{ bottom: `${(capacity / maxBar) * 100}%` }} />
              </div>
              <span className="bar-label">{formatDay(day.date.toISOString()).split(' ')[0]}</span>
            </div>
          ))}
        </div>

        <div className="metric-row">
          <div className="metric"><span className="muted small">Average Daily Load</span><strong>{average.toFixed(1)} hrs</strong></div>
          <div className="metric"><span className="muted small">Peak Strain Day</span><strong>{formatDay(peakDay.date.toISOString())} · {peakDay.hours.toFixed(1)}h</strong></div>
          <div className="metric"><span className="muted small">Projected Prep Strain</span><span className={`badge risk-${peakDay.riskLevel}`}>{peakDay.riskLevel.toUpperCase()}</span></div>
        </div>
      </section>

      <section className="card">
        <form onSubmit={handleSaveCapacity}>
          <h2>Alert Threshold Configuration</h2>
          <p className="muted small">Alerts trigger whenever scheduled assignments and exam prep exceed this threshold.</p>

          <label htmlFor="capacity">Maximum daily workload capacity (hours)</label>
          <input
            id="capacity"
            type="range"
            min="3"
            max="12"
            step="0.5"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
          <p><strong>{Number(capacity).toFixed(1)} hrs/day</strong></p>

          <h3>Alert Channels Toggle Matrix</h3>
          <table className="channel-table">
            <thead>
              <tr><th>Severity</th><th>Description</th><th>Email</th><th>SMS</th></tr>
            </thead>
            <tbody>
              {CHANNEL_MATRIX.map((row) => (
                <tr key={row.severity}>
                  <td><SeverityBadge severity={row.severity} /></td>
                  <td className="muted small">{row.description}</td>
                  <td>{row.email ? '✓' : '—'}</td>
                  <td>{row.sms ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Alert Settings'}</button>
        </form>
      </section>

      <section className="card">
        <h2>Recent Alert Logs <span className="muted">({alerts.length} dispatches tracked)</span></h2>
        {alerts.length === 0 ? (
          <p className="muted empty-state">No alerts dispatched yet.</p>
        ) : (
          <table className="channel-table">
            <thead>
              <tr><th>Severity</th><th>Context</th><th>Channel</th><th>Dispatched</th><th>Status</th></tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td><SeverityBadge severity={a.severity} /></td>
                  <td className="muted small">{a.title}: {a.message}</td>
                  <td className="muted small">{a.channels.join(' & ')}</td>
                  <td className="muted small">{minutesAgoLabel(a.createdMinutesAgo)}</td>
                  <td><span className="badge status-pill">{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
