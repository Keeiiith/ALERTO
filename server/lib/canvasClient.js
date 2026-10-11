// Thin wrapper around Canvas LMS's REST API. HAU's "student portal" turned
// out to just be Canvas (hau.instructure.com) -- Instructure is the company
// that makes Canvas, and a huge number of schools run on it. That means
// there's a real, documented, officially-supported API here instead of
// needing to drive a browser through a login form and hope the HTML never
// changes. See docs/07-canvas-sync.md for how a student gets their own
// access token.

const CANVAS_BASE_URL = (process.env.CANVAS_BASE_URL || 'https://hau.instructure.com').replace(/\/$/, '')

export class CanvasAuthError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CanvasAuthError'
  }
}

export class CanvasApiError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CanvasApiError'
  }
}

async function canvasFetch(token, url) {
  let response
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  } catch (error) {
    // A DNS/network failure reaching Canvas at all (wrong CANVAS_BASE_URL,
    // no internet, Canvas is down) -- distinct from Canvas being reachable
    // and rejecting the request, so callers can tell the two apart.
    throw new CanvasApiError(`Could not reach ${url.hostname}: ${error.cause?.message ?? error.message}`)
  }

  if (response.status === 401) {
    throw new CanvasAuthError('Canvas rejected this access token -- it may be wrong, expired, or revoked')
  }
  if (!response.ok) {
    throw new CanvasApiError(`Canvas API returned ${response.status} for ${url.pathname}`)
  }
  return response
}

// Canvas paginates every list endpoint via an RFC 5988 `Link` response
// header instead of a body field -- there is no "total pages" to loop over,
// you just follow rel="next" until it stops appearing.
function nextPageUrl(linkHeader) {
  if (!linkHeader) return null
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/)
    if (match) return new URL(match[1])
  }
  return null
}

async function canvasFetchAll(token, path, params = {}) {
  let url = new URL(`${CANVAS_BASE_URL}/api/v1${path}`)
  for (const [key, value] of Object.entries({ per_page: 100, ...params })) {
    url.searchParams.set(key, value)
  }

  const results = []
  while (url) {
    const response = await canvasFetch(token, url)
    const page = await response.json()
    results.push(...page)
    url = nextPageUrl(response.headers.get('link'))
  }
  return results
}

// Confirms the token actually works and returns the account name, used both
// to validate on /connect (fail fast with a clear error) and to show "Synced
// as <name>" in the UI.
export async function verifyToken(token) {
  const url = new URL(`${CANVAS_BASE_URL}/api/v1/users/self`)
  const response = await canvasFetch(token, url)
  const user = await response.json()
  return { id: user.id, name: user.name }
}

// Active, non-concluded enrollments only -- a finished course from two years
// ago isn't something this app needs to track deadlines for. enrollment_state
// takes a single value (unlike include[], which really is an array param) --
// using the array-bracket form here silently makes Canvas ignore the filter
// and return every course you've ever been enrolled in, which is why a first
// sync could churn through years of historical courses instead of just this
// term's.
export async function fetchCourses(token) {
  return canvasFetchAll(token, '/courses', {
    enrollment_state: 'active',
    'include[]': 'term',
  })
}

// bucket=future keeps this to upcoming work instead of pulling a student's
// entire multi-year assignment history on every sync.
export async function fetchUpcomingAssignments(token, courseId) {
  return canvasFetchAll(token, `/courses/${courseId}/assignments`, { bucket: 'future' })
}

// Canvas announcements are just discussion topics flagged as announcements
// -- there's no separate "announcements" resource under a course. Ordered
// newest-first by Canvas itself.
export async function fetchAnnouncements(token, courseId) {
  return canvasFetchAll(token, `/courses/${courseId}/discussion_topics`, { only_announcements: true })
}
