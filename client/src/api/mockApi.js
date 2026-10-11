// The simulated backend. Same function names and shapes as httpApi.js, so
// components can't tell which one they're talking to. Data starts from
// seed.json and then lives in the visitor's own browser.

import seed from './seed.json'

const KEY = 'alerto:state'

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms))

function read() {
  const stored = localStorage.getItem(KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      localStorage.removeItem(KEY)
    }
  }
  localStorage.setItem(KEY, JSON.stringify(seed))
  return seed
}

function write(state) {
  localStorage.setItem(KEY, JSON.stringify(state))
  return state
}

export async function getProfile() {
  await delay()
  return read().profile
}

export async function updateProfile(input) {
  await delay()
  const state = read()
  state.profile = { ...state.profile, ...input }
  write(state)
  return state.profile
}

export async function listSubjects() {
  await delay()
  return read().subjects
}

export async function createSubject(input) {
  await delay()
  const state = read()
  const created = { id: crypto.randomUUID(), syncStatus: 'connected', lastSyncedMinutesAgo: 0, ...input }
  state.subjects = [...state.subjects, created]
  write(state)
  return created
}

export async function deleteSubject(id) {
  await delay()
  const state = read()
  state.subjects = state.subjects.filter((s) => s.id !== id)
  write(state)
}

export async function listAnnouncements() {
  await delay()
  const state = read()
  return state.announcements
    .slice()
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .map((a) => ({
      ...a,
      subject: state.subjects.find((s) => s.id === a.subjectId) ?? null,
      deliverables: state.deliverables.filter((d) => a.deliverableIds.includes(d.id)),
    }))
}

// Simulates pasting raw announcement text and letting the AI extract
// deliverables from it. Since there is no real model here, it returns a
// plausible parse so the interaction can be built and demoed end to end.
export async function parseAnnouncement({ subjectId, rawText }) {
  await delay(600)
  const state = read()
  const subject = state.subjects.find((s) => s.id === subjectId)

  const created = {
    id: crypto.randomUUID(),
    subjectId,
    receivedAt: new Date().toISOString(),
    source: 'Manual Paste',
    summary: [rawText.trim().slice(0, 160) || 'No summary available.'],
    deliverableIds: [],
  }

  state.announcements = [created, ...state.announcements]
  write(state)
  return { ...created, subject, deliverables: [] }
}

export async function listDeliverables() {
  await delay()
  const state = read()
  return state.deliverables.map((d) => ({
    ...d,
    subject: state.subjects.find((s) => s.id === d.subjectId) ?? null,
  }))
}

export async function updateDeliverable(id, input) {
  await delay()
  const state = read()
  const index = state.deliverables.findIndex((d) => d.id === id)
  if (index === -1) throw new Error('Not found')
  state.deliverables[index] = { ...state.deliverables[index], ...input }
  write(state)
  return state.deliverables[index]
}

export async function listAlerts() {
  await delay()
  return read().alerts.slice().sort((a, b) => a.createdMinutesAgo - b.createdMinutesAgo)
}

export async function dismissAlert(id) {
  await delay()
  const state = read()
  state.alerts = state.alerts.filter((a) => a.id !== id)
  write(state)
}

// ---------------------------------------------------------------------------
// Canvas LMS sync -- there's no real Canvas account to verify against in
// demo mode, so these throw a clear error instead of pretending to connect.
// Run the real backend (VITE_USE_MOCK_API=false) to use this feature for real.
// ---------------------------------------------------------------------------

const CANVAS_SYNC_UNAVAILABLE =
  'Canvas sync needs the real backend. Run the Express server and set VITE_USE_MOCK_API=false to use this feature.'

export async function connectCanvas() {
  await delay()
  throw new Error(CANVAS_SYNC_UNAVAILABLE)
}

export async function disconnectCanvas() {
  await delay()
  throw new Error(CANVAS_SYNC_UNAVAILABLE)
}

export async function triggerCanvasSync() {
  await delay()
  throw new Error(CANVAS_SYNC_UNAVAILABLE)
}

export async function getSyncStatus() {
  await delay()
  return { connected: false, canvasUserName: null, connectedAt: null, latestJob: null }
}
