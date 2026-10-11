// Announcements join their subject and their extracted deliverables, because
// every screen that lists announcements (Announcements Hub) wants both — no
// page does a second round trip just to label a card with its subject code.

export async function getAll(pool) {
  const announcements = await pool.query(
    `SELECT a.*, s.code AS subject_code, s.name AS subject_name, s.color AS subject_color
     FROM announcements a
     JOIN subjects s ON s.id = a.subject_id
     ORDER BY a.received_at DESC`
  )

  const deliverables = await pool.query(
    `SELECT d.*, s.code AS subject_code, s.name AS subject_name, s.color AS subject_color
     FROM deliverables d
     JOIN subjects s ON s.id = d.subject_id
     WHERE d.announcement_id = ANY($1::int[])`,
    [announcements.rows.map((a) => a.id)]
  )

  return announcements.rows.map((a) => ({
    ...a,
    deliverables: deliverables.rows.filter((d) => d.announcement_id === a.id),
  }))
}

export async function create(pool, { subjectId, source, rawText, summary }) {
  const result = await pool.query(
    `INSERT INTO announcements (subject_id, source, raw_text, summary)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [subjectId, source ?? 'Manual Paste', rawText ?? '', summary ?? []]
  )
  return result.rows[0]
}

// Used by Canvas sync: insert this announcement, or update it in place if
// one with this syncKey already exists for the subject. syncKey is a stable
// id derived from the source system (e.g. "canvas-<discussion topic id>"),
// unlike manually-pasted announcements which have no syncKey and are never
// touched by this function.
export async function upsertBySyncKey(pool, { subjectId, source, rawText, summary, syncKey, receivedAt }) {
  const result = await pool.query(
    `INSERT INTO announcements (subject_id, source, raw_text, summary, sync_key, received_at)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()))
     ON CONFLICT (subject_id, sync_key) WHERE sync_key IS NOT NULL DO UPDATE
       SET raw_text = EXCLUDED.raw_text,
           summary = EXCLUDED.summary,
           received_at = EXCLUDED.received_at
     RETURNING *`,
    [subjectId, source ?? 'Canvas LMS Sync', rawText ?? '', summary ?? [], syncKey, receivedAt ?? null]
  )
  return result.rows[0]
}
