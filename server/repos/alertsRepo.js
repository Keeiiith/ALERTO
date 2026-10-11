export async function getAll(pool) {
  const result = await pool.query('SELECT * FROM alerts ORDER BY created_at DESC')
  return result.rows
}

export async function remove(pool, id) {
  const result = await pool.query('DELETE FROM alerts WHERE id = $1 RETURNING id', [id])
  return result.rowCount > 0
}
