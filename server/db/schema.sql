-- The complete shape of the database. Safe to run against an empty database,
-- and safe to run twice.
--
-- This file is committed on purpose. Your schema is a fact about your
-- application, not a runtime concern: it should be readable by opening a file
-- rather than by connecting to a server. It is also what lets you move to a
-- hosted database in one command.

-- Single-user app for now: one settings row, created by the seed. If you add
-- real accounts later, this becomes a users table and every other table gets
-- a user_id foreign key.
CREATE TABLE IF NOT EXISTS profile (
  id                       SMALLINT PRIMARY KEY DEFAULT 1,
  name                     TEXT        NOT NULL DEFAULT '',
  email                    TEXT        NOT NULL DEFAULT '',
  phone                    TEXT        NOT NULL DEFAULT '',
  quiet_hours_start        TEXT        NOT NULL DEFAULT '08:00',
  quiet_hours_end          TEXT        NOT NULL DEFAULT '22:00',
  timezone                 TEXT        NOT NULL DEFAULT 'Asia/Manila',
  max_daily_capacity_hours NUMERIC     NOT NULL DEFAULT 6,
  CONSTRAINT profile_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS subjects (
  id                      SERIAL PRIMARY KEY,
  code                    TEXT        NOT NULL,
  name                    TEXT        NOT NULL,
  instructor              TEXT        NOT NULL DEFAULT '',
  department              TEXT        NOT NULL DEFAULT '',
  units                   NUMERIC     NOT NULL DEFAULT 3,
  schedule                TEXT        NOT NULL DEFAULT '',
  location                TEXT        NOT NULL DEFAULT '',
  feed_url                TEXT        NOT NULL DEFAULT '',
  feed_source             TEXT        NOT NULL DEFAULT 'Manual Entry',
  sync_status             TEXT        NOT NULL DEFAULT 'connected',
  last_synced_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  color                   TEXT        NOT NULL DEFAULT 'teal',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Needed so Canvas sync can upsert "the subject with this code" instead of
-- creating a duplicate CS301 every time it re-syncs. A manually-added
-- subject whose code happens to collide with a later Canvas sync gets
-- overwritten by Canvas's version -- documented, not silent, in
-- lib/canvasSync.js.
CREATE UNIQUE INDEX IF NOT EXISTS subjects_code_idx ON subjects (code);

CREATE TABLE IF NOT EXISTS announcements (
  id          SERIAL PRIMARY KEY,
  subject_id  INTEGER     NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source      TEXT        NOT NULL DEFAULT 'Manual Paste',
  raw_text    TEXT        NOT NULL DEFAULT '',
  summary     TEXT[]      NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS announcements_received_at_idx
  ON announcements (received_at DESC);

CREATE TABLE IF NOT EXISTS deliverables (
  id              SERIAL PRIMARY KEY,
  subject_id      INTEGER     NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  announcement_id INTEGER     REFERENCES announcements(id) ON DELETE SET NULL,
  type            TEXT        NOT NULL CHECK (type IN ('EXAM', 'ASSIGNMENT', 'BRING_ITEM', 'STUDY_SESSION')),
  title           TEXT        NOT NULL,
  due_at          TIMESTAMPTZ NOT NULL,
  location        TEXT        NOT NULL DEFAULT '',
  hours_estimate  NUMERIC     NOT NULL DEFAULT 0,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done'))
);

-- The calendar, dashboard and overload pages all sort or group by due date.
CREATE INDEX IF NOT EXISTS deliverables_due_at_idx
  ON deliverables (due_at);

CREATE TABLE IF NOT EXISTS alerts (
  id          SERIAL PRIMARY KEY,
  severity    TEXT        NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MODERATE', 'LOW')),
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  context     TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  channels    TEXT[]      NOT NULL DEFAULT '{}',
  status      TEXT        NOT NULL DEFAULT 'Delivered'
);

CREATE INDEX IF NOT EXISTS alerts_created_at_idx
  ON alerts (created_at DESC);

-- ---------------------------------------------------------------------------
-- Canvas LMS sync
-- ---------------------------------------------------------------------------

-- Superseded the original HAU-portal-scraper design once it turned out
-- HAU's "student portal" is just standard Canvas (hau.instructure.com) --
-- which has a real API, so there's no password to store anymore, just a
-- revocable personal access token. Drop the old table outright: it held an
-- encrypted password for a mechanism (Playwright scraping) this app no
-- longer uses, and the earlier CS301-style sample data is development
-- throwaway, not anything worth migrating.
DROP TABLE IF EXISTS portal_credentials;

-- The token never lives here in plain text. encrypted_token is AES-256-GCM
-- ciphertext (iv:authTag:ciphertext, base64) produced by lib/crypto.js. The
-- decryption key lives only in the server's CREDENTIAL_ENCRYPTION_KEY env
-- var -- never in this database, never committed, never sent back to the
-- browser. See docs/07-canvas-sync.md.
CREATE TABLE IF NOT EXISTS canvas_credentials (
  id                SMALLINT    PRIMARY KEY DEFAULT 1,
  canvas_user_name  TEXT        NOT NULL,
  encrypted_token   TEXT        NOT NULL,
  connected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT canvas_credentials_singleton CHECK (id = 1)
);

-- One row per sync attempt (manual click, cron tick, or right after
-- connecting). The frontend polls GET /api/sync/status, which reads the
-- most recent row here, instead of blocking on the sync itself.
CREATE TABLE IF NOT EXISTS sync_jobs (
  id                   SERIAL      PRIMARY KEY,
  status               TEXT        NOT NULL DEFAULT 'queued'
                         CHECK (status IN ('queued', 'running', 'success', 'failed')),
  triggered_by         TEXT        NOT NULL DEFAULT 'manual'
                         CHECK (triggered_by IN ('manual', 'cron', 'connect')),
  started_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at          TIMESTAMPTZ,
  error_message        TEXT,
  subjects_synced      INTEGER     NOT NULL DEFAULT 0,
  deliverables_synced  INTEGER     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS sync_jobs_started_at_idx
  ON sync_jobs (started_at DESC);

ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS announcements_synced INTEGER NOT NULL DEFAULT 0;

-- Replaces the old portal_key column (which had to build its own dedup key
-- out of title + due date, since a scraped page has no stable id). Canvas
-- assignment ids are already stable and unique, so lib/canvasSync.js just
-- uses "canvas-<assignment id>" here directly -- simpler and more reliable.
ALTER TABLE deliverables DROP COLUMN IF EXISTS portal_key;
ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS sync_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS deliverables_sync_key_idx
  ON deliverables (subject_id, sync_key)
  WHERE sync_key IS NOT NULL;

-- Same dedup pattern for Canvas announcements -- "canvas-<discussion topic
-- id>" in lib/canvasSync.js, so re-syncing updates an existing announcement
-- in place instead of creating a duplicate every time.
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS sync_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS announcements_sync_key_idx
  ON announcements (subject_id, sync_key)
  WHERE sync_key IS NOT NULL;
