import { createClient } from '@supabase/supabase-js'
import { compressPhoto } from './photo.js'
import { rescueHotline } from './hotlines.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null

const REPORT_COLUMNS_BASE = 'id, report_type, location, notes, status, created_at, latitude, longitude, photo_path, priority, people_affected, vulnerable_people, assigned_to, response_stage, assigned_at, resolution_note, resolved_at, contact_name, contact_phone, location_source, location_flag, priority_needs, priority_pending'
// GPS accuracy and an open SOS's live position (SOS live-location migration).
const REPORT_COLUMNS_LIVE = `${REPORT_COLUMNS_BASE}, location_accuracy, live_latitude, live_longitude, live_accuracy, live_updated_at`
let reportColumns = REPORT_COLUMNS_LIVE

const isMissingColumn = (error) => error?.code === '42703' || error?.code === 'PGRST204'

// Until the newest migration is applied, report queries fall back (once) to
// the columns that exist, so the app keeps working in the meantime.
async function withReportColumns(run) {
  let result = await run(reportColumns)
  if (isMissingColumn(result.error) && reportColumns !== REPORT_COLUMNS_BASE) {
    reportColumns = REPORT_COLUMNS_BASE
    result = await run(reportColumns)
  }
  return result
}
const PHOTO_BUCKET = 'report-photos'
const PROOF_BUCKET = 'priority-proofs'
const PRIORITY_COLUMNS = 'id, user_id, category, full_name, birth_year, due_date, details, proof_path, status, review_note, reviewed_at, created_at, updated_at'

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Check the local environment settings.')
  }
  return supabase
}

export async function currentUserId() {
  // Without a connection, the sign-in saved on this phone is used straight away
  // (renewing an expired pass would only retry until it times out).
  const offlineId = offlineSignInUserId()
  if (offlineId) return offlineId
  const { data: { session }, error } = await requireClient().auth.getSession()
  if (session) return session.user.id
  // Offline with an expired sign-in pass: the sign-in saved on this phone still
  // counts until the connection returns and the pass can be renewed.
  if (error && isNetworkError(error)) {
    const saved = savedSignInUserId()
    if (saved) return saved
  }
  if (error) throw new Error(`Could not verify your account: ${error.message}`)
  throw new Error('Your session has ended. Sign in again to continue.')
}

export function isNetworkError(error) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return error instanceof TypeError || error?.name === 'AuthRetryableFetchError' || /failed to fetch|networkerror|load failed|network request failed/i.test(message)
}

// The person signed in on this phone, read from the saved sign-in. Used only
// while offline, when the sign-in pass has expired and cannot be renewed yet.
export function savedSignInUserId() {
  try {
    return JSON.parse(localStorage.getItem(requireClient().auth.storageKey))?.user?.id ?? null
  } catch {
    return null
  }
}

// True when the phone reports no connection at all.
export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

// The saved sign-in, but only while the phone has no connection.
export function offlineSignInUserId() {
  return isOffline() ? savedSignInUserId() : null
}

// Last successful responses are kept on the device so key safety information
// still shows when the connection drops.
const CACHE_PREFIX = 'ligtas-cache:'

function readCache(key) {
  try {
    return JSON.parse(localStorage.getItem(CACHE_PREFIX + key))
  } catch {
    return null
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, savedAt: new Date().toISOString() }))
  } catch {
    // Storage full or unavailable: caching is best-effort.
  }
}

// Saved responses belong to whoever was signed in, so they are cleared on sign-out.
export function clearCachedData() {
  try {
    Object.keys(localStorage).filter((key) => key.startsWith(CACHE_PREFIX)).forEach((key) => localStorage.removeItem(key))
  } catch {
    // Storage unavailable: nothing was cached.
  }
}

async function withOfflineCache(key, load) {
  // No connection: show what was saved at once. Each request would otherwise
  // be retried for several seconds before failing.
  if (isOffline()) {
    const saved = readCache(key)
    if (saved) return saved.data
  }
  try {
    const data = await load()
    writeCache(key, data)
    return data
  } catch (error) {
    const cached = readCache(key)
    if (cached && isNetworkError(error)) return cached.data
    throw error
  }
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

// Newest first. Before a migration adds its columns, the next set is used and
// what those columns drive (the priority question, accepting the terms) is
// simply not asked.
const PROFILE_COLUMNS = [
  'role, display_name, barangay, phone, priority_answered_at, priority_consent_at, terms_version',
  'role, display_name, barangay, phone, priority_answered_at, priority_consent_at',
  'role, display_name, barangay, phone',
]

export async function getProfile(userId) {
  let data
  let error
  for (const columns of PROFILE_COLUMNS) {
    ;({ data, error } = await requireClient().from('profiles').select(columns).eq('id', userId).single())
    if (error?.code !== '42703') break
  }

  if (error) {
    throw new Error(`Could not load your account role: ${error.message}`)
  }

  if (!['citizen', 'rescuer', 'admin'].includes(data.role)) {
    throw new Error('Your account has an invalid role. Contact an administrator.')
  }

  return data
}

// Staff screens only need the accepted version: undefined before the
// acceptance migration, null when never accepted.
export async function getMyTermsVersion() {
  const { data, error } = await requireClient()
    .from('profiles')
    .select('terms_version')
    .eq('id', await currentUserId())
    .single()
  if (error?.code === '42703') return undefined
  if (error) throw new Error(error.message)
  return data.terms_version
}

export async function acceptTerms(version) {
  const { error } = await requireClient().rpc('accept_terms', { version })
  if (error) throw new Error(`Could not save your acceptance: ${error.message}`)
}

// Sign-in only needs the role; keeping this query minimal lets login work even
// before the newer profile columns have been migrated.
// The role is saved on the phone after each check. Opened without signal (as
// in a typhoon), LIGTAS uses the saved role for the person still signed in on
// this phone, so they reach their saved alerts, centers, hotlines and offline
// reports instead of the sign-in screen. The database still checks every
// request once the phone is back online.
export async function getProfileRole(userId) {
  const savedRole = readCache('role')?.data
  if (isOffline()) {
    if (savedRole?.userId === userId && ['citizen', 'rescuer', 'admin'].includes(savedRole.role)) return savedRole.role
    throw new TypeError('Failed to fetch: this phone is offline')
  }
  const { data, error } = await requireClient()
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error) {
    if (isNetworkError(error) && savedRole?.userId === userId && ['citizen', 'rescuer', 'admin'].includes(savedRole.role)) return savedRole.role
    throw new Error(`Could not load your account role: ${error.message}`)
  }

  if (!['citizen', 'rescuer', 'admin'].includes(data.role)) {
    throw new Error('Your account has an invalid role. Contact an administrator.')
  }

  writeCache('role', { userId, role: data.role })
  return data.role
}

export async function getMyProfile() {
  const userId = await currentUserId()
  return withOfflineCache('my-profile', () => getProfile(userId))
}

export async function updateMyProfile({ displayName, barangay, phone }) {
  const { error } = await requireClient()
    .from('profiles')
    .update({ display_name: displayName?.trim() || null, barangay: barangay?.trim() || null, phone: phone || null })
    .eq('id', await currentUserId())

  if (error) {
    throw new Error(/profiles_phone_check/.test(error.message)
      ? 'Enter the 10 digits after +63, for example 917 123 4567.'
      : `Could not save your details: ${error.message}`)
  }
}

export async function getStaffProfiles() {
  return withOfflineCache('staff', loadStaffProfiles)
}

async function loadStaffProfiles() {
  const { data, error } = await requireClient()
    .from('profiles')
    .select('id, role, display_name, created_at')
    .in('role', ['rescuer', 'admin'])
    .order('display_name', { ascending: true })

  if (error) {
    throw new Error(`Could not load response teams: ${error.message}`)
  }

  return data
}

export async function createRescuerAccount({ email, password, displayName }) {
  const { data, error } = await requireClient().functions.invoke('create-rescuer', {
    body: { email, password, displayName },
  })

  if (error) {
    let message = error.message
    try {
      message = (await error.context.json()).error ?? message
    } catch {
      // Keep the generic message when the function returned no JSON body.
    }
    throw new Error(`Could not create the rescuer account: ${message}`)
  }

  return data
}

// Ends every sign-in session of an account. Its open screens lose access at
// once and the person has to sign in again.
export async function endUserSessions(userId) {
  const { data, error } = await requireClient().rpc('end_user_sessions', { target_user: userId })

  if (error) {
    throw new Error(`Could not sign them out: ${error.message}`)
  }

  return data
}

// True when the server says this sign-in session was ended (signed out on
// another device, or by an admin). Network problems count as still signed in.
export async function isSessionEnded() {
  const { error } = await requireClient().auth.getUser()
  if (!error || isNetworkError(error)) return false
  return error.status === 401 || error.status === 403 || /session/i.test(error.code ?? error.message ?? '')
}

// The database refuses writes from a sign-in that was ended, while the phone
// may still think it is signed in (its sign-in pass lasts up to an hour).
// Such a refusal looks like a row-level security error; this turns it into a
// clear message and tells the app to show the sign-in screen.
export const SESSION_ENDED = 'session-ended'
export const SESSION_ENDED_EVENT = 'ligtas:session-ended'

async function failIfSessionEnded(error) {
  const refused = error?.code === '42501' || /row-level security/i.test(error?.message ?? '')
  if (!refused || !(await isSessionEnded())) return
  window.dispatchEvent(new Event(SESSION_ENDED_EVENT))
  const ended = new Error(`You were signed out on this phone (for example, by signing out on another device), so this was not sent. Sign in again to continue. In an emergency, call ${rescueHotline.name} at ${rescueHotline.display}.`)
  ended.code = SESSION_ENDED
  throw ended
}

export async function deactivateRescuer(rescuerId) {
  const { error } = await requireClient().rpc('deactivate_rescuer', { rescuer_id: rescuerId })

  if (error) {
    throw new Error(`Could not deactivate the rescuer: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

export async function sendPasswordReset(email) {
  const { error } = await requireClient().auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })

  if (error) {
    throw new Error(`Could not send the reset email: ${error.message}`)
  }
}

// Google sign-in is offered to citizens only. The flag tells the app, when
// Google sends the person back, that a problem in the address is about Google.
const GOOGLE_PENDING_KEY = 'ligtas-google-sign-in'

export async function signInWithGoogle() {
  try {
    sessionStorage.setItem(GOOGLE_PENDING_KEY, '1')
  } catch {
    // Errors on return are then described as a general link problem.
  }
  const { error } = await requireClient().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })

  if (error) {
    throw new Error(`Could not open Google sign-in: ${error.message}`)
  }
}

// The session token lists how the person signed in; Google sign-in shows as 'oauth'.
export function isGoogleSession(session) {
  try {
    const payload = JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.amr?.some((entry) => entry.method === 'oauth') ?? false
  } catch {
    return false
  }
}

export function takeGoogleSignIn() {
  try {
    const isPending = sessionStorage.getItem(GOOGLE_PENDING_KEY) === '1'
    sessionStorage.removeItem(GOOGLE_PENDING_KEY)
    return isPending
  } catch {
    return false
  }
}

export async function updatePassword(password) {
  const { error } = await requireClient().auth.updateUser({ password })

  if (error) {
    throw new Error(`Could not change your password: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// Two-step sign-in (admins). The database only grants admin rights once the
// session has been confirmed with an authenticator app code.
// ---------------------------------------------------------------------------

// 'verified' when this session already passed the code step, 'challenge' when
// an authenticator app is set up and needs a code, 'enroll' when none is set up.
export async function getTwoStepStatus() {
  const client = requireClient()
  const { data: level, error: levelError } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
  if (levelError) throw new Error(`Could not check your sign-in: ${levelError.message}`)
  if (level.currentLevel === 'aal2') return 'verified'
  const { data: factors, error } = await client.auth.mfa.listFactors()
  if (error) throw new Error(`Could not check your sign-in: ${error.message}`)
  return factors.totp.length ? 'challenge' : 'enroll'
}

export async function startTwoStepSetup() {
  const client = requireClient()
  const { data: factors, error: listError } = await client.auth.mfa.listFactors()
  if (listError) throw new Error(`Could not start setup: ${listError.message}`)
  // Remove setups that were started but never confirmed, so a fresh code can be made.
  for (const factor of factors.all) {
    if (factor.factor_type === 'totp' && factor.status !== 'verified') {
      await client.auth.mfa.unenroll({ factorId: factor.id })
    }
  }
  const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: `LIGTAS ${new Date().toISOString().slice(0, 16)}` })
  if (error) {
    throw new Error(/mfa.*(disabled|not enabled)/i.test(error.message)
      ? 'Authenticator apps are turned off for this project. Turn on TOTP under Authentication → Multi-Factor in Supabase.'
      : `Could not start setup: ${error.message}`)
  }
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

// Confirms a 6-digit code. Pass factorId while setting up; otherwise the
// account's authenticator app is used.
export async function verifyTwoStepCode(code, factorId = null) {
  const client = requireClient()
  let id = factorId
  if (!id) {
    const { data, error } = await client.auth.mfa.listFactors()
    if (error) throw new Error(`Could not check your sign-in: ${error.message}`)
    id = data.totp[0]?.id
    if (!id) throw new Error('No authenticator app is set up for this account.')
  }
  const { error } = await client.auth.mfa.challengeAndVerify({ factorId: id, code })
  if (error) {
    throw new Error(/invalid|expired|incorrect/i.test(error.message)
      ? 'That code is not right or has expired. Enter the newest 6-digit code from your app.'
      : `Could not confirm the code: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// Incident reports
// ---------------------------------------------------------------------------

async function uploadReportPhoto(userId, original) {
  const file = await compressPhoto(original)
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error } = await requireClient().storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type })

  if (error) {
    await failIfSessionEnded(error)
    throw new Error(`Could not upload the photo: ${error.message}`)
  }

  return path
}

export async function submitIncidentReport({
  reportType,
  location,
  notes,
  latitude = null,
  longitude = null,
  locationSource = null,
  photoFile = null,
  priority = 'Normal',
  peopleAffected = null,
  vulnerablePeople = false,
  locationAccuracy = null,
}) {
  const client = requireClient()
  const userId = await currentUserId()
  const isSos = reportType === 'SOS'
  const photoPath = photoFile ? await uploadReportPhoto(userId, photoFile) : null

  const row = {
    reporter_id: userId,
    report_type: reportType,
    location,
    notes,
    latitude,
    longitude,
    location_source: latitude == null ? null : locationSource,
    photo_path: photoPath,
    priority: isSos ? 'Critical' : priority,
    people_affected: peopleAffected,
    vulnerable_people: vulnerablePeople,
    status: isSos ? 'Verified' : 'Pending',
    location_accuracy: latitude != null && locationSource === 'gps' && Number.isFinite(locationAccuracy) ? Math.round(locationAccuracy) : null,
  }
  let { data, error } = await client.from('incident_reports').insert(row).select('id')
  if (isMissingColumn(error)) {
    delete row.location_accuracy
    ;({ data, error } = await client.from('incident_reports').insert(row).select('id'))
  }

  if (error) {
    await failIfSessionEnded(error)
    throw new Error(`Could not submit incident report: ${error.message}`)
  }
  // The location check drops reports with an impossible position without an
  // error (so it can still record the problem), which leaves nothing returned.
  if (!data?.length) {
    throw new Error('This report was blocked by the location check: the position is outside Santa Maria or too far from your last report. Pin the location on the map instead. In an emergency, use SOS or call MDRRMO Rescue at 0923 022 6973.')
  }
  // Signed in the background: the report is already delivered, and an unsigned
  // report only shows as "Not signed" to staff.
  signReport(data[0].id)
  requestPush('report', data[0].id)
}

// The database asks the send-push function to notify people about every new
// alert and report change. The app asks too, as a backup in case that request
// failed; the function sends each notification only once.
function requestPush(type, id) {
  if (!id) return
  requireClient().functions.invoke('send-push', { body: { type, id } }).catch(() => {})
}

// While an SOS is open and LIGTAS stays open, the person's phone shares its
// latest position, so rescuers go where the person is now. Returns true when
// saved, false when skipped (too soon after the last one). Errors marked
// `final` mean sharing should stop (the SOS was closed, or the feature is not
// set up in the database yet).
export async function shareSosLocation({ sosId, latitude, longitude, accuracy }) {
  const { data, error } = await requireClient().rpc('share_sos_location', { sos_id: sosId, lat: latitude, lng: longitude, accuracy_m: accuracy ?? null })
  if (error) {
    const failure = new Error(error.message)
    failure.code = error.code
    failure.final = error.code === 'PGRST202' || /no longer open|not your SOS|6 hours/i.test(error.message)
    throw failure
  }
  return data === true
}

// Asks the report-integrity function to sign a report just sent, so staff can
// later tell whether it was changed outside the app.
function signReport(reportId) {
  requireClient().functions.invoke('report-integrity', { body: { action: 'sign', reportId } }).catch(() => {})
}

// Checks report signatures; returns { [reportId]: 'valid' | 'unsigned' | 'tampered' }.
export async function verifyReports(ids) {
  const statuses = {}
  for (let start = 0; start < ids.length; start += 300) {
    const { data, error } = await requireClient().functions.invoke('report-integrity', {
      body: { action: 'verify', ids: ids.slice(start, start + 300) },
    })
    if (error) throw new Error(`Could not check report signatures: ${error.message}`)
    Object.assign(statuses, data.statuses)
  }
  return statuses
}

export async function getMyReports() {
  const userId = await currentUserId()
  return withOfflineCache('my-reports', () => loadMyReports(userId))
}

async function loadMyReports(userId) {
  const { data, error } = await withReportColumns((columns) => requireClient()
    .from('incident_reports')
    .select(columns)
    .eq('reporter_id', userId)
    .order('created_at', { ascending: false })
    .limit(20))

  if (error) {
    throw new Error(`Could not load your reports: ${error.message}`)
  }

  return data
}

// Citizens can withdraw a report while it is still waiting for review.
export async function withdrawIncidentReport(reportId) {
  const { data, error } = await requireClient()
    .from('incident_reports')
    .update({ status: 'Cancelled' })
    .eq('id', reportId)
    .eq('status', 'Pending')
    .select('id')

  if (error) {
    throw new Error(`Could not withdraw the report: ${error.message}`)
  }
  if (!data.length) {
    throw new Error('This report was already reviewed, so it can no longer be withdrawn.')
  }
}

export async function getReportPhotoUrl(path) {
  const { data, error } = await requireClient().storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600)

  if (error) {
    throw new Error(`Could not load the photo: ${error.message}`)
  }

  return data.signedUrl
}

export async function getIncidentReports() {
  const { data, error } = await withReportColumns((columns) => requireClient()
    .from('incident_reports')
    .select(columns)
    .order('created_at', { ascending: false }))

  if (error) {
    throw new Error(`Could not load incident reports: ${error.message}`)
  }

  return data
}

export async function getRescuerIncidentReports() {
  return withOfflineCache('rescuer-calls', loadRescuerIncidentReports)
}

async function loadRescuerIncidentReports() {
  const { data, error } = await withReportColumns((columns) => requireClient()
    .from('incident_reports')
    .select(columns)
    .in('status', ['Verified', 'Resolved'])
    .order('created_at', { ascending: false }))

  if (error) {
    throw new Error(`Could not load verified incident reports: ${error.message}`)
  }

  return data
}

export async function updateIncidentReport(reportId, changes) {
  const { data, error } = await withReportColumns((columns) => requireClient()
    .from('incident_reports')
    .update(changes)
    .eq('id', reportId)
    .select(columns)
    .single())

  if (error) {
    throw new Error(`Could not update incident report: ${error.message}`)
  }

  requestPush('report', reportId)
  return data
}

export async function claimIncidentReport(reportId) {
  return updateIncidentReport(reportId, { assigned_to: await currentUserId() })
}

export async function resolveIncidentReport(reportId, resolutionNote) {
  return updateIncidentReport(reportId, {
    status: 'Resolved',
    assigned_to: await currentUserId(),
    resolution_note: resolutionNote?.trim() || null,
  })
}

// Puts a call the rescuer can no longer handle back in the open queue.
export async function releaseIncidentReport(reportId) {
  const { error } = await requireClient().rpc('release_incident_report', { report_id: reportId })

  if (error) {
    throw new Error(`Could not hand back the call: ${error.message}`)
  }
  requestPush('report', reportId)
}

// ---------------------------------------------------------------------------
// Security flags (admins only)
// ---------------------------------------------------------------------------

// Flags from the last 30 days, with the name and number of each flagged account.
export async function getSecurityFlags() {
  const client = requireClient()
  const since = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: flags, error } = await client
    .from('security_flags')
    .select('id, user_id, report_id, kind, detail, created_at, cleared_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    throw new Error(`Could not load security flags: ${error.message}`)
  }

  const userIds = [...new Set(flags.map((flag) => flag.user_id))]
  if (!userIds.length) return { flags, people: [] }
  const { data: people, error: peopleError } = await client
    .from('profiles')
    .select('id, role, display_name, barangay, phone')
    .in('id', userIds)

  if (peopleError) {
    throw new Error(`Could not load flagged accounts: ${peopleError.message}`)
  }

  return { flags, people }
}

export async function clearSecurityFlags(userId) {
  const { error } = await requireClient().rpc('clear_security_flags', { flagged_user: userId })

  if (error) {
    throw new Error(`Could not clear the flags: ${error.message}`)
  }
}

// The country Supabase reports for this connection, or null when it does not
// pass that on (then the network check is off).
export async function getRequestCountry() {
  const { data, error } = await requireClient().rpc('request_country')
  if (error) throw new Error(`Could not check the network country: ${error.message}`)
  return data
}

export async function getReportEvents(limit = 40) {
  const { data, error } = await requireClient()
    .from('report_events')
    .select('id, report_id, actor_id, action, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Could not load the activity log: ${error.message}`)
  }

  return data
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export async function getAlerts() {
  return withOfflineCache('alerts', async () => {
    const { data, error } = await requireClient()
      .from('alerts')
      .select('id, alert_type, severity, title, message, location, target_roles, barangays, expires_at, created_at')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Could not load alerts: ${error.message}`)
    }

    return data
  })
}

export async function publishAlert({ alertType, severity, title, message, location, targetRoles, barangays = null, expiresAt = null }) {
  const { data, error } = await requireClient().from('alerts').insert({
    created_by: await currentUserId(),
    alert_type: alertType,
    severity,
    title,
    message,
    location,
    target_roles: targetRoles,
    barangays: barangays?.length ? barangays : null,
    expires_at: expiresAt,
  }).select('id').single()

  if (error) {
    throw new Error(`Could not publish alert: ${error.message}`)
  }
  requestPush('alert', data.id)
}

export async function endAlert(alertId) {
  const { error } = await requireClient()
    .from('alerts')
    .update({ expires_at: new Date().toISOString() })
    .eq('id', alertId)

  if (error) {
    throw new Error(`Could not end the alert: ${error.message}`)
  }
}

export async function deleteAlert(alertId) {
  const { error } = await requireClient().from('alerts').delete().eq('id', alertId)

  if (error) {
    throw new Error(`Could not delete the alert: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// Evacuation centers and map points
// ---------------------------------------------------------------------------

export async function getEvacuationCenters() {
  return withOfflineCache('evacuation-centers', async () => {
    const { data, error } = await requireClient()
      .from('evacuation_centers')
      .select('id, name, location, latitude, longitude, capacity, occupants, is_open, updated_at')
      .order('name', { ascending: true })

    if (error) {
      throw new Error(`Could not load evacuation centers: ${error.message}`)
    }

    return data
  })
}

export async function saveEvacuationCenter({ id, name, location, latitude = null, longitude = null, capacity, occupants, isOpen }) {
  const row = { name, location, latitude, longitude, capacity, occupants, is_open: isOpen }
  const query = id
    ? requireClient().from('evacuation_centers').update(row).eq('id', id)
    : requireClient().from('evacuation_centers').insert(row)
  const { data, error } = await query.select().single()

  if (error) {
    throw new Error(`Could not save the evacuation center: ${error.message}`)
  }

  return data
}

export async function deleteEvacuationCenter(id) {
  const { error } = await requireClient().from('evacuation_centers').delete().eq('id', id)

  if (error) {
    throw new Error(`Could not remove the evacuation center: ${error.message}`)
  }
}

export async function getMapPoints() {
  return withOfflineCache('map-points', async () => {
    const { data, error } = await requireClient()
      .from('map_points')
      .select('id, name, point_type, severity, description, latitude, longitude, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Could not load map points: ${error.message}`)
    }

    return data
  })
}

export async function addMapPoint({ name, pointType, severity, description = null, latitude, longitude }) {
  const { data, error } = await requireClient()
    .from('map_points')
    .insert({ name, point_type: pointType, severity, description, latitude, longitude })
    .select()
    .single()

  if (error) {
    throw new Error(`Could not save the map point: ${error.message}`)
  }

  return data
}

export async function deleteMapPoint(id) {
  const { error } = await requireClient().from('map_points').delete().eq('id', id)

  if (error) {
    throw new Error(`Could not remove the map point: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// Safety check-ins and rescuer locations
// ---------------------------------------------------------------------------

export async function getMyCheckin() {
  const userId = await currentUserId()
  return withOfflineCache('my-checkin', () => loadMyCheckin(userId))
}

async function loadMyCheckin(userId) {
  const { data, error } = await requireClient()
    .from('safety_checkins')
    .select('status, note, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Could not load your check-in: ${error.message}`)
  }

  return data
}

export async function saveCheckin({ status, note = null, latitude = null, longitude = null }) {
  const userId = await currentUserId()
  const { error } = await requireClient()
    .from('safety_checkins')
    .upsert({ user_id: userId, status, note, latitude, longitude })

  if (error) {
    throw new Error(`Could not save your check-in: ${error.message}`)
  }
  // Tells the person's family (if any); the database asks too.
  requestPush('checkin', userId)
}

// ---------------------------------------------------------------------------
// Family safety (citizens)
// ---------------------------------------------------------------------------

// The family, or null when not in one. { unavailable: true } until the
// database has family safety (supabase/migrations/20261119120000_family_safety.sql).
export async function getMyFamily() {
  return withOfflineCache('family', async () => {
    const { data, error } = await requireClient().rpc('my_family')
    if (error?.code === 'PGRST202') return { unavailable: true }
    if (error) throw new Error(`Could not load your family: ${error.message}`)
    return data ?? null
  })
}

async function familyCall(name, params, failure) {
  const { data, error } = await requireClient().rpc(name, params)
  if (error) {
    await failIfSessionEnded(error)
    throw new Error(error.message.startsWith('Could not') ? error.message : `${failure}: ${error.message}`)
  }
  return data
}

export function createFamily() {
  return familyCall('create_family', {}, 'Could not start a family')
}

// 'joined', 'not-found' or 'full'.
export function joinFamily(code) {
  return familyCall('join_family', { join_code: code }, 'Could not join the family')
}

export function leaveFamily() {
  return familyCall('leave_family', {}, 'Could not leave the family')
}

export function removeFamilyMember(memberId) {
  return familyCall('remove_family_member', { member: memberId }, 'Could not remove this person')
}

export function renewFamilyCode() {
  return familyCall('renew_family_code', {}, 'Could not make a new code')
}

export async function getCheckins() {
  const { data, error } = await requireClient()
    .from('safety_checkins')
    .select('user_id, status, updated_at')

  if (error) {
    throw new Error(`Could not load check-ins: ${error.message}`)
  }

  return data
}

export async function shareRescuerLocation({ latitude, longitude, accuracy = null }) {
  const { error } = await requireClient()
    .from('rescuer_locations')
    .upsert({ rescuer_id: await currentUserId(), latitude, longitude, accuracy_m: accuracy })

  if (error) {
    throw new Error(`Could not share your location: ${error.message}`)
  }
}

export async function stopSharingRescuerLocation() {
  const { error } = await requireClient()
    .from('rescuer_locations')
    .delete()
    .eq('rescuer_id', await currentUserId())

  if (error) {
    throw new Error(`Could not stop sharing your location: ${error.message}`)
  }
}

export async function getRescuerLocations() {
  const { data, error } = await requireClient()
    .from('rescuer_locations')
    .select('rescuer_id, latitude, longitude, accuracy_m, updated_at')

  if (error) {
    throw new Error(`Could not load team locations: ${error.message}`)
  }

  return data
}

// ---------------------------------------------------------------------------
// Priority rescue (persons with disability, pregnant, children, seniors)
// ---------------------------------------------------------------------------
// Proofs are sensitive personal information: kept in a private bucket that
// only the household and admins can open, never rescuers.

const PDF_TYPE = 'application/pdf'
const MAX_PROOF_BYTES = 5 * 1024 * 1024

async function uploadPriorityProof(userId, original) {
  let file = original
  if (original.type !== PDF_TYPE) {
    try {
      file = await compressPhoto(original)
    } catch {
      throw new Error('Choose a photo (JPEG or PNG) or a PDF of the proof.')
    }
  }
  if (file.size > MAX_PROOF_BYTES) {
    throw new Error('The proof is larger than 5 MB. Take a photo of it instead, or use a smaller PDF.')
  }
  const extension = { [PDF_TYPE]: 'pdf', 'image/png': 'png', 'image/webp': 'webp' }[file.type] ?? 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error } = await requireClient().storage.from(PROOF_BUCKET).upload(path, file, { contentType: file.type || 'image/jpeg' })
  if (error) throw new Error(`Could not upload the proof: ${error.message}`)
  return path
}

function removeProofs(paths) {
  const list = paths.filter(Boolean)
  if (list.length) requireClient().storage.from(PROOF_BUCKET).remove(list).catch(() => {})
}

export async function getMyPriorityMembers() {
  const { data, error } = await requireClient()
    .from('priority_members')
    .select(PRIORITY_COLUMNS)
    .eq('user_id', await currentUserId())
    .order('created_at')
  if (error) throw new Error(`Could not load your household list: ${error.message}`)
  return data
}

export async function givePriorityConsent() {
  const { error } = await requireClient().rpc('give_priority_consent')
  if (error) throw new Error(error.message)
}

export async function answerPriorityQuestion(hasPriority) {
  const { error } = await requireClient().rpc('answer_priority_question', { has_priority: hasPriority })
  if (error) throw new Error(error.message)
}

// Adds a person, or edits one (which sends it back for review). A new proof
// replaces the old file once the entry is saved.
export async function savePriorityMember({ id = null, category, fullName, birthYear, dueDate, details, proofFile, oldProofPath = null }) {
  const client = requireClient()
  const userId = await currentUserId()
  const proofPath = proofFile ? await uploadPriorityProof(userId, proofFile) : oldProofPath
  if (!proofPath) throw new Error('Add a photo or PDF of the proof.')
  const row = {
    category,
    full_name: fullName.trim(),
    birth_year: birthYear ? Number(birthYear) : null,
    due_date: category === 'pregnant' ? dueDate || null : null,
    details: details?.trim() || null,
    proof_path: proofPath,
  }
  const request = id
    ? client.from('priority_members').update(row).eq('id', id)
    : client.from('priority_members').insert(row)
  const { data, error } = await request.select(PRIORITY_COLUMNS).single()
  if (error) {
    if (proofFile) removeProofs([proofPath])
    throw new Error(error.message)
  }
  if (proofFile && oldProofPath && oldProofPath !== proofPath) removeProofs([oldProofPath])
  return data
}

export async function removePriorityMember(member) {
  const { error } = await requireClient().from('priority_members').delete().eq('id', member.id)
  if (error) throw new Error(`Could not remove this person: ${error.message}`)
  removeProofs([member.proof_path])
}

// Withdraws consent: every entry and proof is deleted.
export async function clearPriorityInformation() {
  const { data, error } = await requireClient().rpc('clear_priority_information')
  if (error) throw new Error(`Could not remove the information: ${error.message}`)
  removeProofs(data ?? [])
}

// Short-lived link, for the household or an admin checking the proof.
export async function getPriorityProofUrl(path) {
  const { data, error } = await requireClient().storage.from(PROOF_BUCKET).createSignedUrl(path, 300)
  if (error) throw new Error(`Could not open the proof: ${error.message}`)
  return data.signedUrl
}

// Admins: every entry with the household's contact details.
export async function getPriorityReviewQueue() {
  const { data, error } = await requireClient()
    .from('priority_members')
    .select(`${PRIORITY_COLUMNS}, household:profiles!priority_members_user_id_fkey(display_name, phone, barangay)`)
    .order('created_at')
  if (error) throw new Error(`Could not load priority entries: ${error.message}`)
  return data
}

export async function reviewPriorityMember(id, status, note = null) {
  const { data, error } = await requireClient()
    .from('priority_members')
    .update({ status, review_note: note?.trim() || null })
    .eq('id', id)
    .select(PRIORITY_COLUMNS)
  if (error) throw new Error(error.message)
  if (!data.length) throw new Error('Could not review this entry. Sign in again with your authenticator code.')
  return data[0]
}

// ---------------------------------------------------------------------------
// Realtime
// ---------------------------------------------------------------------------

let channelCount = 0

// Calls onChange for every insert/update/delete the signed-in user may see.
export function subscribeToTable(table, onChange) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`ligtas-${table}-${++channelCount}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
