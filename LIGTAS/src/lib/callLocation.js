// Where to go for a call: the person's live position when they are sharing it
// after an SOS, otherwise the position sent with the report.

// A live position counts as current for this long; after that rescuers see
// how old it is.
export const LIVE_FRESH_MS = 2 * 60 * 1000

export function callLocation(report) {
  if (report.live_latitude != null && report.live_longitude != null) {
    return {
      latitude: report.live_latitude,
      longitude: report.live_longitude,
      accuracy: report.live_accuracy ?? null,
      isLive: true,
      updatedAt: report.live_updated_at,
    }
  }
  if (report.latitude == null || report.longitude == null) return null
  return {
    latitude: report.latitude,
    longitude: report.longitude,
    accuracy: report.location_accuracy ?? null,
    isLive: false,
    updatedAt: report.created_at,
  }
}

// The report with latitude/longitude set to where to go now, plus `accuracy`
// and `isLive`; the position originally sent is kept as sentLatitude/sentLongitude.
// Safe to apply again to a report that was already placed.
export function placeReport(placedOrRaw) {
  const report = placedOrRaw.sentLatitude !== undefined
    ? { ...placedOrRaw, latitude: placedOrRaw.sentLatitude, longitude: placedOrRaw.sentLongitude }
    : placedOrRaw
  const where = callLocation(report)
  if (!where) return report
  return {
    ...report,
    sentLatitude: report.latitude,
    sentLongitude: report.longitude,
    latitude: where.latitude,
    longitude: where.longitude,
    accuracy: where.accuracy,
    isLive: where.isLive,
    locationUpdatedAt: where.updatedAt,
  }
}

export function isLiveFresh(report) {
  return Boolean(report.isLive && report.locationUpdatedAt && Date.now() - new Date(report.locationUpdatedAt).getTime() < LIVE_FRESH_MS)
}
