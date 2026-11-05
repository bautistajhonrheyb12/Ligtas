import { useEffect, useRef, useState } from 'preact/hooks'
import { verifyReports } from './supabase.js'

// Reports are signed right after they are sent, so a very new one can still be
// waiting for its signature.
const SIGNING_GRACE_MS = 10 * 60 * 1000
// When the check is unavailable (for example the function is not deployed yet),
// wait before trying again instead of calling it on every refresh.
const RETRY_AFTER_MS = 5 * 60 * 1000

// The fields the signature protects; a report is checked again when they change.
const fingerprint = (report) => JSON.stringify([
  report.report_type, report.location, report.notes, report.latitude, report.longitude,
  report.photo_path, report.contact_name, report.contact_phone, report.created_at,
])

// Checks the signatures of the given reports with the report-integrity
// function. Returns { [reportId]: 'valid' | 'unsigned' | 'tampered' }.
export function useReportIntegrity(reports) {
  const [statuses, setStatuses] = useState({})
  const checkedRef = useRef(new Map())
  const pausedUntilRef = useRef(0)

  useEffect(() => {
    if (Date.now() < pausedUntilRef.current) return
    const pending = reports.filter((report) => checkedRef.current.get(report.id) !== fingerprint(report))
    if (!pending.length) return
    pending.forEach((report) => checkedRef.current.set(report.id, fingerprint(report)))

    verifyReports(pending.map((report) => report.id))
      .then((result) => {
        setStatuses((current) => ({ ...current, ...result }))
        // A new report may be signed a moment later: check it again next time.
        pending.forEach((report) => {
          if (result[report.id] === 'unsigned' && Date.now() - new Date(report.created_at).getTime() < SIGNING_GRACE_MS) {
            checkedRef.current.delete(report.id)
          }
        })
      })
      .catch(() => {
        pending.forEach((report) => checkedRef.current.delete(report.id))
        pausedUntilRef.current = Date.now() + RETRY_AFTER_MS
      })
  }, [reports])

  return statuses
}

// Map markers say when a report was changed outside the app.
export function markTampered(reports, statuses) {
  return reports.map((report) => statuses[report.id] === 'tampered'
    ? { ...report, location: `⚠ Changed outside the app · ${report.location}` }
    : report)
}
