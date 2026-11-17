import { useEffect, useRef, useState } from 'preact/hooks'
import { distanceM } from './navigation.js'
import { isInsideSantaMaria } from './santaMaria.js'
import { shareSosLocation } from './supabase.js'

// After an SOS, while LIGTAS stays open, the phone keeps sending its position
// so rescuers find the person even if they move (for example, up to a roof or
// to a neighbour's house). It sends when the person has moved, and at least
// once a minute so rescuers can see the position is current. The database
// accepts it only for the person's own open SOS, at most every 10 seconds,
// for up to 6 hours. The person can stop sharing at any time.

const WINDOW_MS = 6 * 60 * 60 * 1000
const MIN_MOVE_M = 15
const HEARTBEAT_MS = 60 * 1000
// A fix vaguer than this would not help rescuers.
const MAX_ACCURACY_M = 500
const STOPPED_KEY = 'ligtas-sos-live-stopped'

function readStopped() {
  try {
    return JSON.parse(localStorage.getItem(STOPPED_KEY)) ?? []
  } catch {
    return []
  }
}

export function useSosLiveShare({ reports, position, isOnline }) {
  const [stopped, setStopped] = useState(readStopped)
  const [savedAt, setSavedAt] = useState(null)
  const [, setTick] = useState(0)
  const live = useRef({ sosId: null, lastPoint: null, lastAt: 0, busy: false, unavailable: false })

  const active = reports.find((report) => report.report_type === 'SOS'
    && report.status === 'Verified'
    && Date.now() - new Date(report.created_at).getTime() < WINDOW_MS
    && !stopped.includes(report.id)) ?? null

  // A standing person's phone may report no new position for a while; this
  // wakes the check up so the minute-by-minute update still goes out.
  useEffect(() => {
    if (!active) return undefined
    const timer = setInterval(() => setTick((value) => value + 1), 20000)
    return () => clearInterval(timer)
  }, [active?.id])

  useEffect(() => {
    const state = live.current
    if (!active || !position || !isOnline || state.busy || state.unavailable) return
    if (state.sosId !== active.id) {
      Object.assign(state, { sosId: active.id, lastPoint: null, lastAt: 0 })
      setSavedAt(null)
    }
    if (position.accuracy > MAX_ACCURACY_M || !isInsideSantaMaria(position.latitude, position.longitude)) return
    const point = [position.latitude, position.longitude]
    const moved = state.lastPoint ? distanceM(state.lastPoint, point) : Infinity
    const due = moved >= Math.max(MIN_MOVE_M, Math.min(position.accuracy, 100) / 2) || Date.now() - state.lastAt >= HEARTBEAT_MS
    if (!due) return
    state.busy = true
    shareSosLocation({ sosId: active.id, latitude: point[0], longitude: point[1], accuracy: position.accuracy })
      .then((saved) => {
        if (!saved) return
        Object.assign(state, { lastPoint: point, lastAt: Date.now() })
        setSavedAt(Date.now())
      })
      .catch((error) => {
        if (!error.final) return
        // Not set up in the database yet: try again next time the app opens.
        if (error.code === 'PGRST202') state.unavailable = true
        // The SOS was closed: nothing more to share for it.
        else setStopped((current) => [...current, active.id])
      })
      .finally(() => { state.busy = false })
  })

  const stop = () => {
    if (!active) return
    const next = [...stopped, active.id]
    setStopped(next)
    setSavedAt(null)
    try {
      localStorage.setItem(STOPPED_KEY, JSON.stringify(next.slice(-20)))
    } catch {
      // Sharing simply resumes if the app is reopened.
    }
  }

  return { sharing: active && savedAt ? active : null, savedAt, stop }
}
