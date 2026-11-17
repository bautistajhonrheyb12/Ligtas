import { useEffect, useState } from 'preact/hooks'
import { supabase } from './supabase.js'
import { isIos, isStandalone } from './install.js'

// Push notifications: alerts and report updates that reach this phone even
// when LIGTAS is closed. The phone's browser makes a push subscription; it is
// saved for the person signed in (tied to this sign-in, so signing out stops
// it), and the send-push server function uses it to deliver notifications,
// which the service worker (public/sw.js) shows.

const env = import.meta.env ?? {}
// Public half of the VAPID key pair (safe to publish). The private half is a
// secret of the send-push function only.
export const VAPID_PUBLIC_KEY = env.VITE_VAPID_PUBLIC_KEY || 'BHxyIt7w1Hyyj35ET8Hieq5jTcCHhhMFwdYznM_vbFHbqmqyK2lS3jDUSYsWCjXE_kHS57vxVfj2oY9CYX12KeE'
// People who turned notifications on on this phone. A shared phone only
// notifies the people who chose it, never whoever signs in next.
const CHOSEN_KEY = 'ligtas-push-users'

function readChosen() {
  try {
    const list = JSON.parse(localStorage.getItem(CHOSEN_KEY))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function setChosen(userId, isOn) {
  const list = readChosen().filter((id) => id !== userId)
  if (isOn) list.push(userId)
  try {
    localStorage.setItem(CHOSEN_KEY, JSON.stringify(list.slice(-10)))
  } catch {
    // Not remembered; the setting can be turned on again.
  }
}

function keyBytes(base64Url) {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function sameKey(buffer, base64Url) {
  if (!buffer) return false
  const a = new Uint8Array(buffer)
  const b = keyBytes(base64Url)
  return a.length === b.length && a.every((byte, index) => byte === b[index])
}

const canPush = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

async function currentUserId() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

// The service worker is registered when the app loads (production builds).
async function registration() {
  if (!canPush()) return null
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing) return existing
  if (!import.meta.env.PROD) return null
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

async function save(subscription, language) {
  const { endpoint, keys } = subscription.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', {
    push_endpoint: endpoint,
    push_p256dh: keys?.p256dh,
    push_auth: keys?.auth,
    push_language: language === 'tl' ? 'tl' : 'en',
  })
  if (error) throw new Error(error.message)
}

// Shared state, so the prompt and the settings card always agree.
let state = { status: 'checking', error: '' }
const listeners = new Set()
function setState(next) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener(state))
}

// 'unsupported', 'install-first' (iPhone not added to the Home Screen),
// 'blocked' (the person refused permission), 'off' or 'on'.
export async function refreshPush() {
  try {
    if (isIos() && !isStandalone()) return setState({ status: 'install-first' })
    if (!canPush()) return setState({ status: 'unsupported' })
    if (Notification.permission === 'denied') return setState({ status: 'blocked' })
    const reg = await registration()
    if (!reg) return setState({ status: 'unsupported' })
    const [subscription, userId] = await Promise.all([reg.pushManager.getSubscription(), currentUserId()])
    const isOn = Boolean(subscription) && Notification.permission === 'granted' && readChosen().includes(userId)
    setState({ status: isOn ? 'on' : 'off' })
  } catch {
    setState({ status: 'unsupported' })
  }
}

// Turns notifications on for the person signed in. Call it from a button
// press: browsers only ask for permission after a tap.
export async function enablePush(language) {
  setState({ error: '' })
  const reg = await registration()
  if (!reg) throw new Error('This browser cannot show notifications.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    await refreshPush()
    return state.status
  }
  let subscription = await reg.pushManager.getSubscription()
  // A subscription made with an old key cannot receive LIGTAS messages.
  if (subscription && !sameKey(subscription.options?.applicationServerKey, VAPID_PUBLIC_KEY)) {
    await subscription.unsubscribe().catch(() => {})
    subscription = null
  }
  if (!subscription) subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) })
  await save(subscription, language)
  setChosen(await currentUserId(), true)
  setState({ status: 'on' })
  return 'on'
}

export async function disablePush() {
  const reg = await registration()
  const subscription = await reg?.pushManager.getSubscription()
  if (subscription) {
    const { error } = await supabase.rpc('remove_push_subscription', { push_endpoint: subscription.endpoint })
    if (error) throw new Error(error.message)
    await subscription.unsubscribe().catch(() => {})
  }
  setChosen(await currentUserId(), false)
  setState({ status: 'off' })
}

// Each time a dashboard opens (and when the language changes): saves this
// phone again for the person signed in, so a new sign-in, a renewed
// subscription or a new language reaches the server. Never asks permission.
export async function syncPush(language) {
  try {
    if (!canPush() || Notification.permission !== 'granted') return refreshPush()
    const userId = await currentUserId()
    if (!userId || !readChosen().includes(userId)) return refreshPush()
    const reg = await registration()
    if (!reg) return refreshPush()
    let subscription = await reg.pushManager.getSubscription()
    if (subscription && !sameKey(subscription.options?.applicationServerKey, VAPID_PUBLIC_KEY)) {
      await subscription.unsubscribe().catch(() => {})
      subscription = null
    }
    if (!subscription) subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) })
    await save(subscription, language)
  } catch {
    // Tried again next time the app opens.
  }
  return refreshPush()
}

// Asks the server to send a test notification to this person's phones.
export async function sendTestPush() {
  const { data, error } = await supabase.functions.invoke('send-push', { body: { type: 'test' } })
  if (error) throw new Error('Could not send a test. Check your connection and try again.')
  return data?.sent ?? 0
}

export function usePush() {
  const [current, setCurrent] = useState(state)
  useEffect(() => {
    listeners.add(setCurrent)
    if (state.status === 'checking') refreshPush()
    // Permission can change outside LIGTAS (browser or phone settings): check
    // again when it does, and whenever the person comes back to the app.
    const onVisible = () => { if (document.visibilityState === 'visible') refreshPush() }
    document.addEventListener('visibilitychange', onVisible)
    let permission = null
    navigator.permissions?.query({ name: 'notifications' })
      .then((status) => {
        permission = status
        status.addEventListener('change', refreshPush)
      })
      .catch(() => {})
    return () => {
      listeners.delete(setCurrent)
      document.removeEventListener('visibilitychange', onVisible)
      permission?.removeEventListener('change', refreshPush)
    }
  }, [])
  return current
}
