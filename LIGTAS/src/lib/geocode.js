// Turns a pinned spot into an address people can act on: the street, the
// subdivision, the barangay and a nearby landmark. Uses OpenStreetMap's
// Nominatim service, which asks apps for at most one request a second, so
// lookups are spaced out and cached, and a newer pin cancels an older lookup.
//
// Many small streets in Santa Maria have no name on the map. Then the routing
// server finds the nearest named road, and the address says how far it is.
import { requestNearbyRoads } from './routing.js'

export const GEOCODER_URL = 'https://nominatim.openstreetmap.org/reverse'

const MIN_GAP_MS = 1100
const TIMEOUT_MS = 8000
// A named place this far from the pin (or closer) is mentioned as "near".
const LANDMARK_RANGE_M = 150
// A named road this far from the pin (or closer) is mentioned with its distance.
const ROAD_RANGE_M = 300
const MAX_LENGTH = 160
// Results that are not landmarks (roads, areas, boundaries).
const NOT_LANDMARKS = new Set(['highway', 'boundary', 'place', 'landuse', 'natural', 'waterway', 'railway'])

let nextSlot = 0
const cache = new Map()

function abortError() {
  return new DOMException('The lookup was cancelled.', 'AbortError')
}

// Waits for this request's turn, so requests are at least MIN_GAP_MS apart.
function takeSlot(signal) {
  const now = Date.now()
  const at = Math.max(now, nextSlot)
  nextSlot = at + MIN_GAP_MS
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    const timer = setTimeout(resolve, at - now)
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(abortError()) }, { once: true })
  })
}

async function reverse(latitude, longitude, signal) {
  await takeSlot(signal)
  const params = new URLSearchParams({ format: 'jsonv2', lat: latitude, lon: longitude, zoom: 18, addressdetails: 1, 'accept-language': 'en' })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  signal?.addEventListener('abort', () => controller.abort(), { once: true })
  try {
    const response = await fetch(`${GEOCODER_URL}?${params}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`The address service answered ${response.status}.`)
    const data = await response.json()
    if (data.error) throw new Error(data.error)
    return data
  } catch (error) {
    if (signal?.aborted) throw abortError()
    // A timeout is a failure the person should hear about, not a cancellation.
    throw controller.signal.aborted ? new Error('The address service took too long to answer.') : error
  } finally {
    clearTimeout(timer)
  }
}

// Metres between two [lat, lng] points, on a flat local projection (fine at
// these distances).
function metresBetween(a, b) {
  const scale = Math.cos(((a[0] + b[0]) / 2) * Math.PI / 180)
  return Math.hypot((b[1] - a[1]) * 111320 * scale, (b[0] - a[0]) * 111320)
}

const roundTo = (value, step) => Math.max(step, Math.round(value / step) * step)

function barangayName(name) {
  if (!name) return null
  return /^(brgy\.?|barangay)\s/i.test(name) ? name : `Brgy. ${name}`
}

// "Street, subdivision, Brgy. X, Santa Maria (near landmark, about 120 m from
// Road)", dropping the least useful parts until it fits the location field.
function formatLabel(parts) {
  const current = { ...parts }
  const text = () => {
    const main = [current.street, current.area, barangayName(current.barangay), current.town].filter(Boolean).join(', ')
    const notes = [
      current.landmark && `near ${current.landmark}`,
      current.nearRoad && `about ${current.nearRoad.distanceM} m from ${current.nearRoad.name}`,
    ].filter(Boolean).join(', ')
    return notes ? `${main} (${notes})` : main
  }
  for (const key of ['town', 'area', 'landmark']) {
    if (text().length <= MAX_LENGTH) break
    current[key] = null
  }
  return text().slice(0, MAX_LENGTH)
}

// { label, barangay, street, landmark, nearRoad } for a spot. onPartial is
// called with the address as soon as it is known, before the nearest named
// road (which may take another second or two). Throws when the lookup fails
// (for example, offline), or an AbortError when cancelled.
export async function describeLocation(latitude, longitude, { signal, onPartial } = {}) {
  const key = `${latitude.toFixed(5)},${longitude.toFixed(5)}`
  if (cache.has(key)) return cache.get(key)
  const point = [latitude, longitude]

  const here = await reverse(latitude, longitude, signal)
  const address = here.address ?? {}
  const road = address.road ?? address.pedestrian ?? address.footway ?? null
  const parts = {
    street: road ? [address.house_number, road].filter(Boolean).join(' ') : null,
    barangay: address.quarter ?? address.village ?? address.suburb ?? address.city_district ?? null,
    area: null,
    town: address.town ?? address.city ?? address.municipality ?? null,
    landmark: null,
    nearRoad: null,
  }
  parts.area = [address.neighbourhood, address.residential, address.hamlet, address.isolated_dwelling]
    .find((name) => name && name !== parts.barangay) ?? null
  if (here.name && !NOT_LANDMARKS.has(here.category) && here.name !== road) {
    // A building or compound is reported by its centre, so only single points
    // (shops, offices, landmarks) are held to the distance limit.
    const distance = metresBetween(point, [Number(here.lat), Number(here.lon)])
    if (here.osm_type !== 'node' || distance <= LANDMARK_RANGE_M) parts.landmark = here.name
  }
  const result = () => ({ label: formatLabel(parts), barangay: parts.barangay, street: parts.street, landmark: parts.landmark, nearRoad: parts.nearRoad })
  if (!formatLabel(parts)) throw new Error('No address was found for this spot.')

  // The street at the pin has no name: find the nearest named road.
  if (!road) {
    onPartial?.(result())
    try {
      const [closest] = await requestNearbyRoads({ latitude, longitude, signal })
      if (closest && closest.distanceM <= ROAD_RANGE_M) parts.nearRoad = { name: closest.name, distanceM: roundTo(closest.distanceM, 10) }
    } catch {
      if (signal?.aborted) throw abortError()
      // The address alone is still useful.
    }
  }

  const final = result()
  cache.set(key, final)
  return final
}

// Text for the location field when no address can be found (offline, or the
// lookup failed): the exact pinned spot.
export function coordinatesLabel(latitude, longitude) {
  return `Pinned location ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
}
