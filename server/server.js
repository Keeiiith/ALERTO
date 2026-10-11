import express from 'express'
import cors from 'cors'
import { pool } from './db/pool.js'
import * as profileRepo from './repos/profileRepo.js'
import * as subjectsRepo from './repos/subjectsRepo.js'
import * as announcementsRepo from './repos/announcementsRepo.js'
import * as deliverablesRepo from './repos/deliverablesRepo.js'
import * as alertsRepo from './repos/alertsRepo.js'
import { extractDeliverables } from './lib/extractDeliverables.js'
import { syncRouter } from './routes/sync.js'
import { startScheduledSync } from './lib/cronScheduler.js'

const app = express()

// CORS before the routes. Middleware registered after a route never sees that
// route's requests.
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(cors({ origin: allowedOrigins }))
app.use(express.json({ limit: '100kb' }))

app.get('/healthz', (request, response) => {
  response.json({ ok: true })
})

app.get('/readyz', async (request, response) => {
  try {
    await pool.query('SELECT 1')
    response.json({ ok: true, db: 'up' })
  } catch (error) {
    console.error('readyz failed:', error.message)
    response.status(503).json({ ok: false, db: 'down' })
  }
})

app.use('/api/sync', syncRouter(pool))

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

app.get('/api/profile', async (request, response, next) => {
  try {
    response.json(await profileRepo.get(pool))
  } catch (error) {
    next(error)
  }
})

app.put('/api/profile', async (request, response, next) => {
  try {
    response.json(await profileRepo.update(pool, request.body ?? {}))
  } catch (error) {
    next(error)
  }
})

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

function validateSubject(body) {
  const errors = []
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''

  if (!code) errors.push('code is required')
  if (!name) errors.push('name is required')
  if (code.length > 20) errors.push('code must be 20 characters or fewer')
  if (name.length > 160) errors.push('name must be 160 characters or fewer')

  return { errors, value: { ...body, code, name } }
}

app.get('/api/subjects', async (request, response, next) => {
  try {
    response.json(await subjectsRepo.getAll(pool))
  } catch (error) {
    next(error)
  }
})

app.post('/api/subjects', async (request, response, next) => {
  const { errors, value } = validateSubject(request.body ?? {})
  if (errors.length > 0) return response.status(400).json({ error: errors.join('; ') })

  try {
    response.status(201).json(await subjectsRepo.create(pool, value))
  } catch (error) {
    next(error)
  }
})

app.delete('/api/subjects/:id', async (request, response, next) => {
  try {
    const removed = await subjectsRepo.remove(pool, request.params.id)
    if (!removed) return response.status(404).json({ error: 'Not found' })
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

app.get('/api/announcements', async (request, response, next) => {
  try {
    response.json(await announcementsRepo.getAll(pool))
  } catch (error) {
    next(error)
  }
})

// Paste raw text in, get a summary and structured deliverables out. See
// lib/extractDeliverables.js for how this works today and how to replace it
// with a real model call.
app.post('/api/announcements/parse', async (request, response, next) => {
  const subjectId = Number(request.body?.subjectId)
  const rawText = typeof request.body?.rawText === 'string' ? request.body.rawText.trim() : ''

  if (!subjectId) return response.status(400).json({ error: 'subjectId is required' })
  if (!rawText) return response.status(400).json({ error: 'rawText is required' })
  if (rawText.length > 8000) return response.status(400).json({ error: 'rawText must be 8000 characters or fewer' })

  try {
    const subject = await subjectsRepo.getById(pool, subjectId)
    if (!subject) return response.status(404).json({ error: 'Subject not found' })

    const { summary, deliverables } = extractDeliverables(rawText)

    const announcement = await announcementsRepo.create(pool, {
      subjectId,
      source: 'Manual Paste',
      rawText,
      summary,
    })

    const createdDeliverables = await deliverablesRepo.createMany(pool, subjectId, announcement.id, deliverables)

    response.status(201).json({
      ...announcement,
      subject_code: subject.code,
      subject_name: subject.name,
      subject_color: subject.color,
      deliverables: createdDeliverables,
    })
  } catch (error) {
    next(error)
  }
})

// ---------------------------------------------------------------------------
// Deliverables ("requirements" in the client API, matching the README)
// ---------------------------------------------------------------------------

app.get('/api/requirements', async (request, response, next) => {
  try {
    response.json(await deliverablesRepo.getAll(pool))
  } catch (error) {
    next(error)
  }
})

app.put('/api/requirements/:id', async (request, response, next) => {
  const { status } = request.body ?? {}
  if (status !== undefined && status !== 'pending' && status !== 'done') {
    return response.status(400).json({ error: 'status must be "pending" or "done"' })
  }

  try {
    const updated = await deliverablesRepo.update(pool, request.params.id, request.body ?? {})
    if (!updated) return response.status(404).json({ error: 'Not found' })
    response.json(updated)
  } catch (error) {
    next(error)
  }
})

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

app.get('/api/alerts', async (request, response, next) => {
  try {
    response.json(await alertsRepo.getAll(pool))
  } catch (error) {
    next(error)
  }
})

app.delete('/api/alerts/:id', async (request, response, next) => {
  try {
    const removed = await alertsRepo.remove(pool, request.params.id)
    if (!removed) return response.status(404).json({ error: 'Not found' })
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.use((request, response) => {
  response.status(404).json({ error: 'No such route' })
})

// The detail goes in your logs; the visitor gets a plain message.
app.use((error, request, response, next) => {
  console.error(error)
  response.status(500).json({ error: 'Something went wrong on the server' })
})

const port = process.env.PORT || 3000

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
  console.log(`CORS allows: ${allowedOrigins.join(', ')}`)
  startScheduledSync()
})
