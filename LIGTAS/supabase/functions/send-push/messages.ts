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
  severity: string
  title: string
  message: string
  location: string | null
  target_roles: string[]
  barangays: string[] | null
  expires_at: string | null
}

const HOUR = 3600
const TYPES_TL: Record<string, string> = {
  Flooding: 'Baha',
  'Blocked road': 'Saradong daan',
  'Fallen tree': 'Natumbang puno',
  'Power outage': 'Brownout',
  Landslide: 'Pagguho ng lupa',
  Fire: 'Sunog',
  Medical: 'Medikal',
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
  return lang === 'tl' ? TYPES_TL[report.report_type] ?? report.report_type : report.report_type
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
      return [{ roles: ['admin'], skip: actor, message: staff(report, `New report to review: ${report.report_type}`, false) }]

    case 'Verified':
      if (isSos) return []
      return [
        { roles: ['rescuer'], skip: actor, message: staff(report, `New call: ${report.report_type}`, false) },
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
        notices.push({ users: [assignee], message: staff(report, isSos ? 'SOS assigned to you' : `Assigned to you: ${report.report_type}`, isSos) })
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
      return [{ roles: ['admin'], skip: actor, message: staff(report, `Call returned: ${report.report_type}`, isSos, join(place(report), 'needs a team')) }]

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

export function alertNotices(alert: AlertRow, now = Date.now()): Notice[] {
  const expires = alert.expires_at ? Date.parse(alert.expires_at) : NaN
  const ttl = Number.isFinite(expires) ? Math.max(60, Math.min(24 * HOUR, Math.round((expires - now) / 1000))) : 24 * HOUR
  const isHigh = alert.severity === 'High'
  const message: Message = {
    title: clip(alert.title, 80),
    body: clip(join(alert.location, alert.message), 200),
    tag: `alert-${alert.id}`,
    urgent: isHigh,
    ttl,
    urgency: isHigh ? 'high' : 'normal',
  }
  return [{ roles: alert.target_roles, barangays: alert.barangays, skip: alert.created_by, message: () => message }]
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
