// Creates a rescuer account on behalf of a signed-in admin.
// Runs server-side because creating users needs the service role key,
// which must never be shipped to the browser.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

// The same password rules as the app (src/lib/ui.jsx), checked again here
// because the form's own check can be skipped.
function passwordProblem(password: string) {
  if (password.length < 8) return 'Password must be at least 8 characters.'
  if (password.length > 72) return 'Password must be 72 characters or fewer.'
  if (!/[A-Z]/.test(password)) return 'Password needs an uppercase letter.'
  if (!/[a-z]/.test(password)) return 'Password needs a lowercase letter.'
  if (!/\d/.test(password)) return 'Password needs a number.'
  if (!/[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/.test(password)) return 'Password needs a symbol, like ! @ # $ ?'
  return ''
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = apiKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
  const serviceKey = apiKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceKey) return json({ error: 'Server is not configured.' }, 500)

  const authorization = req.headers.get('Authorization') ?? ''
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: { user }, error: userError } = await caller.auth.getUser()
  if (userError || !user) return json({ error: 'Sign in as an admin to create accounts.' }, 401)
  if (signInLevel(authorization) !== 'aal2') return json({ error: 'Confirm your sign-in with your authenticator app first.' }, 403)

  const admin = createClient(url, serviceKey)
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return json({ error: 'Only admins can create rescuer accounts.' }, 403)

  let payload: { email?: string; password?: string; displayName?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid request body.' }, 400)
  }

  const email = payload.email?.trim().toLowerCase() ?? ''
  const password = payload.password ?? ''
  const displayName = payload.displayName?.trim() ?? ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Enter a valid email address.' }, 400)
  const problem = passwordProblem(password)
  if (problem) return json({ error: problem }, 400)
  if (displayName.length < 2 || displayName.length > 80) return json({ error: 'Enter a team or rescuer name (2–80 characters).' }, 400)

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createError || !created.user) return json({ error: createError?.message ?? 'Could not create the account.' }, 400)

  // The signup trigger already inserted a citizen profile; promote it.
  const { error: profileError } = await admin
    .from('profiles')
    .update({ role: 'rescuer', display_name: displayName })
    .eq('id', created.user.id)

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return json({ error: `Could not set the rescuer role: ${profileError.message}` }, 500)
  }

  return json({ id: created.user.id, email, displayName })
})
