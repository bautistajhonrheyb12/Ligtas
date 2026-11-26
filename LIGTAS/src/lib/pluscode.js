// Reads a location pasted from Google Maps: a plus code ("RX55+WWV", with or
// without "Santa Maria, Bulacan" after it, or a full "7Q62RX55+WWV"),
// coordinates ("14.81391, 120.95149"), coordinates in degrees, minutes and
// seconds (14°48'50.1"N 120°57'05.4"E), or a Google Maps link with "@lat,lng".
// Plus codes follow the Open Location Code specification
// (https://github.com/google/open-location-code); a short code is read as the
// spot nearest to Santa Maria.

const ALPHABET = '23456789CFGHJMPQRVWX'
const PAIR_RESOLUTIONS = [20, 1, 0.05, 0.0025, 0.000125]
const PAIR_DIGITS = 10
const GRID_COLUMNS = 4
const GRID_ROWS = 5
// Santa Maria municipal hall: the reference for short plus codes.
const TOWN = { latitude: 14.819333, longitude: 120.960421 }

const CODE_PATTERN = new RegExp(`(?:^|[^${ALPHABET}0])([${ALPHABET}0]{2,8}\\+[${ALPHABET}]{0,7})(?![${ALPHABET}])`, 'i')

// The centre of a full plus code, or null when it is not one.
function decodeFull(code) {
  const digits = code.replace('+', '').replace(/0+$/, '')
  if (digits.length < 2 || digits.length % 2 === 1 && digits.length < PAIR_DIGITS) return null
  let latitude = -90
  let longitude = -180
  let latSize = 0
  let lngSize = 0
  for (let i = 0; i < Math.min(digits.length, PAIR_DIGITS); i += 2) {
    const lat = ALPHABET.indexOf(digits[i])
    const lng = ALPHABET.indexOf(digits[i + 1])
    if (lat < 0 || lng < 0) return null
    latSize = lngSize = PAIR_RESOLUTIONS[i / 2]
    latitude += lat * latSize
    longitude += lng * lngSize
  }
  for (let i = PAIR_DIGITS; i < digits.length; i++) {
    const value = ALPHABET.indexOf(digits[i])
    if (value < 0) return null
    latSize /= GRID_ROWS
    lngSize /= GRID_COLUMNS
    latitude += Math.floor(value / GRID_COLUMNS) * latSize
    longitude += (value % GRID_COLUMNS) * lngSize
  }
  return { latitude: latitude + latSize / 2, longitude: longitude + lngSize / 2, size: latSize }
}

// The first `length` characters of the code for a point (enough to complete a
// short code from the reference point).
function prefixFor({ latitude, longitude }, length) {
  let lat = Math.min(Math.max(latitude, -90), 90 - 1e-9) + 90
  let lng = ((longitude + 180) % 360 + 360) % 360
  let prefix = ''
  for (let i = 0; i < length / 2; i++) {
    const resolution = PAIR_RESOLUTIONS[i]
    const latDigit = Math.floor(lat / resolution)
    const lngDigit = Math.floor(lng / resolution)
    lat -= latDigit * resolution
    lng -= lngDigit * resolution
    prefix += ALPHABET[latDigit] + ALPHABET[lngDigit]
  }
  return prefix
}

// A plus code (full or short) → { latitude, longitude, size } or null.
export function decodePlusCode(text, reference = TOWN) {
  const code = text.trim().toUpperCase()
  const separator = code.indexOf('+')
  if (separator < 0 || separator > 8 || separator % 2 === 1 || code.indexOf('+', separator + 1) >= 0) return null
  // At least two characters after the "+": anything shorter covers an area
  // hundreds of metres wide, too rough for a pin.
  if (code.length - separator - 1 < 2) return null
  if (separator === 8) return decodeFull(code)
  // A short code: complete it with the reference point's leading digits, then
  // take the matching cell nearest to the reference.
  const missing = 8 - separator
  const area = decodeFull(prefixFor(reference, missing) + code)
  if (!area) return null
  const resolution = PAIR_RESOLUTIONS[missing / 2 - 1]
  const half = resolution / 2
  let { latitude, longitude } = area
  if (latitude - reference.latitude > half) latitude -= resolution
  else if (latitude - reference.latitude < -half) latitude += resolution
  if (longitude - reference.longitude > half) longitude -= resolution
  else if (longitude - reference.longitude < -half) longitude += resolution
  return { latitude, longitude, size: area.size }
}

const dms = (deg, min, sec, hemisphere) => (Number(deg) + Number(min) / 60 + Number(sec) / 3600) * (/[SW]/i.test(hemisphere) ? -1 : 1)

// Whatever was pasted → { latitude, longitude, label } or { error }.
export function parseMapLocation(text) {
  const value = (text ?? '').trim()
  if (!value) return { error: 'Paste a plus code or coordinates from Google Maps first.' }
  const plus = value.match(CODE_PATTERN)
  if (plus) {
    const point = decodePlusCode(plus[1])
    if (!point) return { error: `“${plus[1]}” is not a complete plus code. Copy it again from Google Maps.` }
    return { latitude: point.latitude, longitude: point.longitude, label: `plus code ${plus[1].toUpperCase()}` }
  }
  const degrees = value.match(/(\d{1,2})°\s*(\d{1,2})['′]\s*([\d.]+)["″]?\s*([NS])[\s,]+(\d{1,3})°\s*(\d{1,2})['′]\s*([\d.]+)["″]?\s*([EW])/i)
  if (degrees) {
    return { latitude: dms(degrees[1], degrees[2], degrees[3], degrees[4]), longitude: dms(degrees[5], degrees[6], degrees[7], degrees[8]), label: 'coordinates' }
  }
  const pair = value.match(/@?(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/) ?? value.match(/(-?\d{1,2}\.\d{3,})\s+(-?\d{1,3}\.\d{3,})/)
  if (pair) return { latitude: Number(pair[1]), longitude: Number(pair[2]), label: 'coordinates' }
  return { error: 'That is not a plus code or coordinates. In Google Maps, tap the place and copy its plus code (like RX55+WWV) or its coordinates.' }
}
