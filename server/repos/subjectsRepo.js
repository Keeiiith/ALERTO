export async function getAll(pool) {
  const result = await pool.query('SELECT * FROM subjects ORDER BY code ASC')
  return result.rows
}

export async function getById(pool, id) {
  const result = await pool.query('SELECT * FROM subjects WHERE id = $1', [id])
  return result.rows[0] ?? null
}

export async function create(pool, input) {
  const result = await pool.query(
    `INSERT INTO subjects (code, name, instructor, department, units, schedule, location, feed_url, feed_source, color)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      input.code,
      input.name,
      input.instructor ?? '',
      input.department ?? '',
      input.units ?? 3,
      input.schedule ?? '',
      input.location ?? '',
      input.feedUrl ?? '',
      input.feedSource ?? 'Manual Entry',
      input.color ?? 'teal',
    ]
  )
  return result.rows[0]
}

export async function remove(pool, id) {
  const result = await pool.query('DELETE FROM subjects WHERE id = $1 RETURNING id', [id])
  return result.rowCount > 0
}

// Used by Canvas sync: insert this subject, or update it in place if a
// subject with this code already exists. Relies on the unique index on
// `code` in db/schema.sql.
export async function upsertByCode(pool, input) {
  const result = await pool.query(
    `INSERT INTO subjects (code, name, instructor, department, units, schedule, location, feed_source, sync_status, last_synced_at, color)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'connected', now(), $9)
     ON CONFLICT (code) DO UPDATE
       SET name = EXCLUDED.name,
           instructor = EXCLUDED.instructor,
           department = EXCLUDED.department,
           units = EXCLUDED.units,
           schedule = EXCLUDED.schedule,
           location = EXCLUDED.location,
           feed_source = EXCLUDED.feed_source,
           sync_status = 'connected',
           last_synced_at = now()
     RETURNING *`,
    [
      input.code,
      input.name,
      input.instructor ?? '',
      input.department ?? '',
      input.units ?? 3,
      input.schedule ?? '',
      input.location ?? '',
      input.feedSource ?? 'Canvas LMS Sync',
      input.color ?? 'teal',
    ]
  )
  return result.rows[0]
}

export async function getByCode(pool, code) {
  const result = await pool.query('SELECT * FROM subjects WHERE code = $1', [code])
  return result.rows[0] ?? null
}
