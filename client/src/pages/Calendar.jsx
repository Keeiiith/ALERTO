import { useState } from 'react'
import { updateDeliverable } from '../api/index.js'
import { SubjectChip, DeliverableTypeBadge, RiskPill } from '../components/Badges.jsx'
import { dailyWorkload, formatDay, formatTime, DELIVERABLE_TYPE_LABEL } from '../lib/overload.js'
import Modal from '../components/Modal.jsx'

const STATUS_LABEL = { pending: 'Pending', done: 'Done' }

export default function CalendarPage({ data, onReload }) {
  const { subjects, deliverables, profile } = data
  const maxCapacity = profile?.maxDailyCapacityHours ?? 6
  const withSubject = deliverables.map((d) => ({ ...d, subject: d.subject ?? subjects.find((s) => s.id === d.subjectId) }))
  const week = dailyWorkload(withSubject, maxCapacity, 7)

  const sortedPending = withSubject
    .filter((d) => d.status !== 'done')
    .slice()
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  const nextDeadline = sortedPending[0]

  const overloadDay = week.find((d) => d.riskLevel === 'high' || d.riskLevel === 'critical')

  const [busyId, setBusyId] = useState(null)
  // Three independent modal states rather than one "activeModal" blob: a
  // click inside the day/week modal swaps this one into the deliverable
  // modal without having to thread a "which kind of modal" flag around.
  const [selectedDeliverable, setSelectedDeliverable] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)
  const [showWeekView, setShowWeekView] = useState(false)

  async function toggleDone(item) {
    setBusyId(item.id)
    try {
      await updateDeliverable(item.id, { status: item.status === 'done' ? 'pending' : 'done' })
      await onReload()
    } finally {
      setBusyId(null)
    }
  }

  function openDeliverable(item) {
    setSelectedDay(null)
    setShowWeekView(false)
    setSelectedDeliverable(item)
  }

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <p className="eyebrow">Requirements & Schedule</p>
          <h1>Calendar & Requirements</h1>
          <p className="lede">Everything extracted from your announcements, laid out day by day.</p>
        </div>
      </header>

      <div className="two-col">
        <div className="col">
          {nextDeadline && (
            <div className="card next-deadline-card">
              <span className="badge next-deadline-badge">Next Critical Deadline</span>
              <strong>{nextDeadline.title}</strong>
              <p className="muted small">{nextDeadline.subject?.name}</p>
              <p className="muted small">Due {formatDay(nextDeadline.dueAt)} · {formatTime(nextDeadline.dueAt)}</p>
            </div>
          )}

          {overloadDay && (
            <div className={`card risk-banner-compact risk-${overloadDay.riskLevel}`}>
              <strong>{formatDay(overloadDay.date.toISOString())} Overload Alert</strong>
              <span className={`badge risk-${overloadDay.riskLevel}`}>{overloadDay.riskLevel.toUpperCase()} RISK</span>
              <p className="muted small">
                Day load {overloadDay.hours.toFixed(1)}h / {maxCapacity}h max. Consider spreading deliverables to an earlier day.
              </p>
            </div>
          )}

          <div className="deliverable-row-top" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>Week at a glance</h2>
            <button type="button" className="ghost-btn" onClick={() => setShowWeekView(true)}>
              View full week ›
            </button>
          </div>
          <ul className="list mini-week">
            {week.map((day) => (
              <li
                key={day.date.toISOString()}
                className="card mini-week-row clickable-row"
                onClick={() => setSelectedDay(day)}
              >
                <span className="mini-week-day">{formatDay(day.date.toISOString())}</span>
                <span className="muted small">{day.items.length} item{day.items.length === 1 ? '' : 's'}</span>
                <RiskPill level={day.riskLevel} />
              </li>
            ))}
          </ul>
        </div>

        <div className="col">
          <h2>Deliverables & Items to Bring</h2>
          {week.every((day) => day.items.length === 0) && (
            <p className="muted empty-state">Nothing scheduled in the next 7 days.</p>
          )}
          {week.map((day) => (
            day.items.length > 0 && (
              <div key={day.date.toISOString()} className="day-group">
                <h3>{formatDay(day.date.toISOString())}</h3>
                <ul className="list">
                  {day.items.map((item) => (
                    <li
                      key={item.id}
                      className={`card deliverable-row clickable-row${item.status === 'done' ? ' done' : ''}`}
                      onClick={() => openDeliverable(item)}
                    >
                      <label className="deliverable-check" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={item.status === 'done'}
                          disabled={busyId === item.id}
                          onChange={() => toggleDone(item)}
                        />
                      </label>
                      <div>
                        <div className="deliverable-row-top">
                          <SubjectChip subject={item.subject} />
                          <DeliverableTypeBadge type={item.type} />
                        </div>
                        <strong>{item.title}</strong>
                        <p className="muted small">{formatTime(item.dueAt)} · {item.location}</p>
                      </div>
                      {item.hoursEstimate > 0 && <span className="hours-pill">{item.hoursEstimate}h est.</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )
          ))}
        </div>
      </div>

      {selectedDeliverable && (
        <Modal title={selectedDeliverable.title} onClose={() => setSelectedDeliverable(null)}>
          <dl className="detail-grid">
            <dt>Type</dt>
            <dd><DeliverableTypeBadge type={selectedDeliverable.type} /></dd>

            <dt>Description</dt>
            <dd>
              {DELIVERABLE_TYPE_LABEL[selectedDeliverable.type] ?? selectedDeliverable.type}
              {selectedDeliverable.location ? ` · ${selectedDeliverable.location}` : ''}
            </dd>

            <dt>Due date</dt>
            <dd>{formatDay(selectedDeliverable.dueAt)} · {formatTime(selectedDeliverable.dueAt)}</dd>

            <dt>Subject</dt>
            <dd>
              {selectedDeliverable.subject ? (
                <>
                  <SubjectChip subject={selectedDeliverable.subject} /> {selectedDeliverable.subject.name}
                </>
              ) : (
                'Unknown subject'
              )}
            </dd>

            <dt>Status</dt>
            <dd>{STATUS_LABEL[selectedDeliverable.status] ?? selectedDeliverable.status}</dd>

            {selectedDeliverable.hoursEstimate > 0 && (
              <>
                <dt>Est. hours</dt>
                <dd>{selectedDeliverable.hoursEstimate}h</dd>
              </>
            )}
          </dl>
        </Modal>
      )}

      {selectedDay && (
        <Modal title={formatDay(selectedDay.date.toISOString())} onClose={() => setSelectedDay(null)}>
          {selectedDay.items.length === 0 ? (
            <p className="modal-empty">Nothing scheduled this day.</p>
          ) : (
            <ul className="list">
              {selectedDay.items.map((item) => (
                <li
                  key={item.id}
                  className={`card deliverable-row clickable-row${item.status === 'done' ? ' done' : ''}`}
                  onClick={() => openDeliverable(item)}
                >
                  <div>
                    <div className="deliverable-row-top">
                      <SubjectChip subject={item.subject} />
                      <DeliverableTypeBadge type={item.type} />
                    </div>
                    <strong>{item.title}</strong>
                    <p className="muted small">{formatTime(item.dueAt)} · {item.location}</p>
                  </div>
                  {item.hoursEstimate > 0 && <span className="hours-pill">{item.hoursEstimate}h est.</span>}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {showWeekView && (
        <Modal title="Full week overview" onClose={() => setShowWeekView(false)} wide>
          {week.every((day) => day.items.length === 0) ? (
            <p className="modal-empty">Nothing scheduled in the next 7 days.</p>
          ) : (
            week.map((day) => (
              <div key={day.date.toISOString()} className="modal-day-group">
                <h3>
                  {formatDay(day.date.toISOString())} · {day.items.length} item{day.items.length === 1 ? '' : 's'}
                </h3>
                {day.items.length === 0 ? (
                  <p className="modal-empty">Nothing scheduled.</p>
                ) : (
                  <ul className="list">
                    {day.items.map((item) => (
                      <li
                        key={item.id}
                        className={`card deliverable-row clickable-row${item.status === 'done' ? ' done' : ''}`}
                        onClick={() => openDeliverable(item)}
                      >
                        <div>
                          <div className="deliverable-row-top">
                            <SubjectChip subject={item.subject} />
                            <DeliverableTypeBadge type={item.type} />
                          </div>
                          <strong>{item.title}</strong>
                          <p className="muted small">{formatTime(item.dueAt)} · {item.location}</p>
                        </div>
                        {item.hoursEstimate > 0 && <span className="hours-pill">{item.hoursEstimate}h est.</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </Modal>
      )}
    </div>
  )
}