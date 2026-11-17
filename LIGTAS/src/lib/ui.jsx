import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { Icon, iconHtml } from './icons.jsx'

export function toAlertView(alert) {
  const accent = alert.severity === 'High' ? 'red' : alert.severity === 'Moderate' ? 'yellow' : 'blue'
  return {
    id: alert.id,
    type: alert.alert_type,
    severity: `${alert.severity} Severity`,
    title: alert.title,
    description: alert.message,
    location: alert.location,
    createdAt: alert.created_at,
    time: new Date(alert.created_at).toLocaleString(),
    barangays: alert.barangays ?? null,
    expiresAt: alert.expires_at ?? null,
    targetRoles: alert.target_roles ?? [],
    accent,
  }
}

// The icon for an alert, by what it is about.
const ALERT_ICONS = { Flood: 'droplet', 'Severe weather': 'rain', Landslide: 'mountain', 'Road closure': 'blocked' }

export function alertIcon(alert) {
  return ALERT_ICONS[alert.type] ?? (alert.accent === 'blue' ? 'info' : 'alert')
}

export function alertSymbol(alert) {
  return <Icon name={alertIcon(alert)} size={20} />
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function CountUp({ value, duration = 900 }) {
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? value : 0))
  const currentRef = useRef(display)

  useEffect(() => {
    if (prefersReducedMotion()) {
      currentRef.current = value
      setDisplay(value)
      return undefined
    }
    const from = currentRef.current
    const start = performance.now()
    let frame
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const next = Math.round(from + (value - from) * (1 - (1 - progress) ** 3))
      currentRef.current = next
      setDisplay(next)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <>{display.toLocaleString()}</>
}

export function LoadingCards({ label, count = 3 }) {
  return <div class="skeleton-list" role="status">
    <span class="sr-only">{label}</span>
    {Array.from({ length: count }, (_, index) => <div class="skeleton-card" key={index} aria-hidden="true">
      <i />
      <div><b /><span /><span /></div>
    </div>)}
  </div>
}

// Icons are Lucide icons; see lib/icons.jsx for the names.
export { Icon, iconHtml }

export function timeAgo(value) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return new Date(value).toLocaleDateString()
}

export const reportTypeStyles = {
  Flooding: { icon: 'droplet', tone: 'blue' },
  'Blocked road': { icon: 'blocked', tone: 'amber' },
  'Fallen tree': { icon: 'tree', tone: 'green' },
  'Power outage': { icon: 'bolt', tone: 'violet' },
  Landslide: { icon: 'mountain', tone: 'amber' },
  Fire: { icon: 'fire', tone: 'red' },
  Medical: { icon: 'medical', tone: 'red' },
  SOS: { icon: 'sos', tone: 'red' },
}

export function reportTypeStyle(type) {
  return reportTypeStyles[type] ?? { icon: 'alert', tone: 'red' }
}

export function capacityLevel(occupants, capacity) {
  const ratio = occupants / capacity
  if (ratio >= 0.85) return { level: 'critical', label: 'Near capacity' }
  if (ratio >= 0.6) return { level: 'busy', label: 'Filling up' }
  return { level: 'open', label: 'Space available' }
}

// Keeps a sliding highlight under the active tab button of a nav bar.
export function useTabIndicator(activeKey) {
  const navRef = useRef(null)

  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return undefined
    const place = () => {
      const active = nav.querySelector('button.active')
      if (!active) return
      nav.style.setProperty('--pill-x', `${active.offsetLeft}px`)
      nav.style.setProperty('--pill-y', `${active.offsetTop}px`)
      nav.style.setProperty('--pill-w', `${active.offsetWidth}px`)
      nav.style.setProperty('--pill-h', `${active.offsetHeight}px`)
      nav.style.setProperty('--pill-r', getComputedStyle(active).borderRadius)
      nav.classList.add('has-pill')
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [activeKey])

  return navRef
}

export function Logo({ small = false }) {
  return <div class={`logo-slot ${small ? 'logo-small' : ''}`}>
    <img src="/LigtasLogo.png" alt="LIGTAS logo" onError={(event) => { event.currentTarget.style.display = 'none' }} />
  </div>
}

// Straight-line distance in kilometres (haversine).
export function distanceKm(from, to) {
  const rad = (value) => value * Math.PI / 180
  const dLat = rad(to.latitude - from.latitude)
  const dLng = rad(to.longitude - from.longitude)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

// Password rules, matching Supabase's strongest password setting (see SETUP.md).
// The symbols are exactly the ones Supabase counts as symbols.
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (password) => password.length >= 8 },
  { id: 'upper', label: 'An uppercase letter (A–Z)', test: (password) => /[A-Z]/.test(password) },
  { id: 'lower', label: 'A lowercase letter (a–z)', test: (password) => /[a-z]/.test(password) },
  { id: 'number', label: 'A number (0–9)', test: (password) => /\d/.test(password) },
  { id: 'symbol', label: 'A symbol, like ! @ # $ ?', test: (password) => /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/.test(password) },
]

// Returns '' when the password meets every rule, otherwise what is missing.
export function passwordProblem(password) {
  // Supabase only uses the first 72 characters of a password.
  if (password.length > 72) return 'Password must be 72 characters or fewer'
  const missing = PASSWORD_RULES.find((rule) => !rule.test(password))
  return missing ? `Password needs ${missing.label.charAt(0).toLowerCase()}${missing.label.slice(1)}` : ''
}

// Ticks off each rule as the person types a new password.
export function PasswordChecklist({ password }) {
  return <ul class="password-rules" aria-label="Password requirements">
    {PASSWORD_RULES.map((rule) => {
      const isMet = rule.test(password)
      return <li class={isMet ? 'is-met' : ''} key={rule.id}>
        <span class="password-rule-mark" aria-hidden="true">{isMet ? <Icon name="check" size={12} /> : null}</span>
        {rule.label}
        <span class="sr-only">{isMet ? ' (done)' : ' (missing)'}</span>
      </li>
    })}
  </ul>
}

function readPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        at: Date.now(),
      }),
      reject,
      options,
    )
  })
}

// One location fix. GPS is tried first; if it is slow (often indoors) or
// unavailable, Wi-Fi and mobile-network positioning answer instead.
export async function getCurrentPosition() {
  if (!navigator.geolocation) throw new Error('This device cannot share its location.')
  try {
    return await readPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 })
  } catch (error) {
    if (error.code === error.PERMISSION_DENIED) throw new Error(locationErrorMessage(error))
    try {
      return await readPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 })
    } catch (fallbackError) {
      throw new Error(locationErrorMessage(fallbackError))
    }
  }
}

function locationErrorMessage(error) {
  return error.code === error.PERMISSION_DENIED
    ? 'Location permission was denied. Allow location access in your browser settings.'
    : 'Could not get your location. Move to an open area and try again.'
}

// Follows the device's location so people always see themselves on the map.
// Tracking pauses while the app is in the background to save battery, and stops
// if location permission is refused until `retry` is called.
export function useLivePosition() {
  const [position, setPosition] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('This device cannot share its location.')
      return undefined
    }
    let watchId = null
    let isDenied = false
    const stop = () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      watchId = null
    }
    const start = () => {
      if (watchId != null || isDenied || document.hidden) return
      watchId = navigator.geolocation.watchPosition(
        (next) => {
          setError('')
          setPosition({ latitude: next.coords.latitude, longitude: next.coords.longitude, accuracy: next.coords.accuracy, at: Date.now() })
        },
        (watchError) => {
          setError(locationErrorMessage(watchError))
          if (watchError.code === watchError.PERMISSION_DENIED) {
            isDenied = true
            stop()
          }
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 },
      )
    }
    const followVisibility = () => (document.hidden ? stop() : start())
    start()
    document.addEventListener('visibilitychange', followVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', followVisibility)
    }
  }, [attempt])

  // The error clears in the same render, so callers never act on the old one.
  const retry = () => {
    setError('')
    setAttempt((count) => count + 1)
  }

  return { position, error, retry }
}

export function directionsUrl({ latitude, longitude, location }) {
  const destination = latitude != null ? `${latitude},${longitude}` : `${location}, Santa Maria, Bulacan`
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
}

// Keeps the screen on while `active` (sharing location, navigating), so the
// phone does not lock mid-response. Browsers drop the lock when the tab
// is hidden, so it is requested again when the app comes back.
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined
    let lock = null
    let cancelled = false
    const request = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock.request('screen')
        .then((sentinel) => { if (cancelled) sentinel.release(); else lock = sentinel })
        .catch(() => {})
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', request)
      lock?.release().catch(() => {})
    }
  }, [active])
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return isOnline
}

// Phones pause apps in the background, and the live connection with them, so
// alerts and reports changed meanwhile would be missed. This reloads a screen's
// data when LIGTAS comes back to the front (after a few seconds away), when it
// is restored from the recent-apps list, and when the connection returns.
export function useRefreshOnReturn(reload) {
  const reloadRef = useRef(reload)
  reloadRef.current = reload
  useEffect(() => {
    let hiddenAt = document.hidden ? Date.now() : 0
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now()
        return
      }
      if (hiddenAt && Date.now() - hiddenAt > 3000) reloadRef.current()
      hiddenAt = 0
    }
    const onPageShow = (event) => { if (event.persisted) reloadRef.current() }
    const onOnline = () => reloadRef.current()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('online', onOnline)
    }
  }, [])
}

let audioContext = null

// Short two-tone chime (and a vibration on phones) for urgent events.
export function playAlertChime(urgent = false) {
  try {
    navigator.vibrate?.(urgent ? [300, 120, 300, 120, 300] : [200])
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)()
    const notes = urgent ? [880, 660, 880, 660] : [660, 880]
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator()
      const gain = audioContext.createGain()
      const start = audioContext.currentTime + index * 0.18
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
      oscillator.connect(gain).connect(audioContext.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.17)
    })
  } catch {
    // Sound is a nice-to-have; browsers may block it until the user interacts.
  }
}

export function useToasts() {
  const [toasts, setToasts] = useState([])
  const push = (message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((current) => [...current.slice(-2), { id, message, tone }])
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 6000)
  }
  const dismiss = (id) => setToasts((current) => current.filter((toast) => toast.id !== id))
  return [toasts, push, dismiss]
}

export function ToastStack({ toasts, onDismiss }) {
  return <div class="toast-stack" aria-live="assertive">
    {toasts.map((toast) => <div class={`toast toast--${toast.tone}`} key={toast.id} role="status">
      <Icon name={toast.tone === 'urgent' ? 'alert' : toast.tone === 'success' ? 'check' : 'bell'} size={18} />
      <span>{toast.message}</span>
      <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification"><Icon name="x" size={16} /></button>
    </div>)}
  </div>
}

export function OfflineBanner({ isOnline, label = 'You are offline. Showing the last saved information.' }) {
  if (isOnline) return null
  return <div class="offline-banner" role="status"><Icon name="wifiOff" size={16} /> {label}</div>
}

export function downloadCsv(filename, rows) {
  const escape = (value) => {
    let text = value == null ? '' : String(value)
    // Report notes come from the public. Excel runs a cell starting with = + - @
    // as a formula, so those are prefixed with ' to keep them as plain text.
    // Plain numbers such as +639171234567 are safe and left as they are.
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text) && !/^[+-]?\d[\d .]*$/.test(text)) text = `'${text}`
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const csv = rows.map((row) => row.map(escape).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
