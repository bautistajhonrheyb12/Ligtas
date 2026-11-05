import { useState } from 'preact/hooks'
import { getReportPhotoUrl } from '../../lib/supabase.js'
import { Icon, LoadingCards, downloadCsv, reportTypeStyle, timeAgo } from '../../lib/ui.jsx'

const FILTERS = ['All', 'Pending', 'Verified', 'Resolved', 'Rejected', 'Cancelled', 'SOS']
const FILTER_LABELS = { Cancelled: 'Withdrawn' }
const PAGE_SIZE = 30
const REJECT_REASONS = ['Duplicate of another report', 'Not enough details to act on', 'Outside the service area', 'Already handled', 'Not an emergency']

function ReportPhotoLink({ path }) {
  const [state, setState] = useState('idle')
  const open = async () => {
    setState('loading')
    try {
      window.open(await getReportPhotoUrl(path), '_blank', 'noopener')
      setState('idle')
    } catch {
      setState('failed')
    }
  }
  return <button type="button" class="admin-chip-button" onClick={open} disabled={state === 'loading'}>
    <Icon name="camera" size={14} /> {state === 'failed' ? 'Photo unavailable' : 'Photo'}
  </button>
}

// Rejecting asks for a reason, which the citizen sees on their report.
function RejectControl({ disabled, onReject }) {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState(REJECT_REASONS[0])
  if (!isOpen) return <button type="button" class="reject-button" disabled={disabled} onClick={() => setIsOpen(true)}>Reject</button>
  return <div class="admin-reject-box">
    <label><span>Reason shown to the citizen</span>
      <select value={reason} onChange={(event) => setReason(event.currentTarget.value)}>
        {REJECT_REASONS.map((item) => <option key={item}>{item}</option>)}
      </select>
    </label>
    <div>
      <button type="button" class="alert-cancel-button" onClick={() => setIsOpen(false)}>Cancel</button>
      <button type="button" class="reject-button" disabled={disabled} onClick={() => onReject(reason)}>Reject report</button>
    </div>
  </div>
}

export function ReportsPanel({ reports, integrity = {}, loading, staff, updatingReportId, onUpdate, initialFilter = 'All' }) {
  const [filter, setFilter] = useState(initialFilter)
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const rescuers = staff.filter((person) => person.role === 'rescuer')
  const staffName = (id) => staff.find((person) => person.id === id)?.display_name || 'Unnamed rescuer'

  const filtered = reports.filter((report) => {
    const matchesFilter = filter === 'All' || (filter === 'SOS' ? report.report_type === 'SOS' : report.status === filter)
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || `${report.report_type} ${report.location} ${report.notes} ${report.contact_name ?? ''} ${report.contact_phone ?? ''}`.toLowerCase().includes(query)
    return matchesFilter && matchesSearch
  })

  const exportCsv = () => {
    const rows = [[
      'Submitted', 'Type', 'Priority', 'Status', 'Location', 'Latitude', 'Longitude', 'People affected',
      'Vulnerable people', 'Notes', 'Reporter', 'Reporter phone', 'Assigned team', 'Response stage', 'Resolved at', 'Resolution note',
    ]]
    filtered.forEach((report) => rows.push([
      new Date(report.created_at).toLocaleString(),
      report.report_type,
      report.priority,
      report.status,
      report.location,
      report.latitude ?? '',
      report.longitude ?? '',
      report.people_affected ?? '',
      report.vulnerable_people ? 'Yes' : 'No',
      report.notes,
      report.contact_name ?? '',
      report.contact_phone ?? '',
      report.assigned_to ? staffName(report.assigned_to) : '',
      report.response_stage ?? '',
      report.resolved_at ? new Date(report.resolved_at).toLocaleString() : '',
      report.resolution_note ?? '',
    ]))
    downloadCsv(`ligtas-reports-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  return <section class="admin-reports-panel">
    <div class="admin-report-tools">
      <div class="admin-report-toolbar">
        <label class="admin-report-search"><span>⌕</span><input aria-label="Search incident reports" placeholder="Search type, location, notes or reporter…" value={search} onInput={(event) => { setSearch(event.currentTarget.value); setVisibleCount(PAGE_SIZE) }} /></label>
        <button type="button" class="admin-export-button" onClick={exportCsv} disabled={!filtered.length}><Icon name="download" size={16} /> Export CSV</button>
      </div>
      <div class="admin-report-filters">
        {FILTERS.map((item) => {
          const count = item === 'All' ? reports.length : item === 'SOS' ? reports.filter((report) => report.report_type === 'SOS').length : reports.filter((report) => report.status === item).length
          return <button type="button" class={filter === item ? 'active' : ''} onClick={() => { setFilter(item); setVisibleCount(PAGE_SIZE) }} key={item}>{FILTER_LABELS[item] ?? item} <b>{count}</b></button>
        })}
      </div>
    </div>
    {loading ? <LoadingCards label="Loading incident reports…" /> : <div class="admin-report-list">
      {filtered.slice(0, visibleCount).map((report) => {
        const type = reportTypeStyle(report.report_type)
        const isBusy = updatingReportId === report.id
        return <article class={`admin-report-card admin-report-card--rich rx-tone--${type.tone}`} key={report.id}>
          <div class="admin-report-main">
            <div class="admin-report-head">
              <span class="admin-review-icon"><Icon name={type.icon} size={18} /></span>
              <div>
                <h2>{report.report_type}{report.priority !== 'Normal' && <span class={`admin-priority admin-priority--${report.priority.toLowerCase()}`}>{report.priority}</span>}</h2>
                <small>{timeAgo(report.created_at)} · {new Date(report.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small>
              </div>
            </div>
            <p class="admin-report-location"><Icon name="pin" size={14} /> {report.location}
              {report.latitude != null && <a href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`} target="_blank" rel="noreferrer">Open map</a>}
            </p>
            {integrity[report.id] === 'tampered' && <p class="integrity-warning" role="alert">
              <Icon name="alert" size={14} /><span><b>Changed outside the app.</b> This report's location, notes or contact no longer match its signature. Check with the reporter before acting on it.</span>
            </p>}
            {report.location_flag && <p class="location-warning" role="note">
              <Icon name="alert" size={14} /><span><b>Location check:</b> {report.location_flag}</span>
            </p>}
            <p>{report.notes}</p>
            {(report.contact_name || report.contact_phone) && <p class="admin-report-contact">
              <Icon name="user" size={13} /> {report.contact_name || 'Reporter'}
              {report.contact_phone && <a href={`tel:${report.contact_phone.replace(/[^+\d]/g, '')}`}><Icon name="phone" size={13} /> {report.contact_phone}</a>}
            </p>}
            <div class="admin-report-tags">
              {report.people_affected > 0 && <span><Icon name="users" size={13} /> {report.people_affected} affected</span>}
              {report.vulnerable_people && <span class="is-vulnerable"><Icon name="heart" size={13} /> Vulnerable people</span>}
              {report.photo_path && <ReportPhotoLink path={report.photo_path} />}
              {integrity[report.id] === 'valid' && <span class="is-signed" title="The signature matches: not changed since it was sent"><Icon name="shield" size={13} /> Signed</span>}
              {integrity[report.id] === 'unsigned' && <span class="is-unsigned" title="Sent before signing was set up, or the signature could not be saved">Not signed</span>}
            </div>
            {report.resolution_note && <p class="admin-report-resolution"><b>{report.status === 'Rejected' ? 'Rejected:' : 'Resolution:'}</b> {report.resolution_note}</p>}
          </div>
          <div class="admin-report-meta">
            <span class={`admin-report-status admin-report-status--${report.status.toLowerCase()}`}><span>{FILTER_LABELS[report.status] ?? report.status}</span></span>
            {report.status === 'Pending' && <div class="admin-report-actions">
              <button type="button" class="approve-button" disabled={isBusy} onClick={() => onUpdate(report.id, { status: 'Verified' })}><Icon name="check" size={14} /> Approve</button>
              <RejectControl disabled={isBusy} onReject={(reason) => onUpdate(report.id, { status: 'Rejected', resolution_note: reason })} />
            </div>}
            {(report.status === 'Pending' || report.status === 'Verified') && report.report_type !== 'SOS' && <label class="admin-status-override admin-priority-select">
              <span>Priority</span>
              <select aria-label={`Change ${report.report_type} priority`} value={report.priority} disabled={isBusy} onChange={(event) => onUpdate(report.id, { priority: event.currentTarget.value })}>
                <option>Normal</option><option>Urgent</option><option>Critical</option>
              </select>
            </label>}
            {report.status === 'Verified' && <label class="admin-assign">
              <span>Assigned team</span>
              <select disabled={isBusy} value={report.assigned_to ?? ''} onChange={(event) => onUpdate(report.id, { assigned_to: event.currentTarget.value || null, response_stage: event.currentTarget.value ? 'Assigned' : null })}>
                <option value="">Unassigned</option>
                {rescuers.map((person) => <option value={person.id} key={person.id}>{person.display_name || 'Unnamed rescuer'}</option>)}
              </select>
              {report.assigned_to && <small>{report.response_stage ?? 'Assigned'}{report.assigned_at ? ` · ${timeAgo(report.assigned_at)}` : ''}</small>}
            </label>}
            {report.status === 'Resolved' && report.assigned_to && <small class="admin-report-by">by {staffName(report.assigned_to)}{report.resolved_at ? ` · ${timeAgo(report.resolved_at)}` : ''}</small>}
            {report.status !== 'Pending' && report.status !== 'Cancelled' && <label class="admin-status-override">
              <span>Change status</span>
              <select aria-label={`Change ${report.report_type} status`} value={report.status} disabled={isBusy} onChange={(event) => onUpdate(report.id, { status: event.currentTarget.value })}>
                <option>Pending</option><option>Verified</option><option>Resolved</option><option>Rejected</option>
              </select>
            </label>}
          </div>
        </article>
      })}
      {filtered.length > visibleCount && <button type="button" class="admin-show-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
        Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more <small>({filtered.length - visibleCount} not shown)</small>
      </button>}
      {filtered.length === 0 && <p class="admin-empty-state">No reports match this search.</p>}
    </div>}
  </section>
}
