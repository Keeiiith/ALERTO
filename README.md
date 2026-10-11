# ALERTO — Academic Load, Exam, and Requirement Tracking Organizer

ALERTO helps college students manage academic workload and avoid burnout. It
ingests class announcements, extracts deliverables (assignments, exams, items
to bring), puts them on a calendar, and warns when a day's workload crosses
the student's own capacity threshold.

**Live site:** (fill in once deployed)
**API:** (fill in once deployed) — `/healthz`
**Demo video:** (link)

> **This deployment runs in demo mode by default.** The interface is real; the
> backend is simulated in the browser so the site works without a server. See
> [Demo mode](#demo-mode) below.

## What it does

- Paste a raw class announcement and extract structured deliverables from it
  (exam, assignment, bring-item, or study session)
- See announcements grouped by day, newest first
- See everything due laid out on a calendar, grouped by day — click any
  deliverable for a detail view (type, due date, subject, status, hours), or
  click a day/the full week to see everything scheduled for it in one modal
- See a daily workload projection against a capacity threshold, with risk
  levels (normal / moderate / high / critical)
- Manage enrolled subjects and contact details for alert delivery
- Track dispatched alerts (schedule clashes, capacity strain, exam prep
  reminders) and their delivery channel

## Built with

React and Vite on the front end, Express and PostgreSQL on the back end.

## Demo mode

This repository can run two ways, chosen by one environment variable at
**build** time.

**Demo mode is the default.** Only the exact string `false` turns it off, so a
forgotten or mistyped variable leaves you on the simulated backend with a
visible notice rather than a silently broken build.

| `VITE_USE_MOCK_API` | What happens |
| --- | --- |
| unset, or `true` | The client answers its own requests from `localStorage`, seeded from `client/src/api/seed.json`. No server, no database, nothing shared between visitors. |
| `false` | The client calls the Express API at `VITE_API_BASE_URL`, which reads and writes real PostgreSQL. |

`client/src/api/httpApi.js` maps the server's Postgres rows (snake_case
columns, subjects joined in) into exactly the shape `mockApi.js` returns, so
no page or component needs to know which backend it's talking to.

## Running it yourself

**The client only, in demo mode.** No database needed.

    cd client
    npm install
    cp .env.example .env        # VITE_USE_MOCK_API stays true
    npm run dev                 # http://localhost:5173

**The whole stack.** Needs a PostgreSQL, either local or hosted.

    # 1. the database
    docker run --name alerto-pg -e POSTGRES_PASSWORD=devpassword \
      -e POSTGRES_DB=alerto -p 5432:5432 -d postgres:17

    # 2. the API
    cd server
    npm install
    cp .env.example .env        # check DATABASE_URL
    npm run db:reset            # creates the tables and adds sample rows
    npm run dev                 # http://localhost:3000

    # 3. the client, in another terminal
    cd client
    npm install
    cp .env.example .env
    # set VITE_USE_MOCK_API=false and VITE_API_BASE_URL=http://localhost:3000
    npm run dev

Check the API on its own before you blame the client:

    curl http://localhost:3000/healthz     # is the process alive
    curl http://localhost:3000/readyz      # is the database reachable
    curl http://localhost:3000/api/subjects

## REST API

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/profile` | Current user's contact info and capacity threshold |
| `PUT` | `/api/profile` | Update contact info or max daily capacity |
| `GET` | `/api/subjects` | List enrolled subjects |
| `POST` | `/api/subjects` | Register a new subject |
| `DELETE` | `/api/subjects/:id` | Remove a subject (cascades its announcements/deliverables) |
| `GET` | `/api/announcements` | All ingested announcements, with their extracted deliverables |
| `POST` | `/api/announcements/parse` | Paste `{ subjectId, rawText }`, get back a summary and structured deliverables |
| `GET` | `/api/requirements` | All deliverables, sorted by due date |
| `PUT` | `/api/requirements/:id` | Update a deliverable (e.g. mark done) |
| `GET` | `/api/alerts` | Dispatched alerts, newest first |
| `DELETE` | `/api/alerts/:id` | Dismiss an alert |

`POST /api/announcements/parse` currently runs a **rule-based** extractor
(`server/lib/extractDeliverables.js`), not a real model call — it's a
stand-in so the full round trip works without an API key. The file documents
exactly where to plug in a real OpenAI/Gemini call using `AI_API_KEY`.

## Environment variables

None of these are committed. `.env.example` in each folder lists them with
placeholder values.

| Name | Where | What it is |
| --- | --- | --- |
| `DATABASE_URL` | server | PostgreSQL connection string. Contains a password |
| `CORS_ORIGINS` | server | comma-separated origins allowed to call the API |
| `NODE_ENV` | server | `production` on your host |
| `PORT` | server | **set by the host**, do not set it yourself |
| `AI_API_KEY` | server | optional, not yet read — see `extractDeliverables.js` |
| `VITE_USE_MOCK_API` | client, at build time | only `false` turns demo mode off; unset means on |
| `VITE_API_BASE_URL` | client, at build time | your API's public URL, no trailing slash |

Every `VITE_` value is compiled into the built JavaScript and is **public**.
Never put a key, a password or a connection string in one.

## Deploying

**Client, to GitHub Pages.** Already wired up in
`.github/workflows/deploy-pages.yml`.

1. **Settings > Pages > Build and deployment > Source: GitHub Actions.**
2. Nothing else, until your API is live. Demo mode is the default, so the
   first deploy works on its own. When the API is up, add
   `VITE_USE_MOCK_API` = `false` and `VITE_API_BASE_URL` under
   **Settings > Secrets and variables > Actions > Variables**, then re-run
   the workflow.

**API and database.** Point your host (Render, Railway, Fly.io, ...) at the
`server/` folder, set its environment variables in the dashboard, and run
`server/db/schema.sql` once against the hosted database (`npm run db:schema`
with `DATABASE_URL` pointed at it works too).

## Project structure

    client/          React front end, built by Vite
      src/api/       ONE interface, two implementations, chosen by a variable
      src/components/  Badges, AsyncState, Sidebar, Modal (deliverable/day/week popups)
      src/pages/      Dashboard, Announcements, Calendar, Subjects, Overload Analysis
      src/lib/        workload/risk math, shared data-loading hook
    server/          Express API
      db/            pool, schema.sql, seed.sql, and a runner for them
      repos/          one file per table — all parameterised queries
      lib/            the rule-based announcement extractor
    compose.yml      only if you self-host
    docs/            planning documents and weekly reports

## Architecture

The client talks to one API module (`src/api/index.js`), which picks between
a browser-only mock and the real Express API at build time. The Express API
is a thin layer over five Postgres tables (`profile`, `subjects`,
`announcements`, `deliverables`, `alerts`); announcements and deliverables
are linked by foreign key, so deleting a subject cascades its announcements
and deliverables. Workload risk (normal/moderate/high/critical) is computed
client-side from deliverable due dates and hour estimates against the
profile's capacity threshold — nothing about risk is stored, it's derived
fresh on every load. Calendar's detail/day/week popups reuse one generic
`Modal` component rather than three bespoke dialogs.

## What I would do next

- Replace the rule-based extractor with a real model call (the seam is
  already there in `server/lib/extractDeliverables.js`)
- Wire up the Twilio/Resend alert dispatch the README originally promised —
  alerts are stored and displayed, but nothing sends them yet
- Add authentication; everything right now is single-user (`profile` is a
  singleton row)

## Author

Your name, and a link. Course and section.

## AI use

See [AI-USAGE.md](AI-USAGE.md) for the full account.

![Built with AI assistance](https://img.shields.io/badge/built%20with-AI%20assistance-0b5fff)

## Licence

MIT, see [LICENSE](LICENSE). Put your own name in it.