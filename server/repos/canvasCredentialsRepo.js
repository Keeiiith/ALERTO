// Single-user app: always row id = 1, same pattern as profileRepo. The token
// column holds ciphertext only -- see lib/crypto.js for what encrypts it and
// why the key never lives in this database. canvas_user_name is not secret
// (it's just a display name Canvas gave back when the token was verified).

export async function get(pool) {
  const result = await pool.query('SELECT * FROM canvas_credentials WHERE id = 1')
  return result.rows[0] ?? null
}

export async function set(pool, { canvasUserName, encryptedToken }) {
  const result = await pool.query(
    `INSERT INTO canvas_credentials (id, canvas_user_name, encrypted_token, connected_at)
     VALUES (1, $1, $2, now())
     ON CONFLICT (id) DO UPDATE
       SET canvas_user_name = EXCLUDED.canvas_user_name,
           encrypted_token = EXCLUDED.encrypted_token,
           connected_at = now()
     RETURNING *`,
    [canvasUserName, encryptedToken]
  )
  return result.rows[0]
}

export async function remove(pool) {
  const result = await pool.query('DELETE FROM canvas_credentials WHERE id = 1 RETURNING id')
  return result.rowCount > 0
}
