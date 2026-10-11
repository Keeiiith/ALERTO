// The real client. Every function here talks to YOUR Express API.
//
// The server speaks plain Postgres rows (snake_case columns, subjects joined
// in as subject_code/subject_name/subject_color). The mappers below turn
// that into exactly the shape mockApi.js returns, so src/pages and
// src/components never have to know which backend they're talking to.

const BASE = import.meta.env.VITE_API_BASE_URL || ''

async function request(path, options) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (body?.error) message = body.error
    } catch {
      // The body was not JSON. The status line is all we have.
    }
    throw new Error(message)
  }

  return response.status === 204 ? null : response.json()
}

function minutesSince(isoString) {
  if (!isoString) return 0
  return Math.max(0, Math.round((Date.now() - new Date(isoString).getTime()) / 60000))
}

function mapProfile(row) {
  if (!row) return null
  return {
    name: row.name,
    email: row.email,
    phone: row.phone,
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
    timezone: row.timezone,
    maxDailyCapacityHours: Number(row.max_daily_capacity_hours),
  }
}

function mapSubject(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    instructor: row.instructor,
    department: row.department,
    units: Number(row.units),
    schedule: row.schedule,
    location: row.location,
    feedUrl: row.feed_url,
    feedSource: row.feed_source,
    syncStatus: row.sync_status,
    lastSyncedMinutesAgo: minutesSince(row.last_synced_at),
    color: row.color,
  }
}

// Builds the small nested `subject` object that deliverable/announcement
// rows carry, from the subject_* columns their queries join in.
function nestedSubject(row) {
  if (!row.subject_code) return null
  return { id: row.subject_id, code: row.subject_code, name: row.subject_name, color: row.subject_color }
}

function mapDeliverable(row) {
  return {
    id: row.id,
    subjectId: row.subject_id,
    type: row.type,
    title: row.title,
    dueAt: row.due_at,
    location: row.location,
    hoursEstimate: Number(row.hours_estimate),
    status: row.status,
    subject: nestedSubject(row),
  }
}

function mapAnnouncement(row) {
  return {
    id: row.id,
    subjectId: row.subject_id,
    receivedAt: row.received_at,
    source: row.source,
    summary: row.summary,
    subject: nestedSubject(row),
    deliverables: (row.deliverables ?? []).map(mapDeliverable),
  }
}

function mapAlert(row) {
  return {
    id: row.id,
    severity: row.severity,
    title: row.title,
    message: row.message,
    context: row.context,
    createdMinutesAgo: minutesSince(row.created_at),
    channels: row.channels,
    status: row.status,
  }
}

export const getProfile = () => request('/api/profile').then(mapProfile)

export const updateProfile = (input) =>
  request('/api/profile', {
    method: 'PUT',
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      phone: input.phone,
      quietHoursStart: input.quietHoursStart,
      quietHoursEnd: input.quietHoursEnd,
      timezone: input.timezone,
      maxDailyCapacityHours: input.maxDailyCapacityHours,
    }),
  }).then(mapProfile)

export const listSubjects = () => request('/api/subjects').then((rows) => rows.map(mapSubject))

export const createSubject = (input) =>
  request('/api/subjects', { method: 'POST', body: JSON.stringify(input) }).then(mapSubject)

export const deleteSubject = (id) => request(`/api/subjects/${id}`, { method: 'DELETE' })

export const listAnnouncements = () =>
  request('/api/announcements').then((rows) => rows.map(mapAnnouncement))

export const parseAnnouncement = (input) =>
  request('/api/announcements/parse', { method: 'POST', body: JSON.stringify(input) }).then(mapAnnouncement)

export const listDeliverables = () =>
  request('/api/requirements').then((rows) => rows.map(mapDeliverable))

export const updateDeliverable = (id, input) =>
  request(`/api/requirements/${id}`, { method: 'PUT', body: JSON.stringify(input) }).then(mapDeliverable)

export const listAlerts = () => request('/api/alerts').then((rows) => rows.map(mapAlert))

export const dismissAlert = (id) => request(`/api/alerts/${id}`, { method: 'DELETE' })

// ---------------------------------------------------------------------------
// Canvas LMS sync (server/routes/sync.js)
// ---------------------------------------------------------------------------

function mapSyncStatus(row) {
  return {
    connected: row.connected,
    canvasUserName: row.canvasUserName,
    connectedAt: row.connectedAt,
    latestJob: row.latestJob && {
      id: row.latestJob.id,
      status: row.latestJob.status, // 'queued' | 'running' | 'success' | 'failed'
      triggeredBy: row.latestJob.triggeredBy,
      startedAt: row.latestJob.startedAt,
      finishedAt: row.latestJob.finishedAt,
      errorMessage: row.latestJob.errorMessage,
      subjectsSynced: row.latestJob.subjectsSynced,
      deliverablesSynced: row.latestJob.deliverablesSynced,
      announcementsSynced: row.latestJob.announcementsSynced,
    },
  }
}

// Stores the access token (after the server verifies it against Canvas) and
// kicks off the first sync. Resolves as soon as the server has accepted the
// request (202) -- the sync itself keeps running in the background, so the
// caller should start polling getSyncStatus().
export const connectCanvas = ({ accessToken }) =>
  request('/api/sync/connect', { method: 'POST', body: JSON.stringify({ accessToken }) })

export const disconnectCanvas = () => request('/api/sync/connect', { method: 'DELETE' })

export const triggerCanvasSync = () => request('/api/sync/trigger', { method: 'POST' })

export const getSyncStatus = () => request('/api/sync/status').then(mapSyncStatus)
