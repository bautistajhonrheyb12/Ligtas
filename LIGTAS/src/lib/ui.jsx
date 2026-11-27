import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { Icon, iconHtml } from './icons.jsx'

export function toAlertView(alert) {
  const accent = alert.severity === 'High' ? 'red' : alert.severity === 'Moderate' ? 'yellow' : 'blue'
  return {
    id: alert.id,
    type: alert.alert_type,
    // What an "Other" alert is about, such as "Chemical spill".
    typeOther: alert.alert_type_other ?? null,
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

// The alert types the database accepts; "Other" comes with what it is about.
export const ALERT_TYPES = ['Flood', 'Severe weather', 'Landslide', 'Road closure', 'Other']
const ALERT_TYPES_TL = { Flood: 'Baha', 'Severe weather': 'Masamang panahon', Landslide: 'Pagguho ng lupa', 'Road closure': 'Saradong daan', Other: 'Iba pa' }

// What an alert is about, as shown on cards: "Flood", or for "Other" what the
// sender wrote (such as "Chemical spill").
export function alertTypeLabel(alert, lang = 'en') {
  if (alert.type === 'Other' && alert.typeOther) return alert.typeOther
  return lang === 'tl' ? ALERT_TYPES_TL[alert.type] ?? alert.type : alert.type
}

// Still showing: no end time, or one that has not passed. Lists filter with
// this (and useMinuteClock), so an alert disappears as soon as it ends.
export function isCurrentAlert(alert, now = Date.now()) {
  return !alert.expiresAt || Date.parse(alert.expiresAt) > now
}

export function useMinuteClock() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])
  return now
}

// The current time for filtering alerts: it also moves forward the moment the
// next alert ends, so that alert disappears right on time.
export function useAlertClock(alerts) {
  const now = useMinuteClock()
  const [tick, setTick] = useState(0)
  const soonest = alerts.reduce((next, alert) => {
    const end = alert.expiresAt ? Date.parse(alert.expiresAt) : Infinity
    return end > Date.now() && end < next ? end : next
  }, Infinity)
  useEffect(() => {
    if (!Number.isFinite(soonest)) return undefined
    // Timers cannot wait longer than about 24 days; a day is plenty here.
    const timer = setTimeout(() => setTick((value) => value + 1), Math.min(soonest - Date.now() + 250, 86400000))
    return () => clearTimeout(timer)
  }, [soonest, tick])
  return Math.max(now, tick ? Date.now() : 0)
}

// When an alert ends, in words: "Ends today, 4:30 PM (in 3 h)".
export function alertEndText(expiresAt, now = Date.now()) {
  const end = new Date(expiresAt)
  const minutes = Math.max(0, Math.round((end.getTime() - now) / 60000))
  const left = minutes < 60 ? `${minutes} min` : minutes < 48 * 60 ? `${Math.round(minutes / 60)} h` : `${Math.round(minutes / 1440)} days`
  const sameDay = end.toDateString() === new Date(now).toDateString()
  const when = end.toLocaleString([], sameDay ? { hour: 'numeric', minute: '2-digit' } : { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return `${sameDay ? `today, ${when}` : when} (in ${left})`
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

// The categories residents choose from when they report, in this order. The
// value is what the database stores; 'Blocked road' and 'Medical' keep their
// stored names (their meaning is unchanged), so older reports stay as they were.
export const REPORT_CATEGORIES = ['Flooding', 'Fire', 'Vehicular accident', 'Medical', 'Rescue', 'Blocked road', 'Downed power line', 'Other']

export const reportTypeStyles = {
  Flooding: { icon: 'droplet', tone: 'blue' },
  Fire: { icon: 'fire', tone: 'red' },
  'Vehicular accident': { icon: 'car', tone: 'amber' },
  Medical: { icon: 'medical', tone: 'red' },
  Rescue: { icon: 'lifebuoy', tone: 'red' },
  'Blocked road': { icon: 'blocked', tone: 'amber' },
  'Downed power line': { icon: 'powerLine', tone: 'violet' },
  Other: { icon: 'alert', tone: 'blue' },
  // Categories that are no longer offered, for reports sent before.
  'Fallen tree': { icon: 'tree', tone: 'green' },
  'Power outage': { icon: 'bolt', tone: 'violet' },
  Landslide: { icon: 'mountain', tone: 'amber' },
  SOS: { icon: 'sos', tone: 'red' },
}

export function reportTypeStyle(type) {
  return reportTypeStyles[type] ?? { icon: 'alert', tone: 'red' }
}

// Staff wording for a category, and for one report (an "Others" report shows
// what the resident wrote, for example "Others: Gas leak").
export const REPORT_TYPE_LABELS = {
  Flooding: 'Flooding',
  Fire: 'Fire',
  'Vehicular accident': 'Vehicular Accident',
  Medical: 'Medical Emergency',
  Rescue: 'Rescue / Trapped',
  'Blocked road': 'Road Obstruction',
  'Downed power line': 'Downed Power Line',
  Other: 'Others',
  'Fallen tree': 'Fallen tree',
  'Power outage': 'Power outage',
  Landslide: 'Landslide',
  SOS: 'SOS',
}

export function reportTypeLabel(report) {
  const type = typeof report === 'string' ? report : report?.report_type
  const label = REPORT_TYPE_LABELS[type] ?? type ?? 'Report'
  const other = typeof report === 'object' ? report?.report_type_other : null
  return type === 'Other' && other ? `${label}: ${other}` : label
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

// The top of the sign-in, password and two-step cards: the mark and the name.
export function AuthBrand() {
  return <div class="auth-brand"><Logo small /><span>LIGTAS</span></div>
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

// While a staff map is full screen: Escape closes it (unless a dialog is open
// on top), and the page behind stops scrolling.
export function useFullscreenMap(isFullscreen, onExit) {
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit
  useEffect(() => {
    if (!isFullscreen) return undefined
    // Caught first and stopped, so Escape only closes the map (the admin menu
    // also closes on Escape).
    const onKey = (event) => {
      if (event.key !== 'Escape' || document.querySelector('.alert-modal-backdrop, .profile-backdrop')) return
      event.stopPropagation()
      onExitRef.current()
    }
    document.body.classList.add('has-fullscreen-map')
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.body.classList.remove('has-fullscreen-map')
      window.removeEventListener('keydown', onKey, true)
    }
  }, [isFullscreen])
}

// The button that opens a map full screen, and closes it with a clear label.
export function MapFullscreenButton({ isFullscreen, onToggle }) {
  return <button
    type="button"
    class={`map-fullscreen-btn${isFullscreen ? ' is-active' : ''}`}
    onClick={onToggle}
    aria-label={isFullscreen ? 'Exit full screen map' : 'Open full screen map'}
    title={isFullscreen ? 'Exit full screen (Esc)' : 'Open full screen map'}
  >
    <span class="map-fullscreen-icon" aria-hidden="true"><Icon name={isFullscreen ? 'collapse' : 'expand'} size={18} /></span>
    {isFullscreen && <span class="map-fullscreen-label">Exit full screen</span>}
  </button>
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
