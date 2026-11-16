// Navigation math: where the person is along the route, what the next turn
// is, and when they have left the route. Pure functions with no browser or
// map dependencies, so they can be tested on their own.

const EARTH_RADIUS_M = 6371000
const toRad = (deg) => deg * Math.PI / 180

// Points are [latitude, longitude].
export function distanceM(a, b) {
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Compass bearing from a to b, 0–360 degrees (0 = north, 90 = east).
export function bearing(a, b) {
  const y = Math.sin(toRad(b[1] - a[1])) * Math.cos(toRad(b[0]))
  const x = Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) - Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(toRad(b[1] - a[1]))
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

// The point `meters` away from `from` in direction `heading`.
export function offsetPoint(from, heading, meters) {
  const d = meters / EARTH_RADIUS_M
  const h = toRad(heading)
  const lat1 = toRad(from[0])
  const lng1 = toRad(from[1])
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(h))
  const lng2 = lng1 + Math.atan2(Math.sin(h) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
  return [lat2 * 180 / Math.PI, lng2 * 180 / Math.PI]
}

// Distance along the route to each of its points.
export function cumulativeDistances(coords) {
  const out = [0]
  for (let i = 1; i < coords.length; i += 1) out.push(out[i - 1] + distanceM(coords[i - 1], coords[i]))
  return out
}

// Closest point to p on the segment a–b, using a flat local projection
// (accurate to centimetres over the length of a road segment).
function projectOnSegment(p, a, b) {
  const k = Math.cos(toRad(p[0]))
  const ax = a[1] * k
  const ay = a[0]
  const dx = b[1] * k - ax
  const dy = b[0] - ay
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq ? Math.max(0, Math.min(1, ((p[1] * k - ax) * dx + (p[0] - ay) * dy) / lengthSq)) : 0
  return { t, point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] }
}

// Snaps a GPS point onto the route. Searches near the last known segment
// first (fast, and avoids jumping to a part of the route that passes nearby
// later on); searches the whole route when that finds nothing close.
export function projectOnRoute(point, coords, cumulative, hintIndex = 0) {
  const best = { index: 0, t: 0, snapped: coords[0], offsetM: Infinity, alongM: 0 }
  const scan = (from, to) => {
    for (let i = Math.max(0, from); i < Math.min(coords.length - 1, to); i += 1) {
      const { t, point: snapped } = projectOnSegment(point, coords[i], coords[i + 1])
      const offset = distanceM(point, snapped)
      if (offset < best.offsetM) {
        Object.assign(best, { index: i, t, snapped, offsetM: offset, alongM: cumulative[i] + (cumulative[i + 1] - cumulative[i]) * t })
      }
    }
  }
  scan(hintIndex - 5, hintIndex + 80)
  if (best.offsetM > 60) scan(0, coords.length - 1)
  return best
}

// Which step of the turn-by-turn list the person is on, how far the next
// turn is, and how much distance and time remain.
export function routeProgress(route, alongM) {
  const { maneuvers, cumulative } = route
  const total = cumulative[cumulative.length - 1]
  const along = Math.max(0, Math.min(total, alongM))
  let current = 0
  for (let i = 0; i < maneuvers.length; i += 1) {
    if (cumulative[maneuvers[i].beginIndex] <= along + 0.5) current = i
  }
  const next = maneuvers[current + 1] ?? null
  const nextStartM = next ? cumulative[next.beginIndex] : total
  const step = maneuvers[current]
  const stepStart = cumulative[step.beginIndex]
  const stepLength = Math.max(1, nextStartM - stepStart)
  const stepLeft = Math.max(0, nextStartM - along)
  let remainingTimeS = step.timeS * (stepLeft / stepLength)
  for (let i = current + 1; i < maneuvers.length; i += 1) remainingTimeS += maneuvers[i].timeS
  return {
    currentIndex: current,
    current: step,
    next,
    distanceToNextM: stepLeft,
    remainingM: total - along,
    remainingTimeS,
    // The road the person is on now is the road the current step travels.
    roadName: step.streets[0] ?? null,
  }
}

// GPS quality from the reported accuracy and how old the last fix is.
export function gpsQuality(accuracyM, ageMs) {
  if (accuracyM == null || ageMs > 15000) return 'lost'
  if (accuracyM <= 20) return 'good'
  if (accuracyM <= 50) return 'fair'
  return 'poor'
}

// Decides when the person has really left the route. A single far-off fix is
// usually GPS drift, so it takes several fixes in a row, or 10 seconds,
// beyond a threshold that grows with GPS inaccuracy. Fixes too inaccurate to
// judge (over 60 m) are ignored.
export function createDeviationTracker({ minThresholdM = 35, needFixes = 3, needMs = 10000 } = {}) {
  let offSince = null
  let offCount = 0
  return {
    update(offsetM, accuracyM, now) {
      if (accuracyM != null && accuracyM > 60) return false
      const threshold = Math.max(minThresholdM, (accuracyM ?? 0) * 1.5)
      if (offsetM <= threshold) {
        offSince = null
        offCount = 0
        return false
      }
      offSince ??= now
      offCount += 1
      return offCount >= needFixes || now - offSince >= needMs
    },
    reset() {
      offSince = null
      offCount = 0
    },
  }
}

// Voice prompt distances for the next turn: a heads-up, a reminder, and "now".
export function announcementStages(mode) {
  return mode === 'pedestrian' ? [{ id: 'near', atM: 60 }, { id: 'now', atM: 15 }] : [{ id: 'far', atM: 500 }, { id: 'near', atM: 160 }, { id: 'now', atM: 40 }]
}

// The voice stage due now for the next turn, or null. `spoken` is the set of
// "maneuverIndex:stage" prompts already given.
export function dueAnnouncement(progress, mode, spoken) {
  if (!progress.next) return null
  const index = progress.currentIndex + 1
  const due = announcementStages(mode).filter((stage) => progress.distanceToNextM <= stage.atM)
  const stage = due[due.length - 1]
  if (!stage) return null
  const key = `${index}:${stage.id}`
  if (spoken.has(key)) return null
  // A later stage makes earlier ones pointless.
  due.forEach((item) => spoken.add(`${index}:${item.id}`))
  return { key, stage: stage.id, maneuver: progress.next }
}

// Formats a distance for instructions: "350 m", "1.2 km".
export function formatMeters(meters) {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`
}

// Formats a duration: "4 min", "1 h 05 min".
export function formatMinutes(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
}
