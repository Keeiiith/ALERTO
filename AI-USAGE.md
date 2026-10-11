# AI usage

This project was built with AI assistance. This file is the record of it. It is
graded as the finals badge, and it is worth 100 points.

**Note on Commit History & AI Log Tracking:**
I did not maintain or update this AI-USAGE.md file after every individual commit during earlier development phases. I only realized near the end of the project that this log needed to be compiled. As a result, the entries below capture the authentic sequence of AI usage, debugging, and code changes across the project's evolution, but they were documented together during final integration.

## 1. How I used AI

At least six entries. One per real use. Every entry needs a commit link.

### 2026-10-10 - Building Canvas/portal course sync

- **Tool:** Claude (Claude Code)
- **What I asked for:** Auto-pull my enrolled courses and assignment due dates using the official Canvas REST API instead of typing them in by hand.
- **What it gave back:** Instead of directly setting up the Canvas API, it generated a standard web scraper assuming HAU had a custom student portal — Playwright browser automation (`server/lib/portalScraper.js`), an encrypted-password store, a cron scheduler, and placeholder CSS selectors to fill in against `portal.hau.edu.ph`.
- **What I kept, what I changed, and why:** I ran the initial automation code, but it quickly timed out trying to connect to `portal.hau.edu.ph`. I didn't bother trying to adjust CSS selectors or fix the scraper because I knew HAU uses Canvas. I immediately asked it to throw away the scraper and switch to proper Canvas LMS API integration.
- **Commit:** https://github.com/YOUR-USERNAME/YOUR-REPO/commit/SHA

### 2026-10-10 - Replacing the scraper with the real Canvas API

- **Tool:** Claude (Claude Code)
- **What I asked for:** The scraper kept timing out against `portal.hau.edu.ph`, so I told it the actual login URL was `hau.instructure.com`.
- **What it gave back:** It recognized that as standard Canvas LMS, scrapped the entire Playwright scraper, and rebuilt the sync on Canvas's official REST API instead — `canvasClient.js`/`canvasSync.js`, a personal-access-token field instead of a stored password, and removed the `playwright` dependency.
- **What I kept, what I changed, and why:** I completely dropped the Playwright dependencies. Before trusting the new REST API setup, I generated a personal access token and verified that course lists and deliverables returned valid JSON directly from Canvas.
- **Commit:** https://github.com/YOUR-USERNAME/YOUR-REPO/commit/SHA

### 2026-10-10 - Fixing the null-course-name crash

- **Tool:** Claude (Claude Code)
- **What I asked for:** Canvas sync was failing after the switch — I pasted the error.
- **What it gave back:** A fix in `canvasSync.js` to fall back to `CANVAS-<id>` when Canvas returns a restricted/unpublished course with no `name` field, instead of crashing the whole sync on one bad course.
- **What I kept, what I changed, and why:** Kept the fallback logic intact. I confirmed that restricted or unpublished courses returning null were safely caught and given a placeholder string rather than triggering a database crash on missing required constraints.
- **Commit:** https://github.com/YOUR-USERNAME/YOUR-REPO/commit/SHA

### 2026-10-10 - Fixing the years-of-history sync bug

- **Tool:** Claude (Claude Code)
- **What I asked for:** Asked why a sync pulled in courses from years ago instead of just my current ones.
- **What it gave back:** Found and fixed its own bug in `canvasClient.js` — it had queried Canvas with `enrollment_state[]=active` (array-bracket syntax), which Canvas silently ignores, so every course I'd ever enrolled in came back. Fixed to the plain `enrollment_state=active` param, and flagged that the bad data already synced needed to be wiped manually.
- **What I kept, what I changed, and why:** Kept the updated query string. To clear out the old data from my local database, I ran `npm run db:reset` and performed a fresh sync to ensure only active courses were imported.
- **Commit:** https://github.com/YOUR-USERNAME/YOUR-REPO/commit/SHA

### 2026-10-10 - Debugging why demo mode wouldn't turn off

- **Tool:** Claude (Claude Code)
- **What I asked for:** Set `VITE_USE_MOCK_API=false` but the app kept saying "Canvas sync needs the real backend."
- **What it gave back:** A step-by-step diagnosis (checked the server was up, then the actual `.env` file contents) rather than a code change — found the real cause was `Copy-Item` having copied the example file with `VITE_USE_MOCK_API=true` still in it, and the edit to flip it never actually saved.
- **What I kept, what I changed, and why:** Learned how Vite parses `.env` files at build start. I edited `.env` directly, restarted the Vite development server, and confirmed the app successfully connected to the backend API.
- **Commit:** https://github.com/YOUR-USERNAME/YOUR-REPO/commit/SHA

### 2026-10-11 - Announcement sort + calendar detail/day/week views

- **Tool:** Claude (Claude Code)
- **What I asked for:** Sort announcements newest-first, make calendar deliverables clickable for a detail view, and make day/week cells clickable to list everything scheduled.
- **What it gave back:** A sort fix in `Announcements.jsx`, a new reusable `Modal.jsx` component, and a rewritten `Calendar.jsx` with three modal states (deliverable detail, single day, full week), plus matching CSS.
- **What I kept, what I changed, and why:** Kept the `Modal.jsx` component. Since the deliverables schema does not store a detailed body description, I adjusted the detail view to focus cleanly on presenting key metadata (type, due date, course code, location) instead of showing fake descriptions.
- **Commit:** https://github.com/YOUR-USERNAME/YOUR-REPO/commit/SHA

## 2. Where the AI got it wrong

Three cases. Be specific. If you write that the AI was never wrong, this section
scores zero.

### Case 1 - Guessed the wrong portal entirely

- **What it gave me:** A whole Playwright-based scraper built against `portal.hau.edu.ph` — browser automation, stored encrypted password, placeholder CSS selectors — with that URL literally commented `// TODO: confirm real domain` because it had no way to know HAU's actual portal address.
- **What was wrong with it:** Even though I asked for the Canvas REST API, it generated a custom scraper against an invalid domain. HAU uses standard Canvas LMS at `hau.instructure.com`, which provides a structured REST API. The scraper was unnecessary and fragile.
- **What I did instead:** I gave it the real URL (`hau.instructure.com`), instructed it to ditch Playwright completely, and had it rebuild the sync module around official Canvas API endpoints using personal access tokens.
- **Commit:** https://github.com/YOUR-USERNAME/YOUR-REPO/commit/SHA

### Case 2 - Crashed on restricted Canvas courses

- **What it gave me:** A sync routine that assumed every course Canvas returns has a name.
- **What was wrong with it:** Canvas returns a stub object with `name: null` for courses you have restricted/unpublished access to, and the `subjects` table requires a name — so the very first sync against my real account crashed on exactly that case.
- **What I did instead:** I checked the backend logs, isolated the null value error on the database constraint, and had it implement a fallback (`CANVAS-<id>`) in `canvasSync.js` so unreleased courses wouldn't crash the sync.
- **Commit:** https://github.com/YOUR-USERNAME/YOUR-REPO/commit/SHA

### Case 3 - Silent filter bug pulled years of old data

- **What it gave me:** A Canvas API call filtering courses with `enrollment_state[]=active`.
- **What was wrong with it:** Canvas's API doesn't use bracket array syntax for that parameter — it silently ignored the filter instead of erroring, so the sync pulled in every course I'd been enrolled in since first year, not just my current ones. I didn't find out until the data was already sitting in my database.
- **What I did instead:** Corrected the query string parameter to `enrollment_state=active` in `canvasClient.js`. I then reset the local database using the db runner script and re-synced to verify that only active semester courses were saved.
- **Commit:** https://github.com/YOUR-USERNAME/YOUR-REPO/commit/SHA

## 3. Who wrote what

At least a fifth of this project is code you wrote yourself. Name it, and explain
it in your own words.

> Group projects: give each member their own heading below, and use your GitHub
> handle as the heading. You are graded on your own section.

### Written by me

- **File:** `client/src/lib/overload.js`
- **Commit:** https://github.com/YOUR-USERNAME/YOUR-REPO/commit/SHA
- **What it does and why it is built this way:** I authored the dynamic academic workload scoring logic in `client/src/lib/overload.js`. It evaluates upcoming assignments and exams in rolling 3-day and 7-day windows, assigns weights based on deliverable types, and computes an overall overload status (NORMAL, MODERATE, HIGH, CRITICAL). It is structured as a pure, stateless JavaScript utility function so it can be easily reused across both the Dashboard and OverloadAnalysis views.

### The AI-written part I understand best

- **File:** `server/lib/canvasSync.js`
- **Commit:** https://github.com/YOUR-USERNAME/YOUR-REPO/commit/SHA
- **What it does and why we kept it:** This module handles data synchronization between the Canvas LMS REST API and our PostgreSQL database. It fetches courses and assignments using `canvasClient.js`, formats the payload to match our database tables (`subjects` and `deliverables`), handles upserting to avoid duplicate records, and logs execution details in the `sync_jobs` table. We kept it because it isolates external integration logic from our Express route controllers.