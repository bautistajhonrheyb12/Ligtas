// Who hears about what, and what the notification says. Citizens get their
// language (English or Filipino); staff screens are in English.

export type Lang = 'en' | 'tl'
export type Message = {
  title: string
  body: string
  // Notifications with the same tag replace each other on the phone.
  tag: string
  // Urgent ones stay on screen until tapped and vibrate longer.
  urgent: boolean
  ttl: number
  urgency: 'normal' | 'high'
}
export type Notice = {
  roles?: string[]
  users?: string[]
  barangays?: string[] | null
  skip?: string | null
  message: (lang: Lang) => Message
}
export type ReportRow = {
  id: string
  report_type: string
  location: string | null
  status: string
  reporter_id: string | null
  assigned_to: string | null
  people_affected: number | null
  priority_needs: string[] | null
}
export type EventRow = { id: number; report_id: string; actor_id: string | null; action: string; detail: string | null }
export type AlertRow = {
  id: string
  created_by: string | null
  // What the alert is about; for "Other", alert_type_other says what (such as
  // "Chemical spill"). Both may be missing before the alert-types migration.
  alert_type?: string | null
  alert_type_other?: string | null
  severity: string
  title: string
  message: string
  location: string | null
  target_roles: string[]
  barangays: string[] | null
  expires_at: string | null
}

const HOUR = 3600
// Report categories as the app shows them ('Blocked road' and 'Medical' keep
// their stored names; older categories stay for older reports).
const TYPES_EN: Record<string, string> = {
  'Vehicular accident': 'Vehicular Accident',
  Medical: 'Medical Emergency',
  Rescue: 'Rescue / Trapped',
  'Blocked road': 'Road Obstruction',
  'Downed power line': 'Downed Power Line',
  Other: 'Others',
}
const TYPES_TL: Record<string, string> = {
  Flooding: 'Baha',
  Fire: 'Sunog',
  'Vehicular accident': 'Aksidente sa Daan',
  Medical: 'Medikal / Ambulansya',
  Rescue: 'Pagliligtas',
  'Blocked road': 'Nakaharang sa Daan / Puno',
  'Downed power line': 'Nakalaylay na Kable',
  'Fallen tree': 'Natumbang puno',
  'Power outage': 'Brownout',
  Landslide: 'Pagguho ng lupa',
  Other: 'Iba pa',
  SOS: 'SOS',
}
const NEEDS: Record<string, string> = { pwd: 'PWD', pregnant: 'Pregnant', senior: 'Senior citizen', child: 'Child' }

export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}

const join = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(' · ')

function typeName(report: ReportRow, lang: Lang) {
  return (lang === 'tl' ? TYPES_TL : TYPES_EN)[report.report_type] ?? report.report_type
}

function place(report: ReportRow) {
  return clip(report.location || 'Location on the map', 90)
}

// Staff see who needs extra care and how many people.
function staffDetails(report: ReportRow) {
  const needs = (report.priority_needs ?? []).map((need) => NEEDS[need]).filter(Boolean)
  const people = report.people_affected && report.people_affected > 0
    ? `${report.people_affected} ${report.people_affected === 1 ? 'person' : 'people'}`
    : null
  return join(place(report), needs.length > 0 && `Priority: ${needs.join(', ')}`, people)
}

function staff(report: ReportRow, title: string, urgent: boolean, body = staffDetails(report)): (lang: Lang) => Message {
  return () => ({ title, body, tag: `report-${report.id}`, urgent, ttl: 6 * HOUR, urgency: urgent ? 'high' : 'normal' })
}

function citizen(report: ReportRow, text: Record<Lang, { title: string; body: string }>, urgent = false): (lang: Lang) => Message {
  return (lang) => ({ ...text[lang], tag: `report-${report.id}`, urgent: false, ttl: 24 * HOUR, urgency: urgent ? 'high' : 'normal' })
}

// The notices for one change to a report (one row of report_events).
export function reportNotices(event: EventRow, report: ReportRow): Notice[] {
  const isSos = report.report_type === 'SOS'
  const actor = event.actor_id
  const reporter = report.reporter_id ? [report.reporter_id] : []
  const summary = (lang: Lang) => join(typeName(report, lang), place(report))

  switch (event.action) {
    case 'SOS sent':
      return [{ roles: ['rescuer', 'admin'], skip: actor, message: staff(report, 'SOS: someone needs help now', true) }]

    case 'Submitted':
      return [{ roles: ['admin'], skip: actor, message: staff(report, `New report to review: ${typeName(report, 'en')}`, false) }]

    case 'Verified':
      if (isSos) return []
      return [
        { roles: ['rescuer'], skip: actor, message: staff(report, `New call: ${typeName(report, 'en')}`, false) },
        {
          users: reporter,
          skip: actor,
          message: citizen(report, {
            en: { title: 'Your report was verified', body: `${summary('en')}. Rescuers can now see it.` },
            tl: { title: 'Na-verify na ang ulat mo', body: `${summary('tl')}. Nakikita na ito ng mga rescuer.` },
          }),
        },
      ]

    case 'Rejected':
      return [{
        users: reporter,
        skip: actor,
        message: citizen(report, {
          en: { title: 'Your report was not accepted', body: event.detail ? `Reason: ${clip(event.detail, 150)}` : 'Open LIGTAS to see why.' },
          tl: { title: 'Hindi tinanggap ang ulat mo', body: event.detail ? `Dahilan: ${clip(event.detail, 150)}` : 'Buksan ang LIGTAS para makita kung bakit.' },
        }),
      }]

    case 'Assigned': {
      const assignee = event.detail && /^[0-9a-f-]{36}$/i.test(event.detail) ? event.detail : report.assigned_to
      const notices: Notice[] = []
      if (assignee && assignee !== actor) {
        notices.push({ users: [assignee], message: staff(report, isSos ? 'SOS assigned to you' : `Assigned to you: ${typeName(report, 'en')}`, isSos) })
      }
      notices.push({
        users: reporter,
        skip: actor,
        message: citizen(report, isSos
          ? {
            en: { title: 'A rescue team is responding to your SOS', body: 'Stay somewhere safe and keep your phone on. Open LIGTAS so they can see where you are.' },
            tl: { title: 'May rescue team nang tumutugon sa SOS mo', body: 'Manatili sa ligtas na lugar at panatilihing bukas ang telepono. Buksan ang LIGTAS para makita nila kung nasaan ka.' },
          }
          : {
            en: { title: 'A rescue team was assigned to your report', body: summary('en') },
            tl: { title: 'May rescue team nang naka-assign sa ulat mo', body: summary('tl') },
          }, isSos),
      })
      return notices
    }

    case 'Unassigned':
      return [{ roles: ['admin'], skip: actor, message: staff(report, `Call returned: ${typeName(report, 'en')}`, isSos, join(place(report), 'needs a team')) }]

    case 'En route':
      return [{
        users: reporter,
        skip: actor,
        message: citizen(report, {
          en: { title: 'Rescuers are on the way', body: isSos ? 'Keep LIGTAS open so they can find you.' : summary('en') },
          tl: { title: 'Papunta na ang mga rescuer', body: isSos ? 'Panatilihing bukas ang LIGTAS para mahanap ka nila.' : summary('tl') },
        }, isSos),
      }]

    case 'On scene':
      return [{
        users: reporter,
        skip: actor,
        message: citizen(report, {
          en: { title: 'Rescuers have arrived', body: summary('en') },
          tl: { title: 'Dumating na ang mga rescuer', body: summary('tl') },
        }, isSos),
      }]

    case 'Resolved':
      return [{
        users: reporter,
        skip: actor,
        message: citizen(report, {
          en: { title: isSos ? 'Your SOS was marked resolved' : 'Your report was resolved', body: event.detail ? clip(event.detail, 150) : summary('en') },
          tl: { title: isSos ? 'Nalutas na ang SOS mo' : 'Nalutas na ang ulat mo', body: event.detail ? clip(event.detail, 150) : summary('tl') },
        }),
      }]

    default:
      return []
  }
}

const ALERT_TYPES_TL: Record<string, string> = { Flood: 'Baha', 'Severe weather': 'Masamang panahon', Landslide: 'Pagguho ng lupa', 'Road closure': 'Saradong daan', Other: 'Iba pa' }

// What the alert is about, in the person's language; an "Other" alert shows
// what the sender wrote (such as "Chemical spill") instead of "Other".
export function alertTypeName(alert: AlertRow, lang: Lang) {
  if (alert.alert_type === 'Other' && alert.alert_type_other) return alert.alert_type_other
  if (!alert.alert_type) return null
  return lang === 'tl' ? ALERT_TYPES_TL[alert.alert_type] ?? alert.alert_type : alert.alert_type
}

export function alertNotices(alert: AlertRow, now = Date.now()): Notice[] {
  const expires = alert.expires_at ? Date.parse(alert.expires_at) : NaN
  const ttl = Number.isFinite(expires) ? Math.max(60, Math.min(24 * HOUR, Math.round((expires - now) / 1000))) : 24 * HOUR
  const isHigh = alert.severity === 'High'
  const message = (lang: Lang): Message => ({
    title: clip(alert.title, 80),
    body: clip(join(alertTypeName(alert, lang), alert.location, alert.message), 200),
    tag: `alert-${alert.id}`,
    urgent: isHigh,
    ttl,
    urgency: isHigh ? 'high' : 'normal',
  })
  return [{ roles: alert.target_roles, barangays: alert.barangays, skip: alert.created_by, message }]
}

export function testNotice(userId: string): Notice {
  return {
    users: [userId],
    message: (lang) => ({
      ...(lang === 'tl'
        ? { title: 'Bukas na ang mga notification ng LIGTAS', body: 'Dito darating ang mga alerto at update, kahit nakasara ang LIGTAS.' }
        : { title: 'LIGTAS notifications are on', body: 'Alerts and updates will arrive here, even when LIGTAS is closed.' }),
      tag: 'ligtas-test',
      urgent: false,
      ttl: 10 * 60,
      urgency: 'normal',
    }),
  }
}

// Family safety: what a family hears when one of them sends an SOS or checks in.
function familyName(name: string | null) {
  return name ? clip(name, 40) : 'A family member'
}
// Filipino needs the right marker: "si Maria" / "ang isang kapamilya" (who),
// "ni Maria" / "ng isang kapamilya" (whose).
const tlWho = (name: string | null) => (name ? `si ${clip(name, 40)}` : 'ang isang kapamilya')
const tlWhose = (name: string | null) => (name ? `ni ${clip(name, 40)}` : 'ng isang kapamilya')

export function familySosNotice(personId: string, name: string | null, family: string[]): Notice {
  return {
    users: family,
    skip: personId,
    message: (lang) => ({
      ...(lang === 'tl'
        ? { title: `Nagpadala ng SOS ${tlWho(name)}`, body: 'Naabisuhan na ang mga rescuer. Buksan ang LIGTAS para masundan ito.' }
        : { title: `${familyName(name)} sent an SOS`, body: 'Rescuers have been alerted. Open LIGTAS to follow it.' }),
      tag: `family-${personId}`,
      urgent: true,
      ttl: 6 * HOUR,
      urgency: 'high',
    }),
  }
}

export function familyCheckinNotice(personId: string, name: string | null, status: string, family: string[]): Notice {
  const safe = status === 'Safe'
  return {
    users: family,
    skip: personId,
    message: (lang) => ({
      ...(safe
        ? (lang === 'tl'
          ? { title: `Ligtas ${tlWho(name)}`, body: 'Minarkahan nila ang sarili bilang ligtas sa LIGTAS.' }
          : { title: `${familyName(name)} is safe`, body: 'They marked themselves safe in LIGTAS.' })
        : (lang === 'tl'
          ? { title: `Kailangan ng tulong ${tlWhose(name)}`, body: 'Tawagan sila kung kaya mo, o ang MDRRMO Rescue.' }
          : { title: `${familyName(name)} needs help`, body: 'Call them if you can, or call MDRRMO Rescue.' })),
      tag: `family-${personId}`,
      urgent: !safe,
      ttl: 6 * HOUR,
      urgency: safe ? 'normal' : 'high',
    }),
  }
}
