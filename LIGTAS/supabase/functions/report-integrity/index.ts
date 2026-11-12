// Signs incident reports and checks their signatures (tamper detection).
// The HMAC key (REPORT_SIGNING_KEY) exists only in this function's secrets, not
// in the database or the app, so a report changed directly in the database
// cannot be given a matching signature.
//
//   { action: 'sign', reportId }  the reporter, right after sending a report
//   { action: 'verify', ids }     rescuers and admins, when showing reports
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Every field that never changes after a report is sent. Status, priority and
// assignment change during the response, so they are not signed.
const SIGNED_COLUMNS = 'id, reporter_id, report_type, location, notes, latitude, longitude, photo_path, contact_name, contact_phone, created_at, status, integrity_sig'
// A report can only be signed shortly after it was sent (offline reports are
// sent, then signed, as soon as the connection returns).
const SIGN_WINDOW_MS = 10 * 60 * 1000
const MAX_VERIFY = 300
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Reads the sign-in level from the caller's token. Only call this after
// auth.getUser() has accepted the token, so its contents can be trusted.
function signInLevel(authorization: string) {
  try {
    const payload = authorization.replace(/^Bearer\s+/i, '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))).aal as string | undefined
  } catch {
    return undefined
  }
}

type SignedRow = Record<string, unknown> & { id: string; reporter_id: string; created_at: string; integrity_sig: string | null }

// The signed text: the protected fields in a fixed order.
function canonical(row: SignedRow) {
  return JSON.stringify([
    row.id, row.reporter_id, row.report_type, row.location, row.notes, row.latitude, row.longitude,
    row.photo_path, row.contact_name, row.contact_phone, row.created_at,
  ])
}

async function signRow(key: CryptoKey, row: SignedRow) {
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical(row)))
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Compares in constant time so the check does not leak how much matched.
function sameText(a: string, b: string) {
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return difference === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = apiKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
  const serviceKey = apiKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
  const secret = Deno.env.get('REPORT_SIGNING_KEY')
  if (!url || !anonKey || !serviceKey) return json({ error: 'Server is not configured.' }, 500)
  if (!secret || secret.length < 32) return json({ error: 'Report signing is not configured.' }, 500)

  const authorization = req.headers.get('Authorization') ?? ''
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: { user }, error: userError } = await caller.auth.getUser()
  if (userError || !user) return json({ error: 'Sign in first.' }, 401)

  let payload: { action?: string; reportId?: string; ids?: unknown }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }

  const admin = createClient(url, serviceKey)
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])

  if (payload.action === 'sign') {
    const reportId = String(payload.reportId ?? '')
    if (!UUID.test(reportId)) return json({ error: 'Invalid report.' }, 400)

    const { data: row, error } = await admin.from('incident_reports').select(SIGNED_COLUMNS).eq('id', reportId).maybeSingle<SignedRow>()
    if (error) return json({ error: 'Could not load the report.' }, 500)
    if (!row || row.reporter_id !== user.id) return json({ error: 'Report not found.' }, 404)
    // Signatures are written once; an existing one is never replaced.
    if (row.integrity_sig) return json({ signed: true })
    if (Date.now() - new Date(row.created_at).getTime() > SIGN_WINDOW_MS) return json({ error: 'This report is too old to sign.' }, 409)

    const { error: updateError } = await admin
      .from('incident_reports')
      .update({ integrity_sig: await signRow(key, row), integrity_signed_at: new Date().toISOString() })
      .eq('id', reportId)
      .is('integrity_sig', null)
    if (updateError) return json({ error: 'Could not save the signature.' }, 500)
    return json({ signed: true })
  }

  if (payload.action === 'verify') {
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin' && profile?.role !== 'rescuer') return json({ error: 'Only staff can check reports.' }, 403)
    if (profile.role === 'admin' && signInLevel(authorization) !== 'aal2') return json({ error: 'Confirm your sign-in with your authenticator app first.' }, 403)

    const ids = Array.isArray(payload.ids) ? payload.ids.map(String).filter((id) => UUID.test(id)) : []
    if (!ids.length) return json({ statuses: {} })
    if (ids.length > MAX_VERIFY) return json({ error: `Check at most ${MAX_VERIFY} reports at a time.` }, 400)

    const { data: rows, error } = await admin.from('incident_reports').select(SIGNED_COLUMNS).in('id', ids)
    if (error) return json({ error: 'Could not load the reports.' }, 500)

    const statuses: Record<string, string> = {}
    for (const row of rows as SignedRow[]) {
      // Rescuers only ever see reviewed reports, so they get answers only for those.
      if (profile.role === 'rescuer' && !['Verified', 'Resolved'].includes(String(row.status))) continue
      statuses[row.id] = !row.integrity_sig ? 'unsigned' : sameText(await signRow(key, row), row.integrity_sig) ? 'valid' : 'tampered'
    }
    return json({ statuses })
  }

  return json({ error: 'Unknown action.' }, 400)
})
