// Routes for connecting and triggering Canvas sync. Pulled into its own
// Router (unlike the rest of this app's routes, which still live inline in
// server.js) because this resource has enough going on -- credential
// handling, a detached background job, status polling -- to earn the split.
//
// Security rule enforced everywhere in this file: a request body may
// contain `accessToken`; a response body never does. Grep this file for
// "accessToken" before changing anything -- it should only ever appear on
// the way IN (request.body) or going straight into encrypt()/decrypt(),
// never in a response.json(...) call.

import { Router } from 'express'
import { encrypt, decrypt } from '../lib/crypto.js'
import { syncFromCanvas } from '../lib/canvasSync.js'
import { verifyToken, CanvasAuthError, CanvasApiError } from '../lib/canvasClient.js'
import * as credentialsRepo from '../repos/canvasCredentialsRepo.js'
import * as syncJobsRepo from '../repos/syncJobsRepo.js'

export function syncRouter(pool) {
  const router = Router()

  // Fires the sync without awaiting it, so the HTTP response returns right
  // away instead of however long pulling every course's assignments takes.
  // The frontend polls GET /api/sync/status instead. Errors are swallowed
  // here on purpose -- syncFromCanvas already writes them to
  // sync_jobs.error_message, which is what status polling reads.
  function runDetached(token, triggeredBy) {
    syncFromCanvas(pool, token, { triggeredBy }).catch((error) => {
      console.error(`canvas sync (${triggeredBy}) failed:`, error.message)
    })
  }

  router.post('/connect', async (request, response, next) => {
    const accessToken = typeof request.body?.accessToken === 'string' ? request.body.accessToken.trim() : ''

    if (!accessToken) return response.status(400).json({ error: 'accessToken is required' })

    try {
      // Verify before storing -- a bad token should fail the request
      // immediately with a clear message, not get saved and only discovered
      // broken when the next sync silently fails.
      const user = await verifyToken(accessToken)

      await credentialsRepo.set(pool, { canvasUserName: user.name, encryptedToken: encrypt(accessToken) })

      runDetached(accessToken, 'connect')

      response.status(202).json({ connected: true, syncing: true })
    } catch (error) {
      if (error instanceof CanvasAuthError || error instanceof CanvasApiError) {
        return response.status(400).json({ error: error.message })
      }
      next(error)
    }
  })

  router.delete('/connect', async (request, response, next) => {
    try {
      await credentialsRepo.remove(pool)
      response.status(204).end()
    } catch (error) {
      next(error)
    }
  })

  router.post('/trigger', async (request, response, next) => {
    try {
      const credentials = await credentialsRepo.get(pool)
      if (!credentials) return response.status(400).json({ error: 'Connect your Canvas account first' })

      if (await syncJobsRepo.isAnySyncInProgress(pool)) {
        return response.status(409).json({ error: 'A sync is already running' })
      }

      const token = decrypt(credentials.encrypted_token)
      runDetached(token, 'manual')

      response.status(202).json({ syncing: true })
    } catch (error) {
      next(error)
    }
  })

  router.get('/status', async (request, response, next) => {
    try {
      const credentials = await credentialsRepo.get(pool)
      const latestJob = await syncJobsRepo.getLatest(pool)

      response.json({
        connected: Boolean(credentials),
        canvasUserName: credentials?.canvas_user_name ?? null, // display name only, never the token
        connectedAt: credentials?.connected_at ?? null,
        latestJob: latestJob && {
          id: latestJob.id,
          status: latestJob.status,
          triggeredBy: latestJob.triggered_by,
          startedAt: latestJob.started_at,
          finishedAt: latestJob.finished_at,
          errorMessage: latestJob.error_message,
          subjectsSynced: latestJob.subjects_synced,
          deliverablesSynced: latestJob.deliverables_synced,
          announcementsSynced: latestJob.announcements_synced,
        },
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}
