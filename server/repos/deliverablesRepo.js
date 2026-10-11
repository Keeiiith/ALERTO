export async function getAll(pool) {
  const result = await pool.query(
    `SELECT d.*, s.code AS subject_code, s.name AS subject_name, s.color AS subject_color
     FROM deliverables d
     JOIN subjects s ON s.id = d.subject_id
     ORDER BY d.due_at ASC`
  )
  return result.rows
}

export async function createMany(pool, subjectId, announcementId, items) {
  if (items.length === 0) return []

  const rows = []
  for (const item of items) {
    const result = await pool.query(
      `INSERT INTO deliverables (subject_id, announcement_id, type, title, due_at, location, hours_estimate, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [subjectId, announcementId, item.type, item.title, item.dueAt, item.location ?? '', item.hoursEstimate ?? 0]
    )
    rows.push(result.rows[0])
  }
  return rows
}

export async function update(pool, id, { status, title, dueAt, location, hoursEstimate }) {
  const columns = {
    status,
    title,
    due_at: dueAt,
    location,
    hours_estimate: hoursEstimate,
  }
  const entries = Object.entries(columns).filter(([, value]) => value !== undefined)
  if (entries.length === 0) {
    const current = await pool.query('SELECT * FROM deliverables WHERE id = $1', [id])
    return current.rows[0] ?? null
  }

  const setClause = entries.map(([column], i) => `${column} = $${i + 1}`).join(', ')
  const values = entries.map(([, value]) => value)

  const result = await pool.query(
    `UPDATE deliverables SET ${setClause} WHERE id = $${entries.length + 1} RETURNING *`,
    [...values, id]
  )
  return result.rows[0] ?? null
}
