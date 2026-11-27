import { useState } from 'preact/hooks'
import { createRescuerAccount, deleteEvacuationCenter, publishAlert, updateEvacuationCenterStatus } from '../../lib/supabase.js'
import { Icon, LoadingCards, PasswordChecklist, alertEndText, alertIcon, alertTypeLabel, passwordProblem, reportTypeLabel, reportTypeStyle, timeAgo, useMinuteClock } from '../../lib/ui.jsx'
import {
  MDRRMO_GUIDANCE,
  addressParts,
  centerCapacity,
  centerLoad,
  centerSummary,
  centerTitle,
  classificationOf,
  contactNumbers,
  facilityTypeLabel,
  formatRange,
  googleMapsUrl,
  hasPin,
  locationStatusOf,
  occupantLimit,
} from '../../lib/centers.js'
import { AlertTypeField, ExpiryField, alertTypeProblem, expiryFor } from '../../components/AlertFields.jsx'
import { ConfirmAction, useConfirm } from '../../components/ConfirmDialog.jsx'

// A button for something hard to undo: it asks in a confirmation box first.
// `ask` is { title, message, confirmLabel, tone }.
export function ConfirmButton({ class: className, label, ask, onConfirm, disabled, children }) {
  return <ConfirmAction class={className} label={label} ask={ask} onConfirm={onConfirm} disabled={disabled}>{children}</ConfirmAction>
}

// ---------------------------------------------------------------------------
// Evacuation centers
// ---------------------------------------------------------------------------

const LOCATION_TEXT = {
  confirmed: 'Pin checked on site',
  unconfirmed: 'Pin not yet checked on site',
  unknown: 'Needs a location: not on the map',
}
const LEVEL_TEXT = { open: 'Space available', busy: 'Filling up', critical: 'Near capacity', unknown: 'Capacity not confirmed' }

function capacityText(center) {
  const load = centerLoad(center)
  if (load.status === 'documented') return { main: `${center.occupants} / ${center.capacity}`, sub: `Registered capacity · ${load.percent}% occupied · ${load.spaceLow} spaces left` }
  if (load.status === 'estimated') return { main: `${center.occupants} / ${formatRange(center.capacity, center.capacity_max)}`, sub: `Estimated capacity (${center.capacity_source || MDRRMO_GUIDANCE}) · about ${formatRange(load.spaceLow, load.spaceHigh)} spaces left` }
  return { main: `${center.occupants} here`, sub: 'Capacity not confirmed: record it when known' }
}

function CenterCard({ center, onEdit, onNotice, onChanged }) {
  const [isSaving, setIsSaving] = useState(false)
  const [confirm, confirmDialog] = useConfirm()
  const load = centerLoad(center)
  const kind = classificationOf(center)
  const location = locationStatusOf(center)
  const capacity = capacityText(center)
  const title = centerTitle(center)
  const address = addressParts(center)
  const mapsUrl = googleMapsUrl(center)

  // Only the changed fields are written, so nothing else about the center is touched.
  const save = async (changes) => {
    setIsSaving(true)
    try {
      await updateEvacuationCenterStatus(center.id, changes)
      onChanged()
    } catch (error) {
      onNotice(error.message, true)
    } finally {
      setIsSaving(false)
    }
  }

  const limit = occupantLimit(center)
  const adjust = (delta) => save({ occupants: Math.min(Math.max(center.occupants + delta, 0), limit) })

  // Closing hides the center from citizens' "nearest center" and directions,
  // so it is confirmed; opening is not.
  const toggleOpen = async () => {
    if (center.is_open) {
      const sure = await confirm({
        title: `Close ${title}?`,
        message: 'Citizens will no longer be sent here: it is removed from "nearest evacuation center" and from directions.',
        confirmLabel: 'Close center',
        tone: 'warning',
        icon: 'home',
      })
      if (!sure) return
    }
    save({ isOpen: !center.is_open })
  }

  // Confirming a pin is a claim people will rely on, so it is asked first.
  const confirmPin = async () => {
    const sure = await confirm({
      title: `Mark the pin for ${title} as checked?`,
      message: 'Only do this after someone has been there and seen that the pin is on the actual building. Residents will then see "Pin checked on site".',
      confirmLabel: 'Mark as checked',
      tone: 'warning',
      icon: 'check',
    })
    if (sure) save({ locationStatus: 'confirmed' })
  }

  const remove = async () => {
    const sure = await confirm({
      title: `Remove ${title}?`,
      message: 'It disappears from every map and from the list of evacuation centers. This cannot be undone.',
      confirmLabel: 'Remove center',
      icon: 'trash',
    })
    if (!sure) return
    setIsSaving(true)
    try {
      await deleteEvacuationCenter(center.id)
      onNotice(`${title} was removed.`)
    } catch (error) {
      onNotice(error.message, true)
      setIsSaving(false)
    }
  }

  return <article class={`admin-center-card admin-center-card--rich${center.is_open ? '' : ' is-closed'}${kind ? ` is-${kind}` : ''}`}>
    <div class="admin-center-info">
      <div class="admin-center-chips center-kind-row">
        {kind ? <span class={`center-kind is-${kind}`}>{kind === 'official' ? 'Official evacuation center' : 'Temporary evacuation site'}</span> : <span class="center-kind is-missing">Not classified</span>}
        {center.facility_type && <span class="center-type-chip">{facilityTypeLabel(center.facility_type)}</span>}
      </div>
      <h3>{title}</h3>
      <p>{address.text}{address.plusCode && <span class="center-plus-chip">{address.plusCode}</span>}</p>
      <ul class="center-facts">
        <li class={`is-${location}`}><Icon name="pin" size={13} /> {LOCATION_TEXT[location]}</li>
        {mapsUrl && <li><a href={mapsUrl} target="_blank" rel="noreferrer"><Icon name="external" size={13} /> Check in Google Maps</a></li>}
        {contactNumbers(center).length > 0 && <li><Icon name="phone" size={13} /> {center.contact_numbers}</li>}
        {center.source && <li><Icon name="file" size={13} /> {center.source}</li>}
      </ul>
      {center.verification_notes && <details class="center-notes"><summary>What still needs checking</summary><p>{center.verification_notes}</p></details>}
      {location === 'unconfirmed' && <button type="button" class="center-confirm-pin" disabled={isSaving} onClick={confirmPin}><Icon name="check" size={14} /> Mark pin checked on site</button>}
      <div class="admin-center-chips">
        <span class={`capacity-chip capacity-chip--${center.is_open ? load.level : 'closed'}`}>{center.is_open ? LEVEL_TEXT[load.level] : 'Closed'}</span>
        <small>Updated {timeAgo(center.updated_at).toLowerCase()}</small>
      </div>
    </div>
    <div class="admin-center-capacity">
      <strong>{capacity.main}</strong>
      <span>{capacity.sub}</span>
      {load.percent != null && <div><i data-level={load.level} style={{ width: `${load.percent}%` }} /></div>}
      <div class="admin-occupancy-controls" aria-label={`Adjust occupants for ${title}`}>
        <button type="button" disabled={isSaving || center.occupants === 0} onClick={() => adjust(-10)}>−10</button>
        <button type="button" disabled={isSaving || center.occupants === 0} onClick={() => adjust(-1)}>−1</button>
        <button type="button" disabled={isSaving || center.occupants >= limit} onClick={() => adjust(1)}>+1</button>
        <button type="button" disabled={isSaving || center.occupants >= limit} onClick={() => adjust(10)}>+10</button>
      </div>
    </div>
    <div class="admin-center-actions">
      <button type="button" class={`admin-toggle${center.is_open ? ' is-on' : ''}`} role="switch" aria-checked={center.is_open} disabled={isSaving} onClick={toggleOpen}>
        <i aria-hidden="true" /> {center.is_open ? 'Open' : 'Closed'}
      </button>
      <button type="button" class="admin-icon-button" onClick={() => onEdit(center)} aria-label={`Edit ${title}`}><Icon name="edit" size={16} /></button>
      <button type="button" class="admin-icon-button is-danger" disabled={isSaving} onClick={remove} aria-label={`Remove ${title}`}>
        <Icon name="trash" size={16} />
      </button>
    </div>
    {confirmDialog}
  </article>
}

function ProgressRow({ label, done, total }) {
  const percent = total ? Math.round((done / total) * 100) : 0
  return <div class="center-progress-row">
    <span>{label}</span>
    <div class="center-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax={total} aria-valuenow={done} aria-label={label}><i style={{ width: `${percent}%` }} /></div>
    <small><b>{done}</b> of {total}</small>
  </div>
}

const CENTER_FILTERS = [
  ['all', 'All', () => true],
  ['official', 'Official', (center) => classificationOf(center) === 'official'],
  ['temporary', 'Temporary', (center) => classificationOf(center) === 'temporary'],
  ['location', 'Needs a location', (center) => !hasPin(center)],
  ['pin', 'Pin not checked', (center) => locationStatusOf(center) === 'unconfirmed'],
  ['capacity', 'Capacity not confirmed', (center) => centerCapacity(center).status === 'unverified'],
]

export function CentersPanel({ centers, loading, onAdd, onEdit, onNotice, onChanged }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const summary = centerSummary(centers)
  const open = centers.filter((center) => center.is_open)
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (center) => words.every((word) => `${center.name} ${center.barangay ?? ''} ${center.location}`.toLowerCase().includes(word))
  const visible = centers
    .filter(CENTER_FILTERS.find(([key]) => key === filter)[2])
    .filter(matches)
    .sort((a, b) => (classificationOf(a) === 'official' ? 0 : 1) - (classificationOf(b) === 'official' ? 0 : 1)
      || (a.barangay ?? '').localeCompare(b.barangay ?? '') || a.name.localeCompare(b.name))

  return <section class="admin-centers-panel">
    <div class="queue-heading">
      <div><span class="ops-eyebrow">Shelter capacity</span><h2>Evacuation centers</h2></div>
      <button type="button" class="add-alert-button" onClick={onAdd}><Icon name="plus" size={16} /> Add center</button>
    </div>
    {centers.length > 0 && <div class="center-summary">
      <div><strong>{summary.total}</strong><span>{summary.official} official · {summary.temporary} temporary{summary.unclassified ? ` · ${summary.unclassified} not classified` : ''}</span></div>
      <div><strong>{open.length}</strong><span>open · {summary.sheltered.toLocaleString()} people sheltered</span></div>
      <section class="center-progress" aria-label="Verification progress">
        <h3>Verification</h3>
        <ProgressRow label="On the map" done={summary.onMap} total={summary.total} />
        <ProgressRow label="Pins checked on site" done={summary.pinConfirmed} total={summary.onMap} />
        <div class="center-progress-row">
          <span>Capacity</span>
          <div class="center-progress-bar is-stacked" role="img" aria-label={`${summary.documented.count} official figures, ${summary.estimated.count} estimates, ${summary.unverified} not confirmed`}>
            <i class="is-documented" style={{ width: `${(summary.documented.count / summary.total) * 100}%` }} />
            <i class="is-estimated" style={{ width: `${(summary.estimated.count / summary.total) * 100}%` }} />
          </div>
          <small>
            <b class="dot is-documented" /> {summary.documented.count} official{summary.documented.count ? ` (${summary.documented.capacity.toLocaleString()} people)` : ''}
            <b class="dot is-estimated" /> {summary.estimated.count} estimated{summary.estimated.count ? ` (${formatRange(summary.estimated.low, summary.estimated.high)}, estimate only)` : ''}
            <b class="dot" /> {summary.unverified} not confirmed
          </small>
        </div>
      </section>
    </div>}
    {centers.length > 0 && <div class="center-filters">
      <div class="center-filter-chips" role="group" aria-label="Show">
        {CENTER_FILTERS.map(([key, label, test]) => <button type="button" key={key} class={filter === key ? 'is-active' : ''} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} <b>{centers.filter(test).length}</b></button>)}
      </div>
      <input type="search" value={search} onInput={(event) => setSearch(event.currentTarget.value)} placeholder="Search centers or barangays" aria-label="Search evacuation centers by name, barangay or address" />
    </div>}
    {loading && <LoadingCards label="Loading evacuation centers…" />}
    {visible.map((center) => <CenterCard center={center} key={center.id} onEdit={onEdit} onNotice={onNotice} onChanged={onChanged} />)}
    {!loading && centers.length > 0 && visible.length === 0 && <p class="admin-empty-state">No centers match. Try another filter or search.</p>}
    {!loading && centers.length === 0 && <p class="admin-empty-state">No evacuation centers yet. Add the first one so citizens can find shelter.</p>}
  </section>
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export function TeamsPanel({ staff, locations, reports, onCreated, onNotice, onDeactivate, onEndSessions }) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [newPassword, setNewPassword] = useState('')
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
      setNewPassword('')
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
        <label>Temporary password<input name="password" type="password" required minLength="8" maxLength="72" autoComplete="new-password" placeholder="Strong temporary password" value={newPassword} onInput={(event) => setNewPassword(event.currentTarget.value)} /></label>
      </div>
      <PasswordChecklist password={newPassword} />
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
          {active[0] && <p class="admin-team-current"><Icon name="navigate" size={13} /> {reportTypeLabel(active[0])} · {active[0].location} · {active[0].response_stage ?? 'Assigned'}</p>}
          <div class="admin-team-actions">
            <ConfirmButton class="admin-team-signout" label={`Sign ${person.display_name || 'rescuer'} out everywhere`} onConfirm={() => onEndSessions(person)} ask={{
              title: `Sign ${person.display_name || 'this rescuer'} out everywhere?`,
              message: 'Every device they use is signed out at once, for example after a lost phone or a suspected stolen login. They can sign in again.',
              confirmLabel: 'Sign out everywhere',
              tone: 'warning',
              icon: 'logout',
            }}>
              <Icon name="logout" size={13} /> Sign out everywhere
            </ConfirmButton>
            <ConfirmButton class="admin-team-deactivate" label={`Deactivate ${person.display_name || 'rescuer'}`} onConfirm={() => onDeactivate(person)} ask={{
              title: `Deactivate ${person.display_name || 'this rescuer'}?`,
              message: `They become a citizen account and are signed out.${active.length ? ` Their ${active.length} open ${active.length === 1 ? 'call goes' : 'calls go'} back to the queue.` : ''}`,
              confirmLabel: 'Deactivate',
              icon: 'x',
            }}>
              <Icon name="x" size={13} /> Deactivate
            </ConfirmButton>
          </div>
        </article>
      })}
      {rescuers.length === 0 && <p class="admin-empty-state">No rescuer accounts yet. Add one to start assigning calls.</p>}
      {rescuers.length > 0 && <p class="admin-field-help admin-team-note">Sign out everywhere ends a rescuer's sessions at once, for a lost phone or a suspected stolen login; they can sign in again. Deactivating also moves them back to a citizen account and returns their open calls to the queue.</p>}
    </div>
  </section>
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

const SEVERITIES = [
  { value: 'Low', hint: 'For information' },
  { value: 'Moderate', hint: 'Be prepared' },
  { value: 'High', hint: 'Act now' },
]
const AUDIENCES = [['All users', 'Everyone'], ['Citizens', 'Citizens'], ['Rescuers', 'Rescuers']]

// Who an alert was sent to, in words.
function audienceText(roles) {
  if (roles.includes('admin')) return 'Everyone'
  if (roles.includes('citizen') && roles.includes('rescuer')) return 'Citizens and rescuers'
  return roles.includes('rescuer') ? 'Rescuers' : 'Citizens'
}

export function AlertForm({ onCancel, onPublished }) {
  const now = useMinuteClock()
  const [type, setType] = useState('Flood')
  const [typeOther, setTypeOther] = useState('')
  const [severity, setSeverity] = useState('High')
  const [audience, setAudience] = useState(['Citizens', 'Rescuers'])
  const [expiryChoice, setExpiryChoice] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const toggleAudience = (value) => setAudience((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])

  const submit = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const targetRoles = audience.includes('All users')
      ? ['citizen', 'rescuer', 'admin']
      : [...(audience.includes('Citizens') ? ['citizen'] : []), ...(audience.includes('Rescuers') ? ['rescuer'] : [])]
    const typeProblem = alertTypeProblem(type, typeOther)
    // Worked out again at the moment of sending, so a time chosen a while ago
    // is checked against the current time.
    const expiry = expiryFor(expiryChoice, customEnd, Date.now())
    const problem = typeProblem || expiry.error || (!targetRoles.length ? 'Choose who should get this alert.' : '')
    if (problem) {
      setError(problem)
      return
    }
    const barangays = form.get('barangays').split(',').map((item) => item.trim()).filter(Boolean)
    setIsSaving(true)
    setError('')
    try {
      await publishAlert({
        alertType: type,
        alertTypeOther: type === 'Other' ? typeOther.trim() : null,
        severity,
        title: form.get('title').trim(),
        message: form.get('message').trim(),
        location: form.get('location').trim(),
        targetRoles,
        barangays,
        expiresAt: expiry.expiresAt,
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
    <form class="admin-create-alert alert-compose" onSubmit={submit}>
      <section class="alert-compose-section" aria-labelledby="alert-step-what">
        <h3 id="alert-step-what"><span aria-hidden="true">1</span> What is happening</h3>
        <AlertTypeField type={type} onTypeChange={(value) => { setType(value); setError('') }} other={typeOther} onOtherChange={(value) => { setTypeOther(value); setError('') }} />
        <fieldset class="alert-severity-field">
          <legend>Severity</legend>
          <div class="admin-severity-options">
            {SEVERITIES.map((item) => <button type="button" class={`admin-severity admin-severity--${item.value.toLowerCase()}${severity === item.value ? ' is-selected' : ''}`} aria-pressed={severity === item.value} onClick={() => setSeverity(item.value)} key={item.value}>
              <strong>{item.value}</strong><small>{item.hint}</small>
            </button>)}
          </div>
        </fieldset>
      </section>

      <section class="alert-compose-section" aria-labelledby="alert-step-message">
        <h3 id="alert-step-message"><span aria-hidden="true">2</span> Message</h3>
        <label>Title<input name="title" required minLength="2" maxLength="80" placeholder="e.g. Flood Alert Warning" /></label>
        <label>Message<textarea name="message" required maxLength="1000" rows="3" placeholder="What is happening, and what people should do" /></label>
      </section>

      <section class="alert-compose-section" aria-labelledby="alert-step-where">
        <h3 id="alert-step-where"><span aria-hidden="true">3</span> Where</h3>
        <div class="alert-compose-grid">
          <label>Affected area<small class="admin-field-help">Shown on the alert.</small><input name="location" required minLength="2" maxLength="160" placeholder="e.g. Riverside barangays" /></label>
          <label>Only notify these barangays<small class="admin-field-help">Comma-separated. Leave empty for the whole municipality.</small><input name="barangays" maxLength="400" placeholder="e.g. Poblacion, Catmon" /></label>
        </div>
      </section>

      <section class="alert-compose-section" aria-labelledby="alert-step-who">
        <h3 id="alert-step-who"><span aria-hidden="true">4</span> Who and until when</h3>
        <div class="alert-compose-grid">
          <fieldset class="admin-audience">
            <legend>Send to</legend>
            <div class="alert-audience-chips">
              {AUDIENCES.map(([value, label]) => <label class={`alert-audience-chip${audience.includes(value) ? ' is-checked' : ''}`} key={value}>
                <input type="checkbox" name="audience" value={value} checked={audience.includes(value)} onChange={() => toggleAudience(value)} />
                {audience.includes(value) && <Icon name="check" size={14} />}
                {label}
              </label>)}
            </div>
            <small class="admin-field-help">Everyone includes the operations team.</small>
          </fieldset>
          <ExpiryField choice={expiryChoice} onChoiceChange={(value) => { setExpiryChoice(value); setError('') }} custom={customEnd} onCustomChange={(value) => { setCustomEnd(value); setError('') }} now={now} />
        </div>
      </section>

      {error && <p class="form-error" role="alert" key={error}>{error}</p>}
      <div class="alert-compose-actions">
        <button type="button" class="alert-cancel-button" onClick={onCancel}>Cancel</button>
        <button class="admin-publish-button" type="submit" disabled={isSaving}>{isSaving && <span class="btn-spinner" aria-hidden="true" />}{isSaving ? 'Sending…' : 'Send alert'}</button>
      </div>
    </form>
  </>
}

export function AlertList({ alerts, loading, error, onEnd, onDelete }) {
  const now = useMinuteClock()
  return <div class="ops-alert-list">
    {alerts.map((alert) => {
      const level = alert.severity.replace(' Severity', '')
      return <article class={`ops-alert-item ops-alert-item--${alert.accent} alert-card`} key={alert.id}>
        <span class="ops-alert-symbol"><Icon name={alertIcon(alert)} size={18} /></span>
        <div class="alert-card-body">
          <div class="alert-card-chips">
            <span class="alert-type-chip">{alertTypeLabel(alert)}</span>
            <span class={`alert-severity-chip is-${level.toLowerCase()}`}>{level}</span>
            <span class={`alert-status-chip${alert.expiresAt ? ' is-timed' : ''}`}><Icon name="clock" size={12} /> {alert.expiresAt ? `Ends ${alertEndText(alert.expiresAt, now)}` : 'No end time'}</span>
          </div>
          <h3>{alert.title}</h3>
          <p>{alert.description}</p>
          <ul class="alert-card-facts">
            <li><Icon name="pin" size={13} /> {alert.location}</li>
            {alert.barangays?.length > 0 && <li><Icon name="home" size={13} /> Notifies {alert.barangays.join(', ')}</li>}
            <li><Icon name="users" size={13} /> {audienceText(alert.targetRoles)}</li>
            <li><Icon name="send" size={13} /> Sent {timeAgo(alert.createdAt).toLowerCase()}</li>
          </ul>
        </div>
        {(onEnd || onDelete) && <div class="admin-alert-actions">
          {onEnd && <ConfirmButton class="admin-alert-end" label={`End ${alert.title}`} onConfirm={() => onEnd(alert)} ask={{
            title: `End "${alert.title}"?`,
            message: 'It stops showing for everyone right away. Use this when the danger is over.',
            confirmLabel: 'End alert',
            tone: 'warning',
            icon: 'bell',
          }}><Icon name="check" size={13} /> End alert</ConfirmButton>}
          {onDelete && <ConfirmButton class="admin-icon-button is-danger" label={`Delete ${alert.title}`} onConfirm={() => onDelete(alert)} ask={{
            title: `Delete "${alert.title}"?`,
            message: 'It is removed for everyone and from the records. This cannot be undone. To stop showing it but keep the record, end it instead.',
            confirmLabel: 'Delete alert',
            icon: 'trash',
          }}><Icon name="trash" size={14} /></ConfirmButton>}
        </div>}
      </article>
    })}
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
          {event.action === 'SOS sent' ? <p><b>{actor}</b> sent an <b>SOS</b>{report ? ` from ${report.location}` : ''}</p> : <p><b>{actor}</b> {event.action === 'Assigned' ? (event.detail === event.actor_id ? 'took' : `assigned ${assignee ?? 'a team'} to`) : handedBack ? 'handed back' : actionVerb[event.action] ?? event.action.toLowerCase()} {report ? <>the <b>{report.report_type === 'SOS' ? 'SOS' : reportTypeLabel(report).toLowerCase()}</b> report at {report.location}</> : 'a report'}</p>}
          <small>{timeAgo(event.created_at)}</small>
        </div>
      </li>
    })}
    {!loading && events.length === 0 && <li class="admin-empty-state">No activity yet.</li>}
  </ol>
}
