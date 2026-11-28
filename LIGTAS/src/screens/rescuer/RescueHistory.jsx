import { useState } from 'preact/hooks'
import { RESCUE_OUTCOMES } from '../../lib/rescue.js'
import { Icon, reportTypeLabel, reportTypeStyle } from '../../lib/ui.jsx'

const PERIODS = [['1', 'Today'], ['7', '7 days'], ['30', '30 days'], ['all', 'All']]
const DAY_MS = 86400000
// Shown in Philippine time on every phone.
const when = (value) => new Date(value).toLocaleString([], { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function duration(from, to) {
  const minutes = Math.max(0, Math.round((new Date(to) - new Date(from)) / 60000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `${hours} hr ${minutes % 60} min` : `${Math.floor(hours / 24)} d ${hours % 24} hr`
}

// Since midnight in Santa Maria for "Today"; otherwise the last N days.
function periodStart(period) {
  if (period === 'all') return null
  const offset = 8 * 3600000
  const todayStart = Math.floor((Date.now() + offset) / DAY_MS) * DAY_MS - offset
  return todayStart - (Number(period) - 1) * DAY_MS
}

// Finished operations: when, where, how long, what came of it and the remarks.
export function RescueHistory({ calls, myId, staffName, notesFor, onLoadNotes }) {
  const [scope, setScope] = useState('mine')
  const [period, setPeriod] = useState('30')
  const [outcome, setOutcome] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(null)

  const start = periodStart(period)
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const visible = calls
    .filter((call) => scope === 'all' || call.assigned_to === myId)
    .filter((call) => start == null || new Date(call.resolved_at ?? call.created_at).getTime() >= start)
    .filter((call) => !outcome || (outcome === 'none' ? !call.resolution_outcome : call.resolution_outcome === outcome))
    .filter((call) => words.every((word) => `${reportTypeLabel(call)} ${call.location} ${call.resolution_note ?? ''} ${call.resolution_outcome ?? ''}`.toLowerCase().includes(word)))
    .sort((a, b) => new Date(b.resolved_at ?? b.created_at) - new Date(a.resolved_at ?? a.created_at))

  const toggle = (call) => {
    const next = open === call.id ? null : call.id
    setOpen(next)
    if (next) onLoadNotes(call.id)
  }

  return <>
    <div class="rx-filters">
      <div class="rx-segment" role="tablist" aria-label="Whose operations">
        {[['mine', 'Mine'], ['all', 'All teams']].map(([id, label]) => <button type="button" role="tab" key={id} aria-selected={scope === id} class={scope === id ? 'is-active' : ''} onClick={() => setScope(id)}>{label}</button>)}
      </div>
      <div class="rx-filter-row">
        <label class="rx-search"><Icon name="search" size={15} /><input type="search" value={search} placeholder="Search place, type or remarks" aria-label="Search finished operations" onInput={(event) => setSearch(event.currentTarget.value)} /></label>
        <select value={period} aria-label="Period" onChange={(event) => setPeriod(event.currentTarget.value)}>
          {PERIODS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
        <select value={outcome} aria-label="Outcome" onChange={(event) => setOutcome(event.currentTarget.value)}>
          <option value="">Any outcome</option>
          {RESCUE_OUTCOMES.map((item) => <option value={item} key={item}>{item}</option>)}
          <option value="none">No outcome recorded</option>
        </select>
      </div>
    </div>
    <p class="rx-list-count" role="status">{visible.length} {visible.length === 1 ? 'operation' : 'operations'}</p>
    <div class="rx-history-list">
      {visible.map((call) => {
        const type = reportTypeStyle(call.report_type)
        const notes = notesFor(call.id)
        const isOpen = open === call.id
        return <article class={`rx-history rx-tone--${type.tone}`} key={call.id}>
          <button type="button" class="rx-history-head" aria-expanded={isOpen} onClick={() => toggle(call)}>
            <span class="rx-type-icon"><Icon name={type.icon} size={18} /></span>
            <span class="rx-history-title">
              <strong>{reportTypeLabel(call)}</strong>
              <small>{call.location}</small>
            </span>
            {call.resolution_outcome ? <b class="rx-outcome">{call.resolution_outcome}</b> : <b class="rx-outcome is-missing">No outcome</b>}
            <Icon name="chevron" size={16} />
          </button>
          <dl class="rx-history-facts">
            <div><dt>Requested</dt><dd>{when(call.created_at)}</dd></div>
            {call.resolved_at && <div><dt>Resolved</dt><dd>{when(call.resolved_at)}</dd></div>}
            {call.resolved_at && <div><dt>Took</dt><dd>{duration(call.created_at, call.resolved_at)}</dd></div>}
            <div><dt>Team</dt><dd>{call.assigned_to === myId ? 'You' : staffName(call.assigned_to)}</dd></div>
          </dl>
          {call.resolution_note && <p class="rx-history-remarks"><b>Remarks:</b> {call.resolution_note}</p>}
          {isOpen && <div class="rx-history-notes">
            <h4><Icon name="file" size={14} /> Field notes</h4>
            {notes === undefined
              ? <p class="rx-notes-empty"><span class="btn-spinner" aria-hidden="true" /> Loading…</p>
              : notes.length
                ? <ol class="rx-notes-list">{notes.map((note) => <li key={note.id}><p>{note.detail}</p><small>{note.actor_id === myId ? 'You' : staffName(note.actor_id)} · {when(note.created_at)}</small></li>)}</ol>
                : <p class="rx-notes-empty">No field notes were saved for this operation.</p>}
          </div>}
        </article>
      })}
      {visible.length === 0 && <div class="rx-empty">
        <span class="rx-empty-icon"><Icon name="history" size={28} /></span>
        <strong>{calls.length ? 'No operations match' : 'No finished operations yet'}</strong>
        <p>{calls.length ? 'Try another period, outcome or search.' : 'Calls you resolve appear here with their times, outcome and remarks.'}</p>
      </div>}
    </div>
  </>
}
