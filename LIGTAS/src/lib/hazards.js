// Turns LIGTAS hazard information into areas that routing avoids or warns
// about. Only verified information changes the route:
//   closure – a verified blocked road: never routed through
//   hazard  – a verified active hazard (high-risk zone, verified flood, fire,
//             landslide): avoided, and a route through it is never called safe
//   caution – lower-risk zones and unverified reports: routes may pass, with a
//             warning
import { distanceM } from './navigation.js'
import { REPORT_TYPE_LABELS } from './ui.jsx'

// Radius of each kind of area, in metres. Points mark a spot on a road or the
// middle of an affected area, so closures are small and hazards larger.
const RADIUS = { closure: 35, hazardZone: 150, flood: 120, otherHazard: 100, caution: 100, lowCaution: 70, unverified: 80 }
// Valhalla limits avoided areas to 10 km of outline and 100 corner points in
// total; stay under both.
const MAX_OUTLINE_M = 9500
const MAX_VERTICES = 100
// Each area is sent as an octagon (9 points including the closing one).
const SIDES = 8

// A verified road obstruction (formerly "blocked road"; older fallen-tree
// reports too), vehicular accident or downed power line closes that spot.
const REPORT_CLOSURES = ['Blocked road', 'Fallen tree', 'Vehicular accident', 'Downed power line']
const REPORT_HAZARDS = ['Flooding', 'Landslide', 'Fire']

export function hazardZones({ points = [], reports = [] }) {
  const zones = []
  for (const point of points) {
    if (point.latitude == null) continue
    const base = { id: `point-${point.id}`, lat: point.latitude, lng: point.longitude, label: point.name, detail: point.description ?? '' }
    if (point.point_type === 'Closed road') {
      zones.push({ ...base, kind: 'closure', radiusM: RADIUS.closure, source: 'Closed road (official map point)' })
    } else if (point.point_type === 'Danger zone') {
      const kind = point.severity === 'High' ? 'hazard' : 'caution'
      const radiusM = point.severity === 'High' ? RADIUS.hazardZone : point.severity === 'Low' ? RADIUS.lowCaution : RADIUS.caution
      zones.push({ ...base, kind, radiusM, source: `${point.severity ?? ''} risk danger zone (official map point)`.trim() })
    }
  }
  for (const report of reports) {
    if (report.latitude == null || !['Pending', 'Verified'].includes(report.status)) continue
    const isClosure = REPORT_CLOSURES.includes(report.report_type)
    const isHazard = REPORT_HAZARDS.includes(report.report_type)
    if (!isClosure && !isHazard) continue
    const name = REPORT_TYPE_LABELS[report.report_type] ?? report.report_type
    const base = { id: `report-${report.id}`, lat: report.latitude, lng: report.longitude, label: name, detail: report.location ?? '' }
    if (report.status === 'Pending') {
      // Unverified: never closes a road, only warns.
      zones.push({ ...base, kind: 'caution', radiusM: RADIUS.unverified, source: `Unverified ${name.toLowerCase()} report` })
    } else if (isClosure) {
      zones.push({ ...base, kind: 'closure', radiusM: RADIUS.closure, source: `Verified ${name.toLowerCase()} report` })
    } else {
      zones.push({ ...base, kind: 'hazard', radiusM: report.report_type === 'Flooding' ? RADIUS.flood : RADIUS.otherHazard, source: `Verified ${name.toLowerCase()} report` })
    }
  }
  return zones
}

const containsPoint = (zone, point) => distanceM([zone.lat, zone.lng], point) <= zone.radiusM

// A ring of [longitude, latitude] pairs around the zone, as Valhalla expects.
// The polygon is made just large enough to contain the whole circle.
function zoneRing(zone, sides = SIDES) {
  const radius = zone.radiusM / Math.cos(Math.PI / sides)
  const metersPerDegLat = 110540
  const metersPerDegLng = 111320 * Math.cos(zone.lat * Math.PI / 180)
  const ring = Array.from({ length: sides }, (_, k) => {
    const angle = (k / sides) * 2 * Math.PI
    return [zone.lng + (radius / metersPerDegLng) * Math.cos(angle), zone.lat + (radius / metersPerDegLat) * Math.sin(angle)]
  })
  return [...ring, ring[0]]
}

// Picks the areas to send to the router. Areas containing the start or the
// destination are left out (someone evacuating from a flood zone must be able
// to leave it) and returned separately so the person can be warned. When
// there are more areas than the router accepts, closures come first, then the
// hazards nearest the trip.
export function avoidAreas(zones, origin, destination) {
  const containing = []
  const candidates = []
  for (const zone of zones) {
    if (zone.kind === 'caution') continue
    if (containsPoint(zone, origin) || containsPoint(zone, destination)) containing.push(zone)
    else candidates.push(zone)
  }
  const tripMid = [(origin[0] + destination[0]) / 2, (origin[1] + destination[1]) / 2]
  candidates.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'closure' ? -1 : 1)
    || distanceM([a.lat, a.lng], tripMid) - distanceM([b.lat, b.lng], tripMid))
  const used = []
  const skipped = []
  let outline = 0
  let vertices = 0
  for (const zone of candidates) {
    const zoneOutline = 2 * SIDES * (zone.radiusM / Math.cos(Math.PI / SIDES)) * Math.sin(Math.PI / SIDES)
    if (outline + zoneOutline > MAX_OUTLINE_M || vertices + SIDES + 1 > MAX_VERTICES) {
      skipped.push(zone)
      continue
    }
    outline += zoneOutline
    vertices += SIDES + 1
    used.push(zone)
  }
  return { polygons: used.map((zone) => zoneRing(zone)), used, skipped, containing }
}

// Shortest distance from a point to the route line (approximate, metres).
function distanceToRoute(point, coords) {
  let best = Infinity
  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = coords[i]
    const b = coords[i + 1]
    const k = Math.cos(point[0] * Math.PI / 180)
    const dx = (b[1] - a[1]) * k
    const dy = b[0] - a[0]
    const lengthSq = dx * dx + dy * dy
    const t = lengthSq ? Math.max(0, Math.min(1, (((point[1] - a[1]) * k) * dx + (point[0] - a[0]) * dy) / lengthSq)) : 0
    best = Math.min(best, distanceM(point, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]))
  }
  return best
}

// The zones a route passes through or close to (within their radius).
export function routeExposure(coords, zones) {
  return zones.filter((zone) => distanceToRoute([zone.lat, zone.lng], coords) <= zone.radiusM)
}

// Where along the route each zone it passes begins (metres from the start),
// for "hazard ahead" warnings while navigating. Sorted from first to last.
export function hazardsAlongRoute(route, zones) {
  return routeExposure(route.coords, zones).map((zone) => {
    const center = [zone.lat, zone.lng]
    let closestIndex = 0
    let closest = Infinity
    route.coords.forEach((point, index) => {
      const distance = distanceM(point, center)
      if (distance < closest) {
        closest = distance
        closestIndex = index
      }
    })
    return { zone, alongM: Math.max(0, route.cumulative[closestIndex] - zone.radiusM) }
  }).sort((a, b) => a.alongM - b.alongM)
}
