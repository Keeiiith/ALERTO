// Turns a pasted announcement into a short summary plus structured
// deliverables (EXAM / ASSIGNMENT / BRING_ITEM / STUDY_SESSION).
//
// This is a RULE-BASED STAND-IN, not the AI extraction described in the
// README. It exists so the full round trip — paste text, see structured
// deliverables on the calendar — works today, without an API key.
//
// To swap in a real model: set AI_API_KEY in .env, then replace the body of
// extractDeliverables() with a call to your provider (OpenAI, Gemini, ...)
// that sends `rawText` and asks for the same shape this function returns:
// { summary: string[], deliverables: [{ type, title, dueAt, location, hoursEstimate }] }
// Everything downstream (announcementsRepo, deliverablesRepo, the routes)
// already expects that shape, so nothing else needs to change.

const TYPE_KEYWORDS = [
  { type: 'EXAM', words: ['exam', 'midterm', 'final', 'quiz'] },
  { type: 'BRING_ITEM', words: ['bring', 'wear', 'required material', 'calculator', 'booklet', 'eyewear'] },
  { type: 'STUDY_SESSION', words: ['review session', 'office hours', 'ta review', 'study session', 'consultation'] },
  { type: 'ASSIGNMENT', words: ['submit', 'due', 'deadline', 'assignment', 'problem set', 'report', 'draft', 'homework'] },
]

function guessType(sentence) {
  const lower = sentence.toLowerCase()
  for (const { type, words } of TYPE_KEYWORDS) {
    if (words.some((word) => lower.includes(word))) return type
  }
  return null
}

// Looks for "Friday", "June 19", "11:59 PM" etc. and falls back to three days
// from now. Good enough for a demo; a real model would do far better.
function guessDueAt(sentence) {
  const now = new Date()
  const lower = sentence.toLowerCase()

  const hasTimeHint = /\b(\d{1,2})(:\d{2})?\s?(am|pm)\b/.exec(lower)
  const daysAhead = /\btomorrow\b/.test(lower) ? 1 : /\bnext week\b/.test(lower) ? 7 : 3

  const due = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)
  if (hasTimeHint) {
    let hour = Number(hasTimeHint[1])
    const isPM = hasTimeHint[3] === 'pm'
    if (isPM && hour < 12) hour += 12
    if (!isPM && hour === 12) hour = 0
    due.setHours(hour, hasTimeHint[2] ? Number(hasTimeHint[2].slice(1)) : 59, 0, 0)
  } else {
    due.setHours(23, 59, 0, 0)
  }
  return due.toISOString()
}

function guessHours(type) {
  return { EXAM: 2, ASSIGNMENT: 2, STUDY_SESSION: 1, BRING_ITEM: 0 }[type] ?? 1
}

export function extractDeliverables(rawText) {
  const sentences = rawText
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const summary = sentences.slice(0, 5)
  const deliverables = []

  for (const sentence of sentences) {
    const type = guessType(sentence)
    if (!type) continue

    deliverables.push({
      type,
      title: sentence.length > 140 ? `${sentence.slice(0, 137)}...` : sentence,
      dueAt: guessDueAt(sentence),
      location: '',
      hoursEstimate: guessHours(type),
    })
  }

  return { summary: summary.length > 0 ? summary : ['No summary available.'], deliverables }
}
