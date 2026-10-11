// Runs one full sync: pull the student's active courses and their upcoming
// assignment due dates from Canvas, and upsert them into subjects/
// deliverables. Mirrors the shape the manual-entry and announcement-parse
// paths already write, so the rest of the app (Dashboard, Calendar, Overload
// Analysis) doesn't need to know where a row came from.

import * as syncJobsRepo from '../repos/syncJobsRepo.js'
import * as subjectsRepo from '../repos/subjectsRepo.js'
import * as announcementsRepo from '../repos/announcementsRepo.js'
import { fetchCourses, fetchUpcomingAssignments, fetchAnnouncements } from './canvasClient.js'

// Canvas announcement bodies are HTML. Nothing in this app renders HTML, so
// strip tags down to plain text for the summary line instead of dumping
// markup into the UI. Good enough for a readable preview -- not meant to be
// a faithful HTML-to-text converter.
function stripHtml(html) {
  return html
    .replace(/<\/p>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

// Canvas doesn't categorize assignments as exam/quiz/homework for us, so
// this is a best-effort guess from the title. Wrong guesses are cheap to fix
// -- the user can re-type the deliverable in the UI -- so this stays simple
// rather than trying to be clever.
function guessType(name) {
  const lower = name.toLowerCase()
  if (lower.includes('exam') || lower.includes('quiz') || lower.includes('final') || lower.includes('midterm')) {
    return 'EXAM'
  }
  return 'ASSIGNMENT'
}

export async function syncFromCanvas(pool, token, { triggeredBy }) {
  const job = await syncJobsRepo.create(pool, triggeredBy)
  await syncJobsRepo.markRunning(pool, job.id)

  try {
    const courses = await fetchCourses(token)
    let subjectsSynced = 0
    let deliverablesSynced = 0
    let announcementsSynced = 0

    for (const course of courses) {
      // Canvas returns a stub object (no name, most fields missing) for a
      // course you're enrolled in but can't currently access -- e.g. it's
      // unpublished, or date-restricted and not open yet. Nothing useful to
      // sync for those, so skip rather than create a garbage subject row.
      if (course.access_restricted_by_date || !course.name) continue

      const subject = await subjectsRepo.upsertByCode(pool, {
        code: course.course_code || `CANVAS-${course.id}`,
        name: course.name,
        instructor: '', // not reliably available from /courses without an extra call per course
        department: course.term?.name ?? '',
        units: 3,
        schedule: '',
        location: '',
        feedSource: 'Canvas LMS Sync',
        color: 'violet',
      })
      subjectsSynced++

      const assignments = await fetchUpcomingAssignments(token, course.id)

      for (const assignment of assignments) {
        if (!assignment.due_at) continue // no due date -- nothing to put on the calendar

        // Canvas assignment ids are stable and unique, unlike anything we'd
        // have to derive ourselves from a scraped page -- this is the exact
        // fragility problem the portal scraper had, solved for free here.
        await pool.query(
          `INSERT INTO deliverables (subject_id, type, title, due_at, hours_estimate, status, sync_key)
           VALUES ($1, $2, $3, $4, 0, 'pending', $5)
           ON CONFLICT (subject_id, sync_key) WHERE sync_key IS NOT NULL DO UPDATE
             SET title = EXCLUDED.title,
                 due_at = EXCLUDED.due_at,
                 type = EXCLUDED.type`,
          [subject.id, guessType(assignment.name), assignment.name, assignment.due_at, `canvas-${assignment.id}`]
        )
        deliverablesSynced++
      }

      const announcements = await fetchAnnouncements(token, course.id)

      for (const topic of announcements) {
        const messageText = topic.message ? stripHtml(topic.message) : ''
        await announcementsRepo.upsertBySyncKey(pool, {
          subjectId: subject.id,
          source: 'Canvas LMS Sync',
          rawText: messageText,
          // One summary line per announcement, same shape the manual
          // paste-and-extract flow produces -- truncated so one very long
          // announcement doesn't blow out the card in the Announcements Hub.
          summary: [messageText.slice(0, 280) || topic.title],
          syncKey: `canvas-${topic.id}`,
          receivedAt: topic.posted_at,
        })
        announcementsSynced++
      }
    }

    await syncJobsRepo.markSuccess(pool, job.id, { subjectsSynced, deliverablesSynced, announcementsSynced })
  } catch (error) {
    await syncJobsRepo.markFailed(pool, job.id, error.message)
    throw error
  }
}
