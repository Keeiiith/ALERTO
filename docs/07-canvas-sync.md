# Canvas LMS sync

How ALERTO automatically pulls subjects and deliverables from Canvas, instead
of requiring manual entry.

## Why this isn't a custom HAU integration

HAU's "student portal" (`hau.instructure.com`) is standard **Canvas LMS**.
Instructure is the company that makes Canvas, and a large number of schools
run on it. That means there's no need to scrape a login form with a headless
browser and hope the page HTML never changes -- Canvas has a real,
documented, officially-supported REST API built for exactly this.

An earlier version of this feature drove Playwright against the portal
directly. That approach is gone: it was solving a problem (no API) that
doesn't actually exist here, and it required storing the student's real
account password. The Canvas API needs none of that.

## What gets stored, and how

| Data | Where | Protection |
| --- | --- | --- |
| Canvas access token | `canvas_credentials.encrypted_token` | AES-256-GCM ciphertext. The decryption key lives only in `CREDENTIAL_ENCRYPTION_KEY`, an env var on the server host -- never in Supabase, never committed, never sent to the browser |
| Canvas display name | `canvas_credentials.canvas_user_name` | Plain text -- not secret, just shown in the UI as "Synced as ..." |
| Sync history | `sync_jobs` | One row per attempt: status, timing, error message, counts. No credentials in this table |
| Synced data | `subjects`, `deliverables` | Same tables manual entry uses -- `feed_source` says where a row came from |

Unlike a password, an access token can be revoked from Canvas at any time
without changing your account password, and it only grants API access --
never full account control the way a password would.

## Setting it up

1. Generate an encryption key and put it in `server/.env` (and in your
   deploy host's dashboard, once you deploy):
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
2. Confirm `CANVAS_BASE_URL` in `server/.env` matches your school's real
   Canvas domain (for HAU: `https://hau.instructure.com`).
3. **Generate your own access token** (this is the one step only you can do,
   since it has to come from your logged-in account):
   - Log into Canvas (`hau.instructure.com`) in a browser.
   - Click **Account** (your profile picture, usually top-left) → **Settings**.
   - Scroll down to **Approved Integrations**.
   - Click **+ New Access Token**.
   - Give it a purpose like "ALERTO sync" and an expiration date if you want
     one (leaving it blank means it doesn't expire until you manually
     revoke it).
   - Click **Generate Token**. Canvas shows it to you **exactly once** --
     copy it immediately, you cannot view it again after leaving the page
     (you'd have to generate a new one).
4. In the app's Subjects page, paste that token into the "Connect Canvas"
   card and submit. The server verifies it against `/api/v1/users/self`
   before storing it, so a bad paste fails immediately with a clear error
   instead of silently storing something broken.
5. `GET /api/sync/status` (or just watch the Subjects page) to see the first
   sync finish -- it runs in the background, not inside the connect request.

## Revoking access

Go back to **Account → Settings → Approved Integrations** in Canvas and
delete the token. The app's stored copy becomes useless immediately (Canvas
rejects it with a 401), and the next sync attempt will show as failed until
you disconnect and reconnect with a fresh token.

## What gets synced, and what doesn't

- **Subjects**: every course with an active (non-concluded) enrollment,
  keyed by `course_code`. Instructor and schedule aren't reliably available
  from the courses list endpoint without an extra API call per course, so
  those fields stay blank after a Canvas sync -- edit them manually if you
  want them filled in.
- **Deliverables**: each course's *upcoming* assignments with a due date.
  Past-due assignments and assignments with no due date are skipped --
  there's nothing useful to put on a deadline tracker for either.
- **Type guessing**: Canvas doesn't categorize assignments as exam vs.
  homework for this app's purposes, so `EXAM` vs. `ASSIGNMENT` is guessed
  from the title (looking for "exam", "quiz", "midterm", "final"). Wrong
  guesses are a one-click fix in the UI, not a reason to build something
  more elaborate.
- **Re-syncing**: safe to run as often as you want. Each Canvas assignment
  has a stable numeric id, which `lib/canvasSync.js` uses directly as the
  dedup key (`canvas-<assignment id>`) -- re-syncing updates the existing
  row in place instead of creating duplicates, which was a real risk with
  the old scraper's derived-from-title-and-date keys.
