import { DELIVERABLE_TYPE_LABEL } from '../lib/overload.js'

export function SeverityBadge({ severity }) {
  return <span className={`badge severity-${severity.toLowerCase()}`}>{severity}</span>
}

export function SubjectChip({ subject }) {
  if (!subject) return null
  return <span className={`chip subject-${subject.color}`}>{subject.code}</span>
}

export function DeliverableTypeBadge({ type }) {
  return <span className={`badge type-${type.toLowerCase()}`}>{DELIVERABLE_TYPE_LABEL[type] ?? type}</span>
}

export function RiskPill({ level }) {
  const label = { none: 'Free', normal: 'Normal', moderate: 'Moderate', high: 'High', critical: 'Critical' }[level]
  return <span className={`badge risk-${level}`}>{label}</span>
}
