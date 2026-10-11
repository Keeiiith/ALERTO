import { useEffect, useRef, useState } from 'react'
import {
  createSubject,
  deleteSubject,
  updateProfile,
  connectCanvas,
  disconnectCanvas,
  triggerCanvasSync,
  getSyncStatus,
} from '../api/index.js'
import { minutesAgoLabel } from '../lib/overload.js'

const EMPTY_SUBJECT = { code: '', name: '', instructor: '', schedule: '', location: '', units: 3, feedUrl: '' }

// Statuses that mean a sync is still in flight -- keep polling while one of
// these is showing.
const JOB_IN_PROGRESS = ['queued', 'running']

export default function Subjects({ data, onReload }) {
  const { subjects, profile } = data
  const [form, setForm] = useState(EMPTY_SUBJECT)
  const [saving, setSaving] = useState(false)
  const [contactForm, setContactForm] = useState({ email: profile?.email ?? '', phone: profile?.phone ?? '' })
  const [savingContact, setSavingContact] = useState(false)

  const [syncStatus, setSyncStatus] = useState(null)
  const [canvasToken, setCanvasToken] = useState('')
  const [canvasBusy, setCanvasBusy] = useState(false)
  const [canvasError, setCanvasError] = useState('')
  const pollRef = useRef(null)

  async function refreshSyncStatus() {
    try {
      const status = await getSyncStatus()
      setSyncStatus(status)
      return status
    } catch (error) {
      setCanvasError(error.message)
      return null
    }
  }

  // Load the current connection state once, then keep polling only while a
  // sync job is actually running -- the backend does the sync in the
  // background, so this is how the UI finds out it finished.
  useEffect(() => {
    refreshSyncStatus()
    return () => clearInterval(pollRef.current)
  }, [])

  function startPolling() {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const status = await refreshSyncStatus()
      if (status && !JOB_IN_PROGRESS.includes(status.latestJob?.status)) {
        clearInterval(pollRef.current)
        await onReload()
      }
    }, 4000)
  }

  async function handleConnectCanvas(event) {
    event.preventDefault()
    if (!canvasToken.trim()) return
    setCanvasBusy(true)
    setCanvasError('')
    try {
      await connectCanvas({ accessToken: canvasToken.trim() })
      setCanvasToken('')
      await refreshSyncStatus()
      startPolling()
    } catch (error) {
      setCanvasError(error.message)
    } finally {
      setCanvasBusy(false)
    }
  }

  async function handleDisconnectCanvas() {
    setCanvasBusy(true)
    setCanvasError('')
    try {
      await disconnectCanvas()
      clearInterval(pollRef.current)
      await refreshSyncStatus()
    } catch (error) {
      setCanvasError(error.message)
    } finally {
      setCanvasBusy(false)
    }
  }

  async function handleSyncNow() {
    setCanvasBusy(true)
    setCanvasError('')
    try {
      await triggerCanvasSync()
      await refreshSyncStatus()
      startPolling()
    } catch (error) {
      setCanvasError(error.message)
    } finally {
      setCanvasBusy(false)
    }
  }

  async function handleAddSubject(event) {
    event.preventDefault()
    if (!form.code.trim() || !form.name.trim()) return
    setSaving(true)
    try {
      await createSubject({ ...form, units: Number(form.units), color: 'teal', feedSource: 'Manual Entry' })
      setForm(EMPTY_SUBJECT)
      await onReload()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    await deleteSubject(id)
    await onReload()
  }

  async function handleSaveContact(event) {
    event.preventDefault()
    setSavingContact(true)
    try {
      await updateProfile(contactForm)
      await onReload()
    } finally {
      setSavingContact(false)
    }
  }

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <p className="eyebrow">Course Registration & Contact Profile</p>
          <h1>Subject & Profile Setup</h1>
          <p className="lede">Manage enrolled courses, syllabus feed sync, and emergency alert contact details.</p>
        </div>
      </header>

      <div className="two-col">
        <div className="col">
          <h2>Enrolled Academic Courses <span className="muted">({subjects.length} active)</span></h2>

          <div className="subject-list">
            {subjects.map((s) => (
              <div key={s.id} className={`card subject-card subject-${s.color}`}>
                <div className="subject-card-top">
                  <span className={`chip subject-${s.color}`}>{s.code}</span>
                  <strong>{s.name}</strong>
                  <span className="muted small">{s.units} Units</span>
                </div>
                <p className="muted small">{s.instructor} · {s.department}</p>
                <p className="muted small">{s.schedule} · {s.location}</p>
                {s.feedUrl && (
                  <p className="muted small feed-url">{s.feedUrl}</p>
                )}
                <div className="subject-card-footer">
                  <span className="muted small">{s.feedSource} · Synced {minutesAgoLabel(s.lastSyncedMinutesAgo)}</span>
                  <button className="ghost-btn danger" onClick={() => handleDelete(s.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>

          <form className="card" onSubmit={handleAddSubject}>
            <h2>Register additional course</h2>
            <label htmlFor="code">Course code</label>
            <input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />

            <label htmlFor="name">Course title</label>
            <input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />

            <label htmlFor="instructor">Instructor</label>
            <input id="instructor" value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} />

            <label htmlFor="schedule">Timetable</label>
            <input id="schedule" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder="MWF 10:00 AM - 11:30 AM" />

            <label htmlFor="location">Location</label>
            <input id="location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />

            <label htmlFor="feedUrl">Syllabus feed URL (optional)</label>
            <input id="feedUrl" value={form.feedUrl} onChange={(e) => setForm({ ...form, feedUrl: e.target.value })} placeholder="https://..." />

            <button type="submit" disabled={saving}>{saving ? 'Adding...' : '+ Add New Subject'}</button>
          </form>
        </div>

        <div className="col">
          <div className="card portal-sync-card">
            <h2>Canvas LMS Sync</h2>
            <p className="muted small">
              Automatically pulls enrolled courses and upcoming assignment due dates from Canvas
              instead of entering them by hand.
            </p>

            {canvasError && <p className="error small">{canvasError}</p>}

            {syncStatus?.connected ? (
              <>
                <div className="portal-sync-status">
                  <span className={`badge status-pill`}>Connected</span>
                  <span className="muted small">as {syncStatus.canvasUserName}</span>
                </div>

                {syncStatus.latestJob && (
                  <p className="muted small">
                    Last sync: <strong>{syncStatus.latestJob.status}</strong>
                    {JOB_IN_PROGRESS.includes(syncStatus.latestJob.status)
                      ? ' (running in the background -- this page updates automatically)'
                      : syncStatus.latestJob.status === 'success'
                      ? ` -- ${syncStatus.latestJob.subjectsSynced} subjects, ${syncStatus.latestJob.deliverablesSynced} deliverables, ${syncStatus.latestJob.announcementsSynced} announcements`
                      : syncStatus.latestJob.errorMessage
                      ? ` -- ${syncStatus.latestJob.errorMessage}`
                      : ''}
                  </p>
                )}

                <div className="portal-sync-actions">
                  <button type="button" onClick={handleSyncNow} disabled={canvasBusy}>
                    {canvasBusy ? 'Working...' : 'Sync Now'}
                  </button>
                  <button type="button" className="ghost-btn danger" onClick={handleDisconnectCanvas} disabled={canvasBusy}>
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleConnectCanvas}>
                <label htmlFor="canvasToken">Canvas access token</label>
                <input
                  id="canvasToken"
                  type="password"
                  value={canvasToken}
                  onChange={(e) => setCanvasToken(e.target.value)}
                  placeholder="Paste the token Canvas gave you"
                  autoComplete="off"
                  required
                />
                <p className="muted small">
                  Generate one in Canvas under Account → Settings → New Access Token. Encrypted at rest; revoke it
                  anytime from Canvas without changing your password.
                </p>

                <button type="submit" disabled={canvasBusy}>{canvasBusy ? 'Connecting...' : 'Connect Canvas Account'}</button>
              </form>
            )}
          </div>

          <form className="card" onSubmit={handleSaveContact}>
            <h2>Contact & Dispatch Coordinates</h2>
            <p className="muted small">Verified endpoints where ALERTO delivers overload warnings and clash alarms.</p>

            <label htmlFor="email">Primary academic email</label>
            <input
              id="email"
              type="email"
              value={contactForm.email}
              onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
            />

            <label htmlFor="phone">Mobile number (SMS dispatch)</label>
            <input
              id="phone"
              value={contactForm.phone}
              onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
            />
            <p className="muted small">SMS alerts are reserved for critical schedule clashes and severe daily overload.</p>

            <button type="submit" disabled={savingContact}>{savingContact ? 'Saving...' : 'Save Contact Changes'}</button>
          </form>
        </div>
      </div>
    </div>
  )
}
