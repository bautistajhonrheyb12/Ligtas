import { isNetworkError } from './supabase.js'

// Reports written while offline are saved on the device and sent once the
// connection returns. Photos are not queued: they can be too large for storage.
// Each report remembers who wrote it, so a shared phone never sends one
// person's report from another person's account.
const QUEUE_KEY = 'ligtas-report-queue'

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) ?? []
  } catch {
    return []
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // Storage unavailable; the caller already showed the report as queued.
  }
}

const belongsTo = (ownerId) => (report) => !report.ownerId || report.ownerId === ownerId

export function getQueuedReports(ownerId) {
  return readQueue().filter(belongsTo(ownerId))
}

export function queueReport(report, ownerId) {
  const { photoFile, ...rest } = report
  // By the time it is sent the person may have moved, so a GPS position is
  // marked as saved and the database does not treat it as their live location.
  const locationSource = rest.locationSource === 'gps' ? 'saved' : rest.locationSource
  saveQueue([...readQueue(), { ...rest, locationSource, ownerId: ownerId ?? null, queuedAt: new Date().toISOString() }])
}

// Sends this person's queued reports in order. Reports that fail because of the
// connection or the rate limit stay queued; reports the server refuses for any
// other reason are dropped and returned so the person can be told.
export async function flushQueuedReports(submit, ownerId) {
  const queue = readQueue()
  const mine = queue.filter(belongsTo(ownerId))
  if (!mine.length) return { sent: 0, failed: [] }
  const remaining = queue.filter((report) => !belongsTo(ownerId)(report))
  const failed = []
  let sent = 0
  for (const report of mine) {
    try {
      const { queuedAt, ownerId: _owner, ...payload } = report
      await submit(payload)
      sent += 1
    } catch (error) {
      if (isNetworkError(error) || /several reports/i.test(error?.message ?? '')) remaining.push(report)
      else failed.push({ report, message: error.message })
    }
  }
  saveQueue(remaining)
  return { sent, failed }
}
