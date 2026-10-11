// A log of every Canvas sync attempt. GET /api/sync/status reads the latest
// row here -- that's how the frontend knows a sync is running without
// blocking on it (see lib/canvasSync.js for why the sync itself runs
// detached from the request/response cycle).

export async function create(pool, triggeredBy) {
  const result = await pool.query(
    `INSERT INTO sync_jobs (status, triggered_by, started_at) VALUES ('queued', $1, now()) RETURNING *`,
    [triggeredBy]
  )
  return result.rows[0]
}

export async function markRunning(pool, id) {
  await pool.query(`UPDATE sync_jobs SET status = 'running' WHERE id = $1`, [id])
}

export async function markSuccess(pool, id, { subjectsSynced, deliverablesSynced, announcementsSynced = 0 }) {
  await pool.query(
    `UPDATE sync_jobs
     SET status = 'success', finished_at = now(), subjects_synced = $2, deliverables_synced = $3, announcements_synced = $4
     WHERE id = $1`,
    [id, subjectsSynced, deliverablesSynced, announcementsSynced]
  )
}

export async function markFailed(pool, id, errorMessage) {
  await pool.query(
    `UPDATE sync_jobs SET status = 'failed', finished_at = now(), error_message = $2 WHERE id = $1`,
    [id, errorMessage.slice(0, 500)] // don't let a huge stack trace bloat the row
  )
}

export async function getLatest(pool) {
  const result = await pool.query('SELECT * FROM sync_jobs ORDER BY started_at DESC LIMIT 1')
  return result.rows[0] ?? null
}

// Used by the /trigger route to refuse a second sync while one is already
// in flight, instead of racing two overlapping Canvas syncs against the
// same account.
export async function isAnySyncInProgress(pool) {
  const result = await pool.query(`SELECT 1 FROM sync_jobs WHERE status IN ('queued', 'running') LIMIT 1`)
  return result.rowCount > 0
}
