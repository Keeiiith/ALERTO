// Single-user app: always row id = 1. See db/schema.sql for why.

export async function get(pool) {
  const result = await pool.query('SELECT * FROM profile WHERE id = 1')
  return result.rows[0] ?? null
}

export async function update(pool, fields) {
  // Only touch columns that were actually sent, so a partial PUT (just the
  // phone number, say) doesn't blank out everything else.
  const columns = {
    name: fields.name,
    email: fields.email,
    phone: fields.phone,
    quiet_hours_start: fields.quietHoursStart,
    quiet_hours_end: fields.quietHoursEnd,
    timezone: fields.timezone,
    max_daily_capacity_hours: fields.maxDailyCapacityHours,
  }

  const entries = Object.entries(columns).filter(([, value]) => value !== undefined)
  if (entries.length === 0) return get(pool)

  const setClause = entries.map(([column], i) => `${column} = $${i + 1}`).join(', ')
  const values = entries.map(([, value]) => value)

  const result = await pool.query(
    `UPDATE profile SET ${setClause} WHERE id = 1 RETURNING *`,
    values
  )
  return result.rows[0]
}
