import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'

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

export function alertSymbol(alert) {
  if (alert.type === 'Severe weather') return '⚡'
  if (alert.type === 'Road closure') return '↗'
  return '!'
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

export const iconPaths = {
  droplet: <path d="M12 2.7l5.7 5.6a8 8 0 1 1-11.4 0z" />,
  blocked: <><circle cx="12" cy="12" r="9.5" /><path d="M5.3 5.3l13.4 13.4" /></>,
  tree: <path d="M12 22v-5M12 2.5L6.5 10h3.5l-4.5 7h13l-4.5-7h3.5z" />,
  bolt: <path d="M13 2L3.5 14H12l-1 8 9.5-12H12z" />,
  alert: <><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
  pin: <><path d="M20 10c0 6.5-8 12-8 12s-8-5.5-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>,
  navigate: <path d="M3 11l19-9-9 19-2-8z" />,
  check: <path d="M20 6L9 17l-5-5" />,
  map: <><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4z" /><path d="M8 2v16M16 6v16" /></>,
  bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  calls: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M9 12h6M9 16h4" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  clock: <><circle cx="12" cy="12" r="9.5" /><path d="M12 6.5V12l3.5 2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: <><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  home: <><path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></>,
  phone: <path d='M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z' />,
  camera: <><path d='M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z' /><circle cx='12' cy='13' r='4' /></>,
  locate: <><circle cx='12' cy='12' r='3' /><circle cx='12' cy='12' r='8' /><path d='M12 1v3M12 20v3M1 12h3M20 12h3' /></>,
  heart: <path d='M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z' />,
  sos: <><circle cx='12' cy='12' r='10' /><path d='M12 7v6M12 16.5h.01' /></>,
  list: <path d='M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' />,
  download: <><path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' /><path d='M7 10l5 5 5-5M12 15V3' /></>,
  userPlus: <><path d='M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' /><circle cx='8.5' cy='7' r='4' /><path d='M20 8v6M23 11h-6' /></>,
  users: <><path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' /><circle cx='9' cy='7' r='4' /><path d='M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8' /></>,
  trash: <><path d='M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6' /></>,
  edit: <><path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' /><path d='M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z' /></>,
  chart: <path d='M18 20V10M12 20V4M6 20v-6' />,
  history: <><path d='M3 3v5h5' /><path d='M3.1 13A9 9 0 1 0 6 5.3L3 8' /><path d='M12 7v5l4 2' /></>,
  bag: <><path d='M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z' /><path d='M3 6h18M16 10a4 4 0 0 1-8 0' /></>,
  globe: <><circle cx='12' cy='12' r='10' /><path d='M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z' /></>,
  wifiOff: <><path d='M1 1l22 22M16.7 11.1A11 11 0 0 1 19 12.6M5 12.6a11 11 0 0 1 5.2-2.5M10.7 5A16 16 0 0 1 22.6 9M1.4 9a16 16 0 0 1 4.7-2.9M8.5 16.1a6 6 0 0 1 7 0M12 20h.01' /></>,
  x: <path d='M18 6L6 18M6 6l12 12' />,
  user: <><path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' /><circle cx='12' cy='7' r='4' /></>,
  fire: <path d='M12 22c4 0 7-2.7 7-7 0-4-3-6.5-4-9-1 2-2 3-3.5 3.5C11 7 11 4 9 2 9 6 5 9 5 15c0 4.3 3 7 7 7z' />,
  medical: <><rect x='3' y='3' width='18' height='18' rx='4' /><path d='M12 8v8M8 12h8' /></>,
  mountain: <path d='M8 3l4 8 5-5 5 15H2z' />,
}

export function Icon({ name, size = 20 }) {
  return <svg class="ui-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{iconPaths[name]}</svg>
}

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

// Same rule as Supabase's password settings (see SETUP.md); returns '' when fine.
export function passwordProblem(password) {
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use both letters and numbers in your password'
  return ''
}

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This device cannot share its location.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      (error) => reject(new Error(locationErrorMessage(error))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    )
  })
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
          setPosition({ latitude: next.coords.latitude, longitude: next.coords.longitude, accuracy: next.coords.accuracy })
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
