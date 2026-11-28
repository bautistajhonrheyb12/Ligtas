import { useState } from 'preact/hooks'
import { getReportPhotoUrl } from '../../lib/supabase.js'
import { Icon, distanceKm, formatDistance, reportTypeLabel, reportTypeStyle, timeAgo } from '../../lib/ui.jsx'
import { PriorityTags, hasPriority } from '../../components/PriorityTags.jsx'
import { RESPONSE_STEPS, responseStep } from '../../lib/rescue.js'

// One call as rescuers see it in the queues: what, where, who is involved,
// how far, who has it and how far along it is, then the actions.

export function CallPhoto({ path }) {
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)
  if (url) return <a class="rx-call-photo" href={url} target="_blank" rel="noreferrer"><img src={url} alt="Photo attached to the report" /></a>
  return <button type="button" class="rx-chip-button" disabled={failed} onClick={() => getReportPhotoUrl(path).then(setUrl).catch(() => setFailed(true))}>
    <Icon name="camera" size={15} /> {failed ? 'Photo unavailable' : 'View photo'}
  </button>
}

// Pending → Accepted → En route → On scene → Resolved, the current step marked.
export function ResponseSteps({ report, compact = false }) {
  const current = RESPONSE_STEPS.findIndex((step) => step.id === responseStep(report))
  return <ol class={`rx-steps${compact ? ' is-compact' : ''}`} aria-label={`Progress: ${RESPONSE_STEPS[current].label}`}>
    {RESPONSE_STEPS.map((step, index) => <li key={step.id} class={index < current ? 'is-done' : index === current ? 'is-current' : ''} aria-current={index === current ? 'step' : undefined}>
      <i aria-hidden="true">{index < current ? <Icon name="check" size={11} /> : null}</i>
      <span>{step.label}</span>
    </li>)}
  </ol>
}

// children: shown above the actions; footer: below them (field notes).
export function CallCard({ report, myId, myPosition, isTampered, staffName, onShowOnMap, actions, showSteps = true, children, footer }) {
  const type = reportTypeStyle(report.report_type)
  const isResolved = report.status === 'Resolved'
  const isMine = myId && report.assigned_to === myId
  const distance = myPosition && report.latitude != null ? distanceKm(myPosition, report) : null
  return <article class={`rx-call rx-tone--${type.tone}${isResolved ? ' is-resolved' : ''}${report.priority === 'Critical' && !isResolved ? ' is-critical' : ''}${hasPriority(report) || report.vulnerable_people ? ' is-priority-household' : ''}`} data-call-id={report.id}>
    <div class="rx-call-top">
      <span class="rx-type-icon"><Icon name={type.icon} size={22} /></span>
      <div class="rx-call-title">
        <strong>{reportTypeLabel(report)}</strong>
        <span><Icon name="clock" size={13} /> {timeAgo(report.created_at)}{distance != null && <> · <Icon name="navigate" size={12} /> {formatDistance(distance)}</>}</span>
      </div>
      {isResolved
        ? <span class="rx-status rx-status--resolved">Resolved</span>
        : report.priority !== 'Normal' && <span class={`rx-priority rx-priority--${report.priority.toLowerCase()}`}>{report.priority}</span>}
    </div>
    <p class="rx-call-location">
      <Icon name="pin" size={18} /><span>{report.location}</span>
      {report.isLive && !isResolved && <b class="rx-live-badge" title="The person is sharing their live location">Live</b>}
      {report.latitude != null && !isResolved && onShowOnMap && <button type="button" class="rx-map-link" onClick={() => onShowOnMap(report)}><Icon name="map" size={14} /> Show on map</button>}
    </p>
    {isTampered && !isResolved && <p class="integrity-warning" role="alert">
      <Icon name="alert" size={15} /><span><b>Changed outside the app.</b> The details of this call do not match what the reporter sent. Confirm with operations before responding.</span>
    </p>}
    {report.location_flag && !isResolved && <p class="location-warning" role="note">
      <Icon name="alert" size={15} /><span><b>Check before going:</b> {report.location_flag}. Call the reporter to confirm where they are.</span>
    </p>}
    {(report.people_affected > 0 || report.vulnerable_people || hasPriority(report)) && <div class="rx-call-tags">
      <PriorityTags needs={report.priority_needs} pending={report.priority_pending} />
      {report.people_affected > 0 && <span><Icon name="users" size={14} /> {report.people_affected} {report.people_affected === 1 ? 'person' : 'people'}</span>}
      {report.vulnerable_people && !report.priority_needs?.length && <span class="is-vulnerable"><Icon name="heart" size={14} /> Children, elderly or PWD</span>}
    </div>}
    {report.notes && <p class="rx-call-notes">{report.notes}</p>}
    {(report.contact_name || report.contact_phone) && !isResolved && <div class="rx-call-contact">
      <span><Icon name="user" size={14} /> {report.contact_name || 'Reporter'}</span>
      {report.contact_phone
        ? <a href={`tel:${report.contact_phone.replace(/[^+\d]/g, '')}`}><Icon name="phone" size={15} /> Call {report.contact_phone}</a>
        : <small>No phone number given</small>}
    </div>}
    {report.photo_path && <CallPhoto path={report.photo_path} />}
    {report.assigned_to && !isResolved && <p class={`rx-assignment${isMine ? ' is-mine' : ''}`}>
      <Icon name="user" size={14} /> {isMine ? 'You' : staffName(report.assigned_to)}{report.assigned_at ? ` · accepted ${timeAgo(report.assigned_at).toLowerCase()}` : ''}
    </p>}
    {showSteps && !isResolved && report.assigned_to && <ResponseSteps report={report} compact />}
    {isResolved && (report.resolution_outcome || report.resolution_note) && <p class="rx-resolution">
      {report.resolution_outcome && <b class="rx-outcome">{report.resolution_outcome}</b>}
      {report.resolution_note && <span>{report.resolution_note}</span>}
    </p>}
    {children}
    {actions}
    {footer}
  </article>
}
