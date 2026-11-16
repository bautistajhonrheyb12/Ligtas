// Road routing with Valhalla (open source, OpenStreetMap road data). Routes
// follow real roads and respect one-way streets and turn restrictions; the
// router also returns alternatives, turn-by-turn steps and can avoid areas.
//
// By default this uses the free public server run by FOSSGIS, which is meant
// for light use (about one request per second, no guarantees). An LGU running
// its own Valhalla server sets VITE_ROUTING_URL to use it instead.
import { cumulativeDistances } from './navigation.js'

const env = import.meta.env ?? {}
export const ROUTING_URL = (env.VITE_ROUTING_URL || 'https://valhalla1.openstreetmap.de').replace(/\/$/, '')
export const ROUTING_ATTRIBUTION = 'Routing: Valhalla · Road data © OpenStreetMap contributors'

// At most one request every 1.5 seconds, and none takes longer than 15 seconds.
const MIN_GAP_MS = 1500
const TIMEOUT_MS = 15000
let lastRequestAt = 0

export class RoutingError extends Error {
  constructor(kind, message) {
    super(message)
    this.kind = kind
  }
}

// Valhalla encodes route lines as polylines with six decimal places.
export function decodePolyline(encoded, precision = 6) {
  const factor = 10 ** precision
  const coords = []
  let index = 0
  let lat = 0
  let lng = 0
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let shift = 0
      let result = 0
      let byte
      do {
        byte = encoded.charCodeAt(index++) - 63
        result |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20)
      const delta = result & 1 ? ~(result >> 1) : result >> 1
      if (axis === 0) lat += delta
      else lng += delta
    }
    coords.push([lat / factor, lng / factor])
  }
  return coords
}

function parseTrip(trip) {
  const leg = trip.legs[0]
  const coords = decodePolyline(leg.shape)
  const maneuvers = leg.maneuvers.map((maneuver) => ({
    type: maneuver.type,
    instruction: maneuver.instruction,
    verbal: maneuver.verbal_pre_transition_instruction || maneuver.instruction,
    streets: maneuver.street_names ?? [],
    beginIndex: maneuver.begin_shape_index,
    endIndex: maneuver.end_shape_index,
    lengthM: maneuver.length * 1000,
    timeS: maneuver.time,
  }))
  // The road the route uses longest, for "via ..." in route choices.
  const byStreet = new Map()
  maneuvers.forEach((maneuver) => maneuver.streets[0] && byStreet.set(maneuver.streets[0], (byStreet.get(maneuver.streets[0]) ?? 0) + maneuver.lengthM))
  const via = [...byStreet.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  return { coords, cumulative: cumulativeDistances(coords), maneuvers, distanceM: trip.summary.length * 1000, timeS: trip.summary.time, via }
}

function errorFor(status, body) {
  const code = body?.error_code
  if (code === 171) return new RoutingError('no-road', 'There is no road near this place, so it cannot be reached by road.')
  if (code === 442 || code === 443) return new RoutingError('no-route', 'No road route connects your location to this place.')
  if (status === 429) return new RoutingError('busy', 'The routing service is busy. Try again in a moment.')
  return new RoutingError('service', `The routing service could not plan this route${body?.error ? ` (${body.error})` : ''}.`)
}

// Waits so requests to the public server stay spaced out.
async function takeTurn() {
  const wait = lastRequestAt + MIN_GAP_MS - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastRequestAt = Date.now()
}

// Travel time and distance by road from origin to each target, in one
// request, avoiding the `avoid` polygons. Returns one entry per target:
// { distanceM, timeS }, or null when no road route reaches it.
export async function requestTravelTimes({ origin, targets, mode = 'auto', avoid = [], signal }) {
  await takeTurn()
  const body = {
    sources: [{ lat: origin[0], lon: origin[1] }],
    targets: targets.map(([lat, lon]) => ({ lat, lon, search_cutoff: 500 })),
    costing: mode === 'pedestrian' ? 'pedestrian' : 'auto',
  }
  if (avoid.length) body.exclude_polygons = avoid
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS)
  signal?.addEventListener('abort', () => timeout.abort())
  let response
  try {
    response = await fetch(`${ROUTING_URL}/sources_to_targets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: timeout.signal,
    })
  } catch {
    throw new RoutingError(signal?.aborted ? 'cancelled' : 'offline', 'Cannot reach the routing service. Check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }
  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.sources_to_targets) throw errorFor(response.status, json)
  return json.sources_to_targets[0].map((cell) => (cell.time == null ? null : { distanceM: cell.distance * 1000, timeS: cell.time }))
}

// Plans routes from origin to destination ([lat, lng] each). `avoid` is a list
// of polygons ([lng, lat] rings) the routes must not enter. `heading` (degrees)
// tells the router which way the person is already travelling, so a reroute
// does not start with a U-turn. Returns the main route first, then alternatives.
export async function requestRoutes({ origin, destination, mode = 'auto', avoid = [], alternatives = 2, heading = null, signal }) {
  await takeTurn()

  const start = { lat: origin[0], lon: origin[1], type: 'break' }
  if (heading != null) Object.assign(start, { heading: Math.round(heading), heading_tolerance: 60 })
  // A destination more than 500 m from any road counts as unreachable.
  const end = { lat: destination[0], lon: destination[1], type: 'break', search_cutoff: 500 }
  const body = {
    locations: [start, end],
    costing: mode === 'pedestrian' ? 'pedestrian' : 'auto',
    alternates: alternatives,
    directions_options: { units: 'kilometers', language: 'en-US' },
  }
  if (avoid.length) body.exclude_polygons = avoid

  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS)
  signal?.addEventListener('abort', () => timeout.abort())
  let response
  try {
    response = await fetch(`${ROUTING_URL}/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: timeout.signal,
    })
  } catch (error) {
    if (signal?.aborted) throw new RoutingError('cancelled', 'Cancelled.')
    throw new RoutingError('offline', timeout.signal.aborted
      ? 'The routing service took too long to answer. Check your connection and try again.'
      : 'Cannot reach the routing service. Check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }

  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.trip) throw errorFor(response.status, json)
  return [json.trip, ...(json.alternates ?? []).map((alternate) => alternate.trip)].map(parseTrip)
}
