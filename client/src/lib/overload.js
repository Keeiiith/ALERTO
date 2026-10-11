const DAY_MS = 24 * 60 * 60 * 1000

export function dateKey(iso) {
  return iso.slice(0, 10) // YYYY-MM-DD, for grouping by day
}

export function formatDay(iso) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function formatDateTime(iso) {
  return `${formatDay(iso)} • ${formatTime(iso)}`
}

export function minutesAgoLabel(minutes) {
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

// Rolls deliverables up into one row per calendar day: total hours due that
// day and the risk level against the user's max daily capacity.
export function dailyWorkload(deliverables, maxDailyCapacityHours, days = 7) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const byDay = new Map()
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() + i * DAY_MS)
    byDay.set(dateKey(d.toISOString()), { date: d, hours: 0, items: [] })
  }

  for (const item of deliverables) {
    const key = dateKey(item.dueAt)
    if (byDay.has(key)) {
      const bucket = byDay.get(key)
      bucket.hours += item.hoursEstimate || 0
      bucket.items.push(item)
    }
  }

  return Array.from(byDay.values()).map((bucket) => ({
    ...bucket,
    riskLevel: riskLevelFor(bucket.hours, maxDailyCapacityHours),
  }))
}

export function riskLevelFor(hours, maxDailyCapacityHours) {
  if (hours <= 0) return 'none'
  if (hours <= maxDailyCapacityHours) return 'normal'
  if (hours <= maxDailyCapacityHours * 1.25) return 'moderate'
  if (hours <= maxDailyCapacityHours * 1.6) return 'high'
  return 'critical'
}

export const DELIVERABLE_TYPE_LABEL = {
  EXAM: 'Exam',
  ASSIGNMENT: 'Assignment',
  BRING_ITEM: 'Bring Item',
  STUDY_SESSION: 'Study Session',
}

export const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MODERATE', 'LOW']
