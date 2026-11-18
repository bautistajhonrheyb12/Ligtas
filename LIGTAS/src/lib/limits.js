// Limits on ordinary reports, against spam and trolling. The database enforces
// them (supabase/migrations/20261119110000_report_limits.sql); the app checks
// them first, so nobody fills in a whole report only to have it refused.
// SOS has its own limit and is never blocked by these.
export const REPORT_LIMITS = { waiting: 3, burst: 3, burstMinutes: 10, perDay: 10 }

// Which limit stops a new report right now: 'waiting', 'burst', 'day' or null.
// Counts reports already sent and reports saved offline, waiting to be sent.
export function reportLimitReached(reports = [], queued = [], now = Date.now()) {
  const sent = reports.filter((report) => report.report_type !== 'SOS')
  const saved = queued.filter((report) => report.reportType !== 'SOS')
  const waiting = sent.filter((report) => report.status === 'Pending').length + saved.length
  if (waiting >= REPORT_LIMITS.waiting) return 'waiting'
  const times = [...sent.map((report) => Date.parse(report.created_at)), ...saved.map((report) => Date.parse(report.queuedAt))]
    .filter(Number.isFinite)
  if (times.filter((time) => now - time < REPORT_LIMITS.burstMinutes * 60000).length >= REPORT_LIMITS.burst) return 'burst'
  if (times.filter((time) => now - time < 24 * 3600000).length >= REPORT_LIMITS.perDay) return 'day'
  return null
}
