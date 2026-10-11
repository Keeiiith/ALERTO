-- Minimal seed: just the one profile row every page needs, with everything
-- else left empty. Subjects, deliverables and announcements are meant to
-- come from Canvas sync (or manual entry) against a real account, not from
-- sample rows -- those made it hard to tell what a sync actually produced.
-- Demo/mock mode (client/src/api/seed.json) is separate and keeps its own
-- sample data, since that path has no real backend to populate it from.
--
-- This starts with TRUNCATE. That is correct on your laptop and catastrophic
-- against the database your live demo depends on. Check which DATABASE_URL is
-- loaded before you run it.

TRUNCATE TABLE alerts, deliverables, announcements, subjects, profile RESTART IDENTITY CASCADE;

INSERT INTO profile (id, name, email, phone, quiet_hours_start, quiet_hours_end, timezone, max_daily_capacity_hours)
VALUES (1, 'Helo', 'helo@hau.edu.ph', '+63 917 000 0000', '08:00', '22:00', 'Asia/Manila', 6);
