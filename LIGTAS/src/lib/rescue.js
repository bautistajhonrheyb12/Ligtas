// Rescue operations shared by the rescuer and admin screens: the steps of a
// call, rescue outcomes, rescuer availability, call filters and the rescuer's
// notifications. The database keeps its own stage names (Assigned, En route,
// On scene); people see them as the steps below.

import { distanceKm } from './ui.jsx'

// Pending (verified, no team yet) → Accepted → En route → On scene → Resolved.
export const RESPONSE_STEPS = [
  { id: 'pending', label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'enroute', label: 'En route' },
  { id: 'onscene', label: 'On scene' },
  { id: 'resolved', label: 'Resolved' },
]

const STAGE_STEP = { Assigned: 'accepted', 'En route': 'enroute', 'On scene': 'onscene' }

export function responseStep(report) {
  if (report.status === 'Resolved') return 'resolved'
  if (!report.assigned_to) return 'pending'
  return STAGE_STEP[report.response_stage] ?? 'accepted'
}

export const responseStepLabel = (report) => RESPONSE_STEPS.find((step) => step.id === responseStep(report)).label

// What came of a call (incident_reports.resolution_outcome).
export const RESCUE_OUTCOMES = [
  'Rescued',
  'Evacuated',
  'Treated on site',
  'Taken to hospital',
  'Hazard cleared',
  'No action needed',
  'Could not locate',
  'False alarm',
]

// Rescuer availability (rescuer_status.availability).
export const AVAILABILITY = [
  { id: 'Available', tone: 'available', hint: 'Can take a call' },
  { id: 'Responding', tone: 'responding', hint: 'On a call' },
  { id: 'Unavailable', tone: 'unavailable', hint: 'Off duty or resting' },
]
export const availabilityOf = (statuses, rescuerId) => statuses.find((status) => status.rescuer_id === rescuerId) ?? null

// Most urgent first. Within the same priority: households with verified
// priority people (PWD, pregnant, senior citizen, child), then any other
// vulnerable people, then the call waiting longest.
const priorityRank = { Critical: 0, Urgent: 1, Normal: 2 }
export function byUrgency(a, b) {
  return (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2)
    || (b.priority_needs?.length ?? 0) - (a.priority_needs?.length ?? 0)
    || Number(b.vulnerable_people) - Number(a.vulnerable_people)
    || new Date(a.created_at) - new Date(b.created_at)
}

export const isPriorityHousehold = (report) => Boolean(report.priority_needs?.length || report.priority_pending?.length || report.vulnerable_people)

// The open-call filters: urgency, who has it, how far, and words.
export const DEFAULT_CALL_FILTERS = { urgency: 'all', team: 'waiting', within: 'any', vulnerable: false, search: '', sort: 'urgency' }

export function filterCalls(calls, filters, { myPosition }) {
  const words = filters.search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const limitKm = filters.within === 'any' ? null : Number(filters.within)
  const list = calls
    .map((call) => ({ call, km: myPosition && call.latitude != null ? distanceKm(myPosition, call) : null }))
    .filter(({ call }) => filters.urgency === 'all' || call.priority === filters.urgency)
    .filter(({ call }) => filters.team === 'all' || (filters.team === 'waiting' ? !call.assigned_to : Boolean(call.assigned_to)))
    .filter(({ call }) => !filters.vulnerable || isPriorityHousehold(call))
    .filter(({ km }) => limitKm == null || (km != null && km <= limitKm))
    .filter(({ call }) => words.every((word) => `${call.report_type} ${call.report_type_other ?? ''} ${call.location} ${call.notes ?? ''}`.toLowerCase().includes(word)))
  list.sort((a, b) => (filters.sort === 'nearest' ? (a.km ?? Infinity) - (b.km ?? Infinity) || byUrgency(a.call, b.call) : byUrgency(a.call, b.call)))
  return list.map(({ call }) => call)
}

// ---------------------------------------------------------------------------
// Notifications: built from the calls, alerts and activity the rescuer can
// already see, so nothing is invented. Which ones were read is kept on this
// phone.
// ---------------------------------------------------------------------------
const READ_LIMIT = 400
const readKey = (userId) => `ligtas-rescuer-read:${userId}`

export function readNotificationIds(userId) {
  if (!userId) return []
  try {
    return JSON.parse(localStorage.getItem(readKey(userId))) ?? []
  } catch {
    return []
  }
}

export function saveNotificationIds(userId, ids) {
  if (!userId) return
  try {
    localStorage.setItem(readKey(userId), JSON.stringify(ids.slice(-READ_LIMIT)))
  } catch {
    // Read marks then last only until the app closes.
  }
}

const noticesKey = (userId) => `ligtas-rescuer-notices:${userId}`
const DAY_MS = 24 * 3600000

export function readNotices(userId) {
  if (!userId) return []
  try {
    return (JSON.parse(localStorage.getItem(noticesKey(userId))) ?? []).filter((notice) => Date.now() - new Date(notice.at).getTime() < DAY_MS)
  } catch {
    return []
  }
}

export function saveNotices(userId, notices) {
  if (!userId) return
  try {
    localStorage.setItem(noticesKey(userId), JSON.stringify(notices.slice(0, 30)))
  } catch {
    // Kept only until the app closes.
  }
}

// kinds: 'sos' (new SOS), 'call' (new call), 'assigned' (a call given to you),
// 'update' (a change to one of your calls), 'alert' (a situation alert).
// `notices` are changes seen live that the data no longer shows (a call taken
// off you or given to another team), kept for a day.
export function buildNotifications({ calls, alerts, events, notices = [], myId, staffName, typeLabel }) {
  const items = [...notices]
  const day = Date.now() - DAY_MS
  for (const call of calls) {
    if (call.status === 'Verified' && !call.assigned_to) {
      items.push({
        id: `call:${call.id}`,
        kind: call.report_type === 'SOS' ? 'sos' : 'call',
        title: call.report_type === 'SOS' ? 'New SOS needs a team' : `New call: ${typeLabel(call)}`,
        detail: `${call.location}${call.priority !== 'Normal' ? ` · ${call.priority}` : ''}`,
        at: call.created_at,
        callId: call.id,
      })
    }
  }
  for (const event of events) {
    if (new Date(event.created_at).getTime() < day || event.actor_id === myId) continue
    const call = calls.find((item) => item.id === event.report_id)
    if (!call) continue
    if (event.action === 'Assigned' && event.detail === myId) {
      items.push({ id: `event:${event.id}`, kind: 'assigned', title: `Assigned to you: ${typeLabel(call)}`, detail: `${call.location} · by ${staffName(event.actor_id)}`, at: event.created_at, callId: call.id })
    } else if (event.action === 'Field note' && call.assigned_to === myId) {
      items.push({ id: `event:${event.id}`, kind: 'update', title: `Note from ${staffName(event.actor_id)}`, detail: event.detail ?? '', at: event.created_at, callId: call.id })
    } else if (event.action === 'Priority changed' && call.assigned_to === myId) {
      items.push({ id: `event:${event.id}`, kind: 'update', title: `Priority changed: ${typeLabel(call)}`, detail: `${event.detail ?? ''} · ${call.location}`, at: event.created_at, callId: call.id })
    }
  }
  for (const alert of alerts) {
    items.push({
      id: `alert:${alert.id}`,
      kind: 'alert',
      title: alert.title,
      detail: `${alert.severity.replace(' Severity', '')} · ${alert.location}`,
      at: alert.createdAt,
      urgent: alert.accent === 'red',
    })
  }
  return items.sort((a, b) => new Date(b.at) - new Date(a.at))
}
