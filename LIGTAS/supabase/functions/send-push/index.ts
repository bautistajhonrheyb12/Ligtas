// Sends push notifications, so alerts and report updates reach phones even
// when LIGTAS is closed.
//
//   { type: 'alert', id }         a new alert (called by the database)
//   { type: 'report_event', id }  a report change (called by the database)
//   { type: 'report', id }        recent changes of one report (called by the app
//                                 as a backup, in case the database call failed)
//   { type: 'checkin', id }       a safety check-in, told to the person's family
//                                 (called by the database; id is the person)
//   { type: 'test' }              a test notification to the caller's own phones
//
// Deployed without the JWT check, because the database calls it without a
// user token. That is safe: it only reads the real alert or report from the
// database, only for events from the last 15 minutes, and sends each event
// once (push_claim), so calling it again or with made-up IDs sends nothing.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { alertNotices, familyCheckinNotice, familySosNotice, reportNotices, testNotice, type AlertRow, type EventRow, type Lang, type Notice, type ReportRow } from './messages.ts'
import { sendWebPush, type Vapid } from './webpush.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RECENT_MS = 15 * 60 * 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NOTIFY_ACTIONS = ['SOS sent', 'Submitted', 'Verified', 'Rejected', 'Resolved', 'Assigned', 'Unassigned', 'En route', 'On scene']
const REPORT_COLUMNS = 'id, report_type, location, status, reporter_id, assigned_to, people_affected, priority_needs'
const ALERT_COLUMNS_BASE = 'id, created_by, alert_type, severity, title, message, location, target_roles, barangays, expires_at, created_at'
// alert_type_other arrives with the alert-types migration; alerts still go out
// (without it) if the function is deployed before the migration is run.
const ALERT_COLUMNS = `${ALERT_COLUMNS_BASE}, alert_type_other`
// Same rule as the database: only the push services of the major browsers.
const PUSH_SERVICE = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com|[a-z0-9.-]+\.push\.apple\.com)\//

// The project's API keys. The new keys (sb_publishable_…, sb_secret_…) come first;
// the legacy JWT-based keys are only a fallback until they are turned off.
function apiKey(newKeysName: string, legacyName: string) {
  try {
    const keys = JSON.parse(Deno.env.get(newKeysName) ?? '{}')
    const value = keys.default ?? Object.values(keys)[0]
    if (typeof value === 'string' && value) return value
  } catch {
    // Not set or not JSON: use the legacy key.
  }
  return Deno.env.get(legacyName)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const isRecent = (time: string) => Date.now() - Date.parse(time) < RECENT_MS

type Subscriber = { sub_id: string; sub_user: string; endpoint: string; p256dh: string; auth_secret: string; language: string }
type Tally = { sent: number; failed: number; removed: number }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = apiKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
  const serviceKey = apiKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
  const vapid: Vapid = {
    publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
    privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
    subject: Deno.env.get('VAPID_SUBJECT') ?? 'mailto:ligtas1130@gmail.com',
  }
  if (!url || !anonKey || !serviceKey) return json({ error: 'Server is not configured.' }, 500)
  if (!vapid.publicKey || !vapid.privateKey) return json({ error: 'Push notifications are not configured.' }, 500)

  let payload: { type?: unknown; id?: unknown }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const tally: Tally = { sent: 0, failed: 0, removed: 0 }

  // Sends one event's notices; a phone gets at most one notification per event.
  async function deliver(claimKey: string, notices: Notice[]) {
    if (notices.length === 0) return
    const { data: claimed, error: claimError } = await admin.rpc('push_claim', { claim_key: claimKey })
    if (claimError) throw claimError
    if (!claimed) return
    const reached = new Set<string>()
    for (const notice of notices) {
      const { data, error } = await admin.rpc('push_subscribers', {
        target_roles: notice.roles ?? [],
        target_users: notice.users ?? [],
        target_barangays: notice.barangays?.length ? notice.barangays : null,
        skip_user: notice.skip ?? null,
      })
      if (error) throw error
      const phones = (data as Subscriber[]).filter((phone) => !reached.has(phone.endpoint) && PUSH_SERVICE.test(phone.endpoint))
      phones.forEach((phone) => reached.add(phone.endpoint))
      // A few at a time, so a big alert does not overwhelm the function.
      for (let start = 0; start < phones.length; start += 20) {
        await Promise.all(phones.slice(start, start + 20).map(async (phone) => {
          const message = notice.message(phone.language === 'tl' ? 'tl' : 'en' as Lang)
          const body = JSON.stringify({ title: message.title, body: message.body, tag: message.tag, urgent: message.urgent, url: '/', at: Date.now() })
          try {
            const result = await sendWebPush({ endpoint: phone.endpoint, p256dh: phone.p256dh, auth: phone.auth_secret }, body, vapid, { ttl: message.ttl, urgency: message.urgency })
            if (result.ok) {
              tally.sent += 1
            } else if (result.gone) {
              const { error: removeError } = await admin.from('push_subscriptions').delete().eq('id', phone.sub_id)
              if (removeError) console.warn('could not remove an unsubscribed phone', removeError.message)
              tally.removed += 1
            } else {
              tally.failed += 1
              console.warn('push failed', result.status, new URL(phone.endpoint).host, result.detail)
            }
          } catch (error) {
            tally.failed += 1
            console.warn('push error', new URL(phone.endpoint).host, String(error))
          }
        }))
      }
    }
  }

  // The other members of a person's family, and the person's name.
  async function familyOf(personId: string) {
    const { data: family, error } = await admin.rpc('family_of', { person: personId })
    if (error) throw error
    if (!family?.length) return { family: [] as string[], name: null }
    const { data: profile } = await admin.from('profiles').select('display_name').eq('id', personId).maybeSingle()
    return { family: family as string[], name: (profile?.display_name ?? '').trim() || null }
  }

  async function reportEvent(event: EventRow & { created_at: string }) {
    if (!NOTIFY_ACTIONS.includes(event.action) || !isRecent(event.created_at)) return
    const { data: report, error } = await admin.from('incident_reports').select(REPORT_COLUMNS).eq('id', event.report_id).maybeSingle()
    if (error) throw error
    if (!report) return
    const notices = reportNotices(event, report as ReportRow)
    // An SOS is also told to the person's family.
    if (event.action === 'SOS sent' && report.reporter_id) {
      const { family, name } = await familyOf(report.reporter_id)
      if (family.length) notices.push(familySosNotice(report.reporter_id, name, family))
    }
    await deliver(`event:${event.id}`, notices)
  }

  async function checkin(personId: string) {
    const { data: row, error } = await admin.from('safety_checkins').select('status, updated_at').eq('user_id', personId).maybeSingle()
    if (error) throw error
    if (!row || !isRecent(row.updated_at)) return
    // "Need help" is saved with every SOS; the family already hears about the SOS.
    if (row.status !== 'Safe') {
      const { count } = await admin.from('incident_reports').select('id', { count: 'exact', head: true })
        .eq('reporter_id', personId).eq('report_type', 'SOS').gte('created_at', new Date(Date.now() - RECENT_MS).toISOString())
      if (count) return
    }
    const { family, name } = await familyOf(personId)
    if (!family.length) return
    // The same status again counts once per half hour.
    const bucket = Math.floor(Date.parse(row.updated_at) / (30 * 60 * 1000))
    await deliver(`checkin:${personId}:${row.status}:${bucket}`, [familyCheckinNotice(personId, name, row.status, family)])
  }

  try {
    const { type, id } = payload
    if (type === 'alert' && typeof id === 'string' && UUID.test(id)) {
      let { data: alert, error } = await admin.from('alerts').select(ALERT_COLUMNS).eq('id', id).maybeSingle()
      if (error && (error.code === '42703' || error.code === 'PGRST204')) {
        ;({ data: alert, error } = await admin.from('alerts').select(ALERT_COLUMNS_BASE).eq('id', id).maybeSingle())
      }
      if (error) throw error
      if (alert && isRecent(alert.created_at) && !(alert.expires_at && Date.parse(alert.expires_at) <= Date.now())) {
        await deliver(`alert:${alert.id}`, alertNotices(alert as AlertRow))
      }
    } else if (type === 'report_event' && /^\d{1,18}$/.test(String(id))) {
      const { data: event, error } = await admin.from('report_events').select('id, report_id, actor_id, action, detail, created_at').eq('id', String(id)).maybeSingle()
      if (error) throw error
      if (event) await reportEvent(event)
    } else if (type === 'report' && typeof id === 'string' && UUID.test(id)) {
      const since = new Date(Date.now() - RECENT_MS).toISOString()
      const { data: events, error } = await admin.from('report_events')
        .select('id, report_id, actor_id, action, detail, created_at')
        .eq('report_id', id)
        .gte('created_at', since)
        .in('action', NOTIFY_ACTIONS)
        .order('id')
      if (error) throw error
      for (const event of events ?? []) await reportEvent(event)
    } else if (type === 'checkin' && typeof id === 'string' && UUID.test(id)) {
      await checkin(id)
    } else if (type === 'test') {
      const authorization = req.headers.get('Authorization') ?? ''
      const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
      const { data: { user } } = await caller.auth.getUser()
      if (!user) return json({ error: 'Sign in first.' }, 401)
      // At most one test a minute per person.
      await deliver(`test:${user.id}:${Math.floor(Date.now() / 60000)}`, [testNotice(user.id)])
      return json({ ok: true, sent: tally.sent })
    } else {
      return json({ error: 'Unknown request.' }, 400)
    }
  } catch (error) {
    // Database errors are plain objects; log their message so the problem shows in the logs.
    console.error('send-push failed', (error as { message?: string })?.message ?? String(error))
    return json({ error: 'Could not send notifications.' }, 500)
  }

  console.log('send-push', String(payload.type), tally)
  return json({ ok: true })
})
