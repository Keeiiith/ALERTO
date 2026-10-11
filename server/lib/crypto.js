// AES-256-GCM encrypt/decrypt for the one secret this app stores: the
// Canvas access token. GCM is an *authenticated* cipher -- decrypt() throws
// if the ciphertext was tampered with or truncated, instead of silently
// returning garbage.
//
// The key itself NEVER touches the database. It lives only in the
// CREDENTIAL_ENCRYPTION_KEY env var, set on whatever host runs this server
// (Render/Railway's dashboard, not Supabase -- Supabase stores the
// *encrypted* column, never the key that unlocks it). Generate one with:
//
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
//
// Losing this key means every stored token becomes permanently
// undecryptable -- that's the correct failure mode (the alternative is a key
// weak enough to not matter), but it means rotating it requires every user
// to reconnect their Canvas account.

import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits, the size GCM is designed for

function loadKey() {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      'CREDENTIAL_ENCRYPTION_KEY is not set. Generate one with: ' +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    )
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes (use the generator command above)')
  }
  return key
}

// Returns a single string: "iv:authTag:ciphertext", each base64. Safe to
// store directly in a TEXT column.
export function encrypt(plaintext) {
  const key = loadKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [iv, authTag, ciphertext].map((buf) => buf.toString('base64')).join(':')
}

export function decrypt(payload) {
  const key = loadKey()
  const [ivB64, authTagB64, ciphertextB64] = payload.split(':')
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Malformed encrypted payload (expected "iv:authTag:ciphertext")')
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'))

  // Throws here if the ciphertext was altered or the key is wrong -- this is
  // GCM's authentication check, not a bug to catch and ignore.
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()])
  return plaintext.toString('utf8')
}
