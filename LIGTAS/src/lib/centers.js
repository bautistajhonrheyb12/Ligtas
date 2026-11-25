// Evacuation center details shared by every screen: whether a center is an
// official evacuation center or a temporary site, what kind of facility it is,
// and how sure we are of its capacity and map location. Estimates are always
// shown as estimates, and a capacity nobody has established is shown as
// unconfirmed, never as a number.

// Santa Maria's 24 barangays, as the evacuation center inventory names them
// ("Sto. Tomas" was formerly Tabing Bakod).
export const BARANGAYS = [
  'Bagbaguin', 'Balasing', 'Buenavista', 'Bulac', 'Camangyanan', 'Catmon', 'Caypombo', 'Caysio',
  'Guyong', 'Lalakhan', 'Mag-asawang Sapa', 'Mahabang Parang', 'Manggahan', 'Parada', 'Poblacion',
  'Pulong Buhangin', 'San Gabriel', 'San Jose Patag', 'San Vicente', 'Santa Clara', 'Santa Cruz',
  'Santo Tomas', 'Silangan', 'Tumana',
]

export const FACILITY_TYPES = ['evacuation_center', 'covered_court', 'school', 'chapel', 'barangay_hall', 'other']
const FACILITY_LABELS = {
  en: { evacuation_center: 'Evacuation center', covered_court: 'Covered court', school: 'School', chapel: 'Chapel', barangay_hall: 'Barangay hall', other: 'Other facility' },
  tl: { evacuation_center: 'Evacuation center', covered_court: 'Covered court', school: 'Paaralan', chapel: 'Kapilya', barangay_hall: 'Barangay hall', other: 'Ibang pasilidad' },
}
export const facilityTypeLabel = (type, lang = 'en') => (FACILITY_LABELS[lang] ?? FACILITY_LABELS.en)[type] ?? FACILITY_LABELS.en.other

// MDRRMO guidance for estimating capacity when no official figure exists.
// These are starting points, not measured limits.
export const CAPACITY_GUIDES = [
  { id: 'court', label: 'Covered court', low: 100, high: 150 },
  { id: 'large-chapel', label: 'Larger chapel', low: 100, high: 150 },
  { id: 'small-chapel', label: 'Smaller chapel', low: 50, high: 100 },
]
export const MDRRMO_GUIDANCE = 'MDRRMO guidance'

export const isOfficial = (center) => center.classification === 'official'
// Centers saved before classification existed have none.
export const classificationOf = (center) => center.classification ?? null

// The capacity as { status, low, high }: documented (low = high = the official
// figure), estimated (a range) or unverified (no numbers).
export function centerCapacity(center) {
  const status = center.capacity_status ?? (center.capacity != null ? 'documented' : 'unverified')
  if (status === 'documented' && center.capacity != null) return { status, low: center.capacity, high: center.capacity }
  if (status === 'estimated' && center.capacity != null) return { status, low: center.capacity, high: center.capacity_max ?? center.capacity }
  return { status: 'unverified', low: null, high: null }
}

// How full a center is. With an estimate, fullness is measured against the low
// end, so a center reads "near capacity" early rather than late.
export function centerLoad(center) {
  const { status, low, high } = centerCapacity(center)
  if (status === 'unverified') return { status, level: 'unknown', percent: null, spaceLow: null, spaceHigh: null }
  const ratio = center.occupants / low
  const level = ratio >= 0.85 ? 'critical' : ratio >= 0.6 ? 'busy' : 'open'
  return {
    status,
    level,
    percent: Math.min(100, Math.round(ratio * 100)),
    spaceLow: Math.max(low - center.occupants, 0),
    spaceHigh: Math.max(high - center.occupants, 0),
  }
}

// Not known to be full: where people may still be sent. A center whose capacity
// is not confirmed is not assumed to be full.
export function mayHaveRoom(center) {
  const { status, high } = centerCapacity(center)
  return status === 'unverified' || center.occupants < high
}

// The most a center can be set to hold (for the occupant buttons).
export function occupantLimit(center) {
  const { status, high } = centerCapacity(center)
  return status === 'unverified' ? 100000 : high
}

export const hasPin = (center) => center.latitude != null && center.longitude != null
export const locationStatusOf = (center) => center.location_status ?? (hasPin(center) ? 'unconfirmed' : 'unknown')

// Many facilities share a generic name ("Covered Court"), so lists add the
// barangay unless the name already says it.
export function centerTitle(center) {
  const barangay = center.barangay
  if (!barangay) return center.name
  const plain = (text) => text.toLowerCase().replace(/^sta\.?\s/, 'santa ').replace(/^sto\.?\s/, 'santo ')
  const name = center.name.toLowerCase().replace(/\bsta\.?\s/g, 'santa ').replace(/\bsto\.?\s/g, 'santo ')
  return name.includes(plain(barangay)) ? center.name : `${center.name}, ${barangay}`
}

// The same facility: same barangay and the same name ignoring case, spaces and
// punctuation (the database refuses these too).
const nameKey = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '')
export function findDuplicate(centers, { id, name, barangay }) {
  return centers.find((center) => center.id !== id && nameKey(center.name) === nameKey(name) && (center.barangay ?? '') === (barangay ?? '')) ?? null
}

// Phone numbers as written ("0961-074-1391 / 0931-725-9296"), for tap-to-call.
export function contactNumbers(center) {
  return (center.contact_numbers ?? '').split(/\s*[/,;]\s*/).map((text) => text.trim()).filter(Boolean)
    .map((text) => ({ text, tel: text.replace(/[^\d+]/g, '') }))
    .filter((number) => number.tel.length >= 7)
}

// Counts for summaries; estimated and documented capacity are kept apart.
export function centerSummary(centers) {
  const sum = { total: centers.length, official: 0, temporary: 0, unclassified: 0, open: 0, onMap: 0, pinConfirmed: 0, needsLocation: 0,
    documented: { count: 0, capacity: 0 }, estimated: { count: 0, low: 0, high: 0 }, unverified: 0, sheltered: 0 }
  for (const center of centers) {
    const kind = classificationOf(center)
    if (kind === 'official') sum.official++
    else if (kind === 'temporary') sum.temporary++
    else sum.unclassified++
    if (center.is_open) sum.open++
    if (hasPin(center)) sum.onMap++
    else sum.needsLocation++
    if (locationStatusOf(center) === 'confirmed') sum.pinConfirmed++
    const { status, low, high } = centerCapacity(center)
    if (status === 'documented') { sum.documented.count++; sum.documented.capacity += low }
    else if (status === 'estimated') { sum.estimated.count++; sum.estimated.low += low; sum.estimated.high += high }
    else sum.unverified++
    sum.sheltered += center.occupants ?? 0
  }
  return sum
}

export const formatRange = (low, high) => (low === high ? low.toLocaleString() : `${low.toLocaleString()}–${high.toLocaleString()}`)
