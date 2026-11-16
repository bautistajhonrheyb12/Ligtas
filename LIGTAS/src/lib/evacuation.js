// Finds the evacuation centers a person can reach soonest by road, avoiding
// verified closures and high-risk zones. A center that can only be reached
// through a hazard (or that sits inside one) gets no travel time.
import { avoidAreas } from './hazards.js'
import { distanceM } from './navigation.js'
import { requestTravelTimes } from './routing.js'

// Straight-line nearest candidates are checked by road; more would add little.
const MAX_CANDIDATES = 12

export async function travelTimesToCenters({ origin, centers, zones, mode = 'auto' }) {
  const candidates = centers
    .filter((center) => center.is_open && center.latitude != null)
    .sort((a, b) => distanceM(origin, [a.latitude, a.longitude]) - distanceM(origin, [b.latitude, b.longitude]))
    .slice(0, MAX_CANDIDATES)
  if (!candidates.length) return new Map()
  // Only zones around the person are left out, so they can always leave; a
  // hazard around a center makes that center unreachable.
  const areas = avoidAreas(zones, origin, origin)
  const times = await requestTravelTimes({ origin, targets: candidates.map((center) => [center.latitude, center.longitude]), mode, avoid: areas.polygons })
  return new Map(candidates.map((center, index) => [center.id, times[index]]))
}

// The open center with free space that is soonest to reach by road; a full
// center only when every reachable one is full.
export function pickNearestSafeCenter(centers, travelTimes) {
  const reachable = centers
    .filter((center) => travelTimes.get(center.id))
    .sort((a, b) => travelTimes.get(a.id).timeS - travelTimes.get(b.id).timeS)
  return reachable.find((center) => center.capacity - center.occupants > 0) ?? reachable[0] ?? null
}
