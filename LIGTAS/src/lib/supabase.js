import { createClient } from '@supabase/supabase-js'
import { compressPhoto } from './photo.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null

const REPORT_COLUMNS = 'id, report_type, location, notes, status, created_at, latitude, longitude, photo_path, priority, people_affected, vulnerable_people, assigned_to, response_stage, assigned_at, resolution_note, resolved_at, contact_name, contact_phone'
const PHOTO_BUCKET = 'report-photos'

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Check the local environment settings.')
  }
  return supabase
}

export async function currentUserId() {
  const { data: { session }, error } = await requireClient().auth.getSession()
  if (error) throw new Error(`Could not verify your account: ${error.message}`)
  if (!session) throw new Error('Your session has ended. Sign in again to continue.')
  return session.user.id
}

export function isNetworkError(error) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return error instanceof TypeError || /failed to fetch|networkerror|load failed|network request failed/i.test(message)
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

export async function getProfile(userId) {
  const { data, error } = await requireClient()
    .from('profiles')
    .select('role, display_name, barangay, phone')
    .eq('id', userId)
    .single()

  if (error) {
    throw new Error(`Could not load your account role: ${error.message}`)
  }

  if (!['citizen', 'rescuer', 'admin'].includes(data.role)) {
    throw new Error('Your account has an invalid role. Contact an administrator.')
  }

  return data
}

// Sign-in only needs the role; keeping this query minimal lets login work even
// before the newer profile columns have been migrated.
export async function getProfileRole(userId) {
  const { data, error } = await requireClient()
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (error) {
    throw new Error(`Could not load your account role: ${error.message}`)
  }

  if (!['citizen', 'rescuer', 'admin'].includes(data.role)) {
    throw new Error('Your account has an invalid role. Contact an administrator.')
  }

  return data.role
}

export async function getMyProfile() {
  return getProfile(await currentUserId())
}

export async function updateMyProfile({ displayName, barangay, phone }) {
  const { error } = await requireClient()
    .from('profiles')
    .update({ display_name: displayName?.trim() || null, barangay: barangay?.trim() || null, phone: phone?.trim() || null })
    .eq('id', await currentUserId())

  if (error) {
    throw new Error(/profiles_phone_check/.test(error.message)
      ? 'Enter a valid mobile number, for example 0917 123 4567.'
      : `Could not save your details: ${error.message}`)
  }
}

export async function getStaffProfiles() {
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
  photoFile = null,
  priority = 'Normal',
  peopleAffected = null,
  vulnerablePeople = false,
}) {
  const client = requireClient()
  const userId = await currentUserId()
  const isSos = reportType === 'SOS'
  const photoPath = photoFile ? await uploadReportPhoto(userId, photoFile) : null

  const { error } = await client.from('incident_reports').insert({
    reporter_id: userId,
    report_type: reportType,
    location,
    notes,
    latitude,
    longitude,
    photo_path: photoPath,
    priority: isSos ? 'Critical' : priority,
    people_affected: peopleAffected,
    vulnerable_people: vulnerablePeople,
    status: isSos ? 'Verified' : 'Pending',
  })

  if (error) {
    throw new Error(`Could not submit incident report: ${error.message}`)
  }
}

export async function getMyReports() {
  const { data, error } = await requireClient()
    .from('incident_reports')
    .select(REPORT_COLUMNS)
    .eq('reporter_id', await currentUserId())
    .order('created_at', { ascending: false })
    .limit(20)

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
  const { data, error } = await requireClient()
    .from('incident_reports')
    .select(REPORT_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Could not load incident reports: ${error.message}`)
  }

  return data
}

export async function getRescuerIncidentReports() {
  const { data, error } = await requireClient()
    .from('incident_reports')
    .select(REPORT_COLUMNS)
    .in('status', ['Verified', 'Resolved'])
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Could not load verified incident reports: ${error.message}`)
  }

  return data
}

export async function updateIncidentReport(reportId, changes) {
  const { data, error } = await requireClient()
    .from('incident_reports')
    .update(changes)
    .eq('id', reportId)
    .select(REPORT_COLUMNS)
    .single()

  if (error) {
    throw new Error(`Could not update incident report: ${error.message}`)
  }

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
  const { error } = await requireClient().from('alerts').insert({
    created_by: await currentUserId(),
    alert_type: alertType,
    severity,
    title,
    message,
    location,
    target_roles: targetRoles,
    barangays: barangays?.length ? barangays : null,
    expires_at: expiresAt,
  })

  if (error) {
    throw new Error(`Could not publish alert: ${error.message}`)
  }
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
  const { data, error } = await requireClient()
    .from('safety_checkins')
    .select('status, note, updated_at')
    .eq('user_id', await currentUserId())
    .maybeSingle()

  if (error) {
    throw new Error(`Could not load your check-in: ${error.message}`)
  }

  return data
}

export async function saveCheckin({ status, note = null, latitude = null, longitude = null }) {
  const { error } = await requireClient()
    .from('safety_checkins')
    .upsert({ user_id: await currentUserId(), status, note, latitude, longitude })

  if (error) {
    throw new Error(`Could not save your check-in: ${error.message}`)
  }
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
