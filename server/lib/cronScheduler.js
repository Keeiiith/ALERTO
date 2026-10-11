// Periodic background sync. No Redis/BullMQ here on purpose -- node-cron
// runs in the same process as the Express server, which is enough at this
// project's scale (one user, a sync every few hours) and avoids needing a
// second piece of infrastructure. If this ever needs to run syncs for many
// users concurrently without them queueing behind each other, that's the
// point to introduce BullMQ + Redis -- not before.
//
// Requires a long-running Node process (Render/Railway/Fly/a VPS). A
// serverless host (Vercel functions, etc.) spins the process down between
// requests, so this scheduled job would simply never fire there.

import cron from 'node-cron'
import { pool } from '../db/pool.js'
import { decrypt } from './crypto.js'
import { syncFromCanvas } from './canvasSync.js'
import * as credentialsRepo from '../repos/canvasCredentialsRepo.js'
import * as syncJobsRepo from '../repos/syncJobsRepo.js'

export function startScheduledSync() {
  const schedule = process.env.SYNC_CRON_SCHEDULE || '0 */6 * * *' // every 6 hours by default

  if (!cron.validate(schedule)) {
    console.error(`SYNC_CRON_SCHEDULE "${schedule}" is not a valid cron expression -- scheduled sync disabled`)
    return
  }

  cron.schedule(schedule, async () => {
    const credentials = await credentialsRepo.get(pool)
    if (!credentials) return // nobody has connected a Canvas account yet

    if (await syncJobsRepo.isAnySyncInProgress(pool)) {
      console.log('scheduled canvas sync skipped: a sync is already in progress')
      return
    }

    try {
      const token = decrypt(credentials.encrypted_token)
      await syncFromCanvas(pool, token, { triggeredBy: 'cron' })
    } catch (error) {
      // Already recorded in sync_jobs by syncFromCanvas; log here too since
      // a cron failure has no HTTP response to surface it through.
      console.error('scheduled canvas sync failed:', error.message)
    }
  })

  console.log(`Scheduled Canvas sync registered: "${schedule}"`)
}
