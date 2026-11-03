import { useState } from 'preact/hooks'
import { createRescuerAccount, deleteEvacuationCenter, publishAlert, saveEvacuationCenter } from '../../lib/supabase.js'
import { Icon, LoadingCards, capacityLevel, passwordProblem, reportTypeStyle, timeAgo } from '../../lib/ui.jsx'

// A destructive button that asks for a second tap within four seconds.
function ConfirmButton({ class: className, label, confirmLabel, onConfirm, disabled, children }) {
  const [state, setState] = useState('idle')
  const press = async () => {
    if (state === 'idle') {
      setState('confirm')
      setTimeout(() => setState((current) => current === 'confirm' ? 'idle' : current), 4000)
      return
    }
    setState('busy')
    try {
      await onConfirm()
    } finally {
      setState('idle')
    }
  }
  return <button type="button" class={`${className}${state === 'confirm' ? ' is-confirming' : ''}`} disabled={disabled || state === 'busy'} onClick={press} aria-label={state === 'confirm' ? confirmLabel : label}>
    {state === 'busy' ? <span class="btn-spinner" aria-hidden="true" /> : state === 'confirm' ? confirmLabel : children}
  </button>
}

// ---------------------------------------------------------------------------
// Evacuation centers
// ---------------------------------------------------------------------------

function CenterCard({ center, onEdit, onNotice, onChanged }) {
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const level = capacityLevel(center.occupants, center.capacity)
  const percent = Math.round(center.occupants / center.capacity * 100)

  const save = async (changes) => {
    setIsSaving(true)
    try {
      await saveEvacuationCenter({
        id: center.id,
        name: center.name,
        location: center.location,
        latitude: center.latitude,
        longitude: center.longitude,
        capacity: center.capacity,
        occupants: center.occupants,
        isOpen: center.is_open,
        ...changes,
      })
      onChanged()
    } catch (error) {
      onNotice(error.message, true)
    } finally {
      setIsSaving(false)
    }
  }

  const adjust = (delta) => save({ occupants: Math.min(Math.max(center.occupants + delta, 0), center.capacity) })

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 4000)
      return
    }
    setIsSaving(true)
    try {
      await deleteEvacuationCenter(center.id)
      onNotice(`${center.name} was removed.`)
    } catch (error) {
      onNotice(error.message, true)
      setIsSaving(false)
    }
  }

  return <article class={`admin-center-card admin-center-card--rich${center.is_open ? '' : ' is-closed'}`}>
    <div class="admin-center-info">
      <h3>{center.name}</h3>
      <p>{center.location}{center.latitude == null ? ' · not on map' : ''}</p>
      <div class="admin-center-chips">
        <span class={`capacity-chip capacity-chip--${center.is_open ? level.level : 'closed'}`}>{center.is_open ? level.label : 'Closed'}</span>
        <small>Updated {timeAgo(center.updated_at).toLowerCase()}</small>
      </div>
    </div>
    <div class="admin-center-capacity">
      <strong>{center.occupants} / {center.capacity}</strong>
      <span>{percent}% occupied · {Math.max(center.capacity - center.occupants, 0)} spaces left</span>
      <div><i data-level={level.level} style={{ width: `${percent}%` }} /></div>
      <div class="admin-occupancy-controls" aria-label={`Adjust occupants for ${center.name}`}>
        <button type="button" disabled={isSaving || center.occupants === 0} onClick={() => adjust(-10)}>−10</button>
        <button type="button" disabled={isSaving || center.occupants === 0} onClick={() => adjust(-1)}>−1</button>
        <button type="button" disabled={isSaving || center.occupants >= center.capacity} onClick={() => adjust(1)}>+1</button>
        <button type="button" disabled={isSaving || center.occupants >= center.capacity} onClick={() => adjust(10)}>+10</button>
      </div>
    </div>
    <div class="admin-center-actions">
      <button type="button" class={`admin-toggle${center.is_open ? ' is-on' : ''}`} role="switch" aria-checked={center.is_open} disabled={isSaving} onClick={() => save({ isOpen: !center.is_open })}>
        <i aria-hidden="true" /> {center.is_open ? 'Open' : 'Closed'}
      </button>
      <button type="button" class="admin-icon-button" onClick={() => onEdit(center)} aria-label={`Edit ${center.name}`}><Icon name="edit" size={16} /></button>
      <button type="button" class={`admin-icon-button is-danger${confirmDelete ? ' is-confirming' : ''}`} disabled={isSaving} onClick={remove} aria-label={confirmDelete ? `Confirm removing ${center.name}` : `Remove ${center.name}`}>
        {confirmDelete ? 'Remove?' : <Icon name="trash" size={16} />}
      </button>
    </div>
  </article>
}

export function CentersPanel({ centers, loading, onAdd, onEdit, onNotice, onChanged }) {
  const open = centers.filter((center) => center.is_open)
  const capacity = open.reduce((sum, center) => sum + center.capacity, 0)
  const occupants = open.reduce((sum, center) => sum + center.occupants, 0)

  return <section class="admin-centers-panel">
    <div class="queue-heading">
      <div><span class="ops-eyebrow">Shelter capacity</span><h2>Evacuation centers</h2></div>
      <button type="button" class="add-alert-button" onClick={onAdd}><Icon name="plus" size={16} /> Add center</button>
    </div>
    <p class="admin-panel-summary">{open.length} of {centers.length} open · {occupants.toLocaleString()} sheltered · {Math.max(capacity - occupants, 0).toLocaleString()} spaces available</p>
    {loading && <LoadingCards label="Loading evacuation centers…" />}
    {centers.map((center) => <CenterCard center={center} key={center.id} onEdit={onEdit} onNotice={onNotice} onChanged={onChanged} />)}
    {!loading && centers.length === 0 && <p class="admin-empty-state">No evacuation centers yet. Add the first one so citizens can find shelter.</p>}
  </section>
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export function TeamsPanel({ staff, locations, reports, onCreated, onNotice, onDeactivate }) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const rescuers = staff.filter((person) => person.role === 'rescuer')

  const submit = async (event) => {
    event.preventDefault()
    // Kept because event.currentTarget is cleared once the request is awaited.
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const problem = passwordProblem(form.get('password'))
    if (problem) {
      setError(problem)
      return
    }
    setIsSaving(true)
    setError('')
    try {
      await createRescuerAccount({
        email: form.get('email').trim(),
        password: form.get('password'),
        displayName: form.get('displayName').trim(),
      })
      formElement.reset()
      setIsFormOpen(false)
      onNotice(`Rescuer account created for ${form.get('displayName').trim()}. Share the email and password with them securely.`)
      onCreated()
    } catch (createError) {
      setError(createError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return <section class="admin-centers-panel admin-teams-panel">
    <div class="queue-heading">
      <div><span class="ops-eyebrow">Response teams</span><h2>Rescuers</h2></div>
      <button type="button" class="add-alert-button" onClick={() => setIsFormOpen((open) => !open)}><Icon name="userPlus" size={16} /> {isFormOpen ? 'Close' : 'Add rescuer'}</button>
    </div>
    {isFormOpen && <form class="alert-form admin-team-form" onSubmit={submit}>
      <label>Team or rescuer name<input name="displayName" required minLength="2" maxLength="80" placeholder="e.g. Team Alpha" /></label>
      <div class="admin-form-row">
        <label>Email<input name="email" type="email" required autoComplete="off" placeholder="rescuer@example.com" /></label>
        <label>Temporary password<input name="password" type="password" required minLength="8" autoComplete="new-password" placeholder="8+ characters, letters and numbers" /></label>
      </div>
      {error && <p class="form-error" role="alert" key={error}>{error}</p>}
      <div class="alert-form-actions"><button type="submit" class="add-alert-button" disabled={isSaving}>{isSaving && <span class="btn-spinner" aria-hidden="true" />}Create rescuer account</button></div>
    </form>}
    <div class="admin-team-list">
      {rescuers.map((person) => {
        const location = locations.find((item) => item.rescuer_id === person.id)
        const isLive = location && Date.now() - new Date(location.updated_at).getTime() < 10 * 60000
        const active = reports.filter((report) => report.assigned_to === person.id && report.status === 'Verified')
        const resolved = reports.filter((report) => report.assigned_to === person.id && report.status === 'Resolved').length
        return <article class="admin-team-card" key={person.id}>
          <span class="admin-team-avatar">{(person.display_name || 'R').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()}</span>
          <div class="admin-team-info">
            <strong>{person.display_name || 'Unnamed rescuer'}</strong>
            <small class={isLive ? 'is-live' : ''}><i /> {location ? `${isLive ? 'Sharing location' : 'Last seen'} · ${timeAgo(location.updated_at).toLowerCase()}` : 'Location not shared'}</small>
          </div>
          <div class="admin-team-stats">
            <span><b>{active.length}</b> active</span>
            <span><b>{resolved}</b> resolved</span>
          </div>
          {active[0] && <p class="admin-team-current"><Icon name="navigate" size={13} /> {active[0].report_type} · {active[0].location} · {active[0].response_stage ?? 'Assigned'}</p>}
          <ConfirmButton class="admin-team-deactivate" label={`Deactivate ${person.display_name || 'rescuer'}`} confirmLabel="Tap again to deactivate" onConfirm={() => onDeactivate(person)}>
            <Icon name="x" size={13} /> Deactivate
          </ConfirmButton>
        </article>
      })}
      {rescuers.length === 0 && <p class="admin-empty-state">No rescuer accounts yet. Add one to start assigning calls.</p>}
      {rescuers.length > 0 && <p class="admin-field-help admin-team-note">Deactivating moves a rescuer back to a citizen account and returns their open calls to the queue.</p>}
    </div>
  </section>
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

const EXPIRY_OPTIONS = [['', 'Does not expire'], ['3', 'In 3 hours'], ['6', 'In 6 hours'], ['12', 'In 12 hours'], ['24', 'In 24 hours'], ['72', 'In 3 days']]

export function AlertForm({ onCancel, onPublished }) {
  const [severity, setSeverity] = useState('High')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const audience = form.getAll('audience')
    const targetRoles = audience.includes('All users')
      ? ['citizen', 'rescuer', 'admin']
      : [...(audience.includes('Citizens') ? ['citizen'] : []), ...(audience.includes('Rescuers') ? ['rescuer'] : [])]
    if (!targetRoles.length) {
      setError('Select at least one audience for this alert.')
      return
    }
    const hours = Number(form.get('expiresIn'))
    const barangays = form.get('barangays').split(',').map((item) => item.trim()).filter(Boolean)
    setIsSaving(true)
    setError('')
    try {
      await publishAlert({
        alertType: form.get('type'),
        severity,
        title: form.get('title').trim(),
        message: form.get('message').trim(),
        location: form.get('location').trim(),
        targetRoles,
        barangays,
        expiresAt: hours ? new Date(Date.now() + hours * 3600000).toISOString() : null,
      })
      onPublished()
    } catch (publishError) {
      setError(publishError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return <>
    <div class="queue-heading"><div><span class="ops-eyebrow">Situation update</span><h2>Create alert</h2></div><button type="button" class="admin-back-button" onClick={onCancel}>‹ Back</button></div>
    <form class="admin-create-alert" onSubmit={submit}>
      <label>Alert type<select name="type" defaultValue="Flood"><option>Flood</option><option>Severe weather</option><option>Landslide</option><option>Road closure</option><option>Other</option></select></label>
      <fieldset><legend>Severity level</legend><div class="admin-severity-options">{['Low', 'Moderate', 'High'].map((item) => <button type="button" class={`admin-severity admin-severity--${item.toLowerCase()}${severity === item ? ' is-selected' : ''}`} onClick={() => setSeverity(item)} key={item}>{item}</button>)}</div></fieldset>
      <label>Title<input name="title" required minLength="2" maxLength="80" placeholder="e.g. Flood Alert Warning" /></label>
      <label>Message<textarea name="message" required maxLength="1000" rows="3" placeholder="Describe the hazard and any response guidance" /></label>
      <label>Affected area (shown on the alert)<input name="location" required minLength="2" maxLength="160" placeholder="e.g. Riverside barangays" /></label>
      <label>Only notify these barangays <small class="admin-field-help">Comma-separated. Leave empty to notify the whole municipality.</small><input name="barangays" maxLength="400" placeholder="e.g. Poblacion, Catmon, Bagbaguin" /></label>
      <label>Expires<select name="expiresIn" defaultValue="">{EXPIRY_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <fieldset class="admin-audience"><legend>Send to</legend><label><input type="checkbox" name="audience" value="All users" /> All users</label><label><input type="checkbox" name="audience" value="Citizens" defaultChecked /> Citizens</label><label><input type="checkbox" name="audience" value="Rescuers" defaultChecked /> Rescuers</label></fieldset>
      {error && <p class="form-error" role="alert" key={error}>{error}</p>}
      <button class="admin-publish-button" type="submit" disabled={isSaving}>{isSaving && <span class="btn-spinner" aria-hidden="true" />}{isSaving ? 'Publishing…' : 'Send alert'}</button>
    </form>
  </>
}

export function AlertList({ alerts, loading, error, onEnd, onDelete }) {
  return <div class="ops-alert-list">
    {alerts.map((alert) => <article class={`ops-alert-item ops-alert-item--${alert.accent}`} key={alert.id}>
      <span class="ops-alert-symbol">{alert.accent === 'red' ? '!' : alert.accent === 'yellow' ? '↗' : 'i'}</span>
      <div>
        <div class="ops-alert-title"><h3>{alert.title}</h3><span>{alert.severity}</span></div>
        <p>{alert.description}</p>
        <small>{alert.location} · {timeAgo(alert.createdAt)}</small>
        <div class="admin-alert-meta">
          <span><Icon name="users" size={12} /> {alert.targetRoles.join(', ')}</span>
          {alert.barangays?.length > 0 && <span><Icon name="pin" size={12} /> {alert.barangays.join(', ')}</span>}
          {alert.expiresAt && <span><Icon name="clock" size={12} /> Expires {new Date(alert.expiresAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
        </div>
        {(onEnd || onDelete) && <div class="admin-alert-actions">
          {onEnd && <ConfirmButton class="admin-alert-end" label={`End ${alert.title}`} confirmLabel="Tap again to end" onConfirm={() => onEnd(alert)}><Icon name="check" size={13} /> End alert</ConfirmButton>}
          {onDelete && <ConfirmButton class="admin-icon-button is-danger" label={`Delete ${alert.title}`} confirmLabel="Delete?" onConfirm={() => onDelete(alert)}><Icon name="trash" size={14} /></ConfirmButton>}
        </div>}
      </div>
    </article>)}
    {!loading && !error && alerts.length === 0 && <p class="admin-empty-state">There are no current alerts.</p>}
    {loading && <LoadingCards label="Loading alerts…" count={2} />}
  </div>
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

const actionTone = { 'SOS sent': 'red', Rejected: 'red', Verified: 'blue', Assigned: 'amber', 'En route': 'amber', 'On scene': 'amber', Resolved: 'green', Submitted: 'violet', Cancelled: 'violet', Unassigned: 'amber' }
const citizenActions = ['Submitted', 'SOS sent', 'Cancelled']
const actionVerb = {
  Submitted: 'submitted',
  Verified: 'verified',
  Rejected: 'rejected',
  Resolved: 'resolved',
  Pending: 'moved back to review',
  Unassigned: 'unassigned the team from',
  Cancelled: 'withdrew',
  'En route': 'is on the way to',
  'On scene': 'arrived at',
  'Priority changed': 'changed the priority of',
}

export function ActivityFeed({ events, reports, staff, loading, limit = 8 }) {
  const person = (id) => staff.find((item) => item.id === id)
  const name = (id) => person(id)?.display_name
  return <ol class="activity-feed">
    {loading && <li><LoadingCards label="Loading activity…" count={2} /></li>}
    {!loading && events.slice(0, limit).map((event) => {
      const report = reports.find((item) => item.id === event.report_id)
      const type = reportTypeStyle(report?.report_type)
      const actor = name(event.actor_id) || (citizenActions.includes(event.action) ? 'A citizen' : 'Staff')
      const handedBack = event.action === 'Unassigned' && person(event.actor_id)?.role === 'rescuer'
      const assignee = event.action === 'Assigned' ? name(event.detail) : null
      return <li class={`activity-item rx-tone--${actionTone[event.action] ?? 'blue'}`} key={event.id}>
        <span class="activity-dot"><Icon name={type.icon} size={13} /></span>
        <div>
          {event.action === 'SOS sent' ? <p><b>{actor}</b> sent an <b>SOS</b>{report ? ` from ${report.location}` : ''}</p> : <p><b>{actor}</b> {event.action === 'Assigned' ? (event.detail === event.actor_id ? 'took' : `assigned ${assignee ?? 'a team'} to`) : handedBack ? 'handed back' : actionVerb[event.action] ?? event.action.toLowerCase()} {report ? <>the <b>{report.report_type === 'SOS' ? 'SOS' : report.report_type.toLowerCase()}</b> report at {report.location}</> : 'a report'}</p>}
          <small>{timeAgo(event.created_at)}</small>
        </div>
      </li>
    })}
    {!loading && events.length === 0 && <li class="admin-empty-state">No activity yet.</li>}
  </ol>
}
