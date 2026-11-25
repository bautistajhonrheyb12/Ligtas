import { useEffect, useState } from 'preact/hooks'
import { addMapPoint, saveEvacuationCenter } from '../../lib/supabase.js'
import { PinPicker } from '../../components/PinPicker.jsx'
import { Portal } from '../../components/Portal.jsx'
import { BARANGAYS, CAPACITY_GUIDES, FACILITY_TYPES, MDRRMO_GUIDANCE, centerCapacity, facilityTypeLabel, findDuplicate } from '../../lib/centers.js'

function Modal({ title, eyebrow, onClose, children, wide = false }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  return <Portal><div class="alert-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section class={`alert-modal${wide ? ' admin-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
      <div class="alert-modal-heading">
        <div><span class="ops-eyebrow">{eyebrow}</span><h2 id="admin-modal-title">{title}</h2></div>
        <button type="button" class="alert-modal-close" aria-label="Close" onClick={onClose}>×</button>
      </div>
      {children}
    </section>
  </div></Portal>
}

const CLASSIFICATIONS = [
  ['official', 'Official evacuation center', 'Designated by the MDRRMO (listed as Permanent in the inventory).'],
  ['temporary', 'Temporary evacuation site', 'A court, chapel, school or hall used to shelter evacuees when needed. Not an officially designated center.'],
]
const CAPACITY_MODES = [
  ['documented', 'Official figure', 'A registered capacity from the MDRRMO or the facility.'],
  ['estimated', 'Estimate', 'A range such as the MDRRMO guide for courts and chapels. Residents see it marked as an estimate.'],
  ['unverified', 'Not confirmed yet', 'No number is shown. Residents see "capacity not confirmed".'],
]
const PIN_BY_ADMIN = 'Placed by an admin'
const PIN_FROM_SUGGESTION = 'Suggested spot from map data, placed by an admin'

// Adds or edits an evacuation center: what it is (official or temporary), its
// capacity (official, estimated or not confirmed), its map pin and whether the
// pin was checked on site, and where the record comes from.
export function CenterForm({ center, centers = [], initialPosition = null, onClose, onSaved }) {
  const startPin = center?.latitude != null ? { latitude: center.latitude, longitude: center.longitude } : initialPosition
  const [position, setPosition] = useState(startPin)
  const [pinConfirmed, setPinConfirmed] = useState(center?.location_status === 'confirmed')
  const [locationSource, setLocationSource] = useState(center?.location_source ?? (initialPosition ? PIN_BY_ADMIN : ''))
  const [classification, setClassification] = useState(center?.classification ?? '')
  const startCapacity = centerCapacity(center ?? { capacity: null, capacity_status: 'unverified' })
  const [capacityMode, setCapacityMode] = useState(center ? startCapacity.status : '')
  const [capacityLow, setCapacityLow] = useState(startCapacity.low ?? '')
  const [capacityHigh, setCapacityHigh] = useState(startCapacity.status === 'estimated' ? startCapacity.high : '')
  const [capacitySource, setCapacitySource] = useState(center?.capacity_source ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  // Set for a few seconds after a tap outside Santa Maria on the pin map.
  const [pinOutside, setPinOutside] = useState(0)
  const suggestion = center?.suggested_latitude != null ? { latitude: center.suggested_latitude, longitude: center.suggested_longitude } : null

  useEffect(() => {
    if (!pinOutside) return undefined
    const timer = setTimeout(() => setPinOutside(0), 4000)
    return () => clearTimeout(timer)
  }, [pinOutside])

  // A pin that moves has not been checked on site.
  const movePin = (next, source) => {
    setPinOutside(0)
    setPosition(next)
    setPinConfirmed(false)
    setLocationSource(next ? source : '')
  }

  const applyGuide = (guide) => {
    setCapacityMode('estimated')
    setCapacityLow(guide.low)
    setCapacityHigh(guide.high)
    setCapacitySource(`${MDRRMO_GUIDANCE}: ${guide.label.toLowerCase()}, about ${guide.low}–${guide.high} people`)
  }

  const submit = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = form.get('name').trim()
    const barangay = form.get('barangay')
    const occupants = Number(form.get('occupants'))
    const low = Number(capacityLow)
    const high = Number(capacityHigh)
    const problem = !classification ? 'Choose whether this is an official evacuation center or a temporary site.'
      : !barangay ? 'Choose the barangay.'
        : !form.get('facilityType') ? 'Choose the facility type.'
        : !capacityMode ? 'Choose how the capacity is known.'
          : capacityMode === 'documented' && !(low >= 1) ? 'Enter the registered capacity.'
            : capacityMode === 'estimated' && !(low >= 1 && high >= low) ? 'Enter the estimate as a range, for example 100 to 150.'
              : capacityMode === 'estimated' && !capacitySource.trim() ? 'Say where the estimate comes from (for example, MDRRMO guidance).'
                : capacityMode !== 'unverified' && occupants > (capacityMode === 'estimated' ? high : low) ? 'Occupants cannot be more than the capacity.'
                  : findDuplicate(centers, { id: center?.id, name, barangay }) ? `${name} is already listed in ${barangay}. Edit that record instead of adding it again.`
                    : ''
    if (problem) {
      setError(problem)
      return
    }
    setIsSaving(true)
    setError('')
    try {
      const saved = await saveEvacuationCenter({
        id: center?.id,
        name,
        location: form.get('location').trim(),
        barangay,
        classification,
        facilityType: form.get('facilityType'),
        contactNumbers: form.get('contactNumbers').trim(),
        latitude: position?.latitude ?? null,
        longitude: position?.longitude ?? null,
        locationStatus: position ? (pinConfirmed ? 'confirmed' : 'unconfirmed') : 'unknown',
        locationSource: position ? locationSource || PIN_BY_ADMIN : '',
        capacityStatus: capacityMode,
        capacity: capacityMode === 'unverified' ? null : low,
        capacityMax: capacityMode === 'estimated' ? high : null,
        capacitySource: capacityMode === 'unverified' ? '' : capacitySource.trim(),
        occupants,
        isOpen: form.get('isOpen') === 'on',
        source: form.get('source').trim(),
        remarks: form.get('remarks').trim(),
        verificationNotes: form.get('verificationNotes').trim(),
      })
      onSaved(saved)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  const topOfCapacity = capacityMode === 'estimated' ? Number(capacityHigh) || 100000 : capacityMode === 'documented' ? Number(capacityLow) || 100000 : 100000

  return <Modal title={center ? 'Edit evacuation center' : 'Add evacuation center'} eyebrow="Evacuation centers" onClose={onClose} wide>
    <form class="center-compose" onSubmit={submit}>
      <section class="center-compose-section">
        <h3><span>1</span> The facility</h3>
        <div class="center-compose-grid">
          <label class="is-wide">Official name<input name="name" required minLength="2" maxLength="120" defaultValue={center?.name ?? ''} placeholder="e.g. Sta. Clara Covered Court" /></label>
          <label>Barangay<select name="barangay" required defaultValue={center?.barangay ?? ''}>
            <option value="" disabled>Choose…</option>
            {BARANGAYS.map((name) => <option value={name} key={name}>{name}</option>)}
          </select></label>
          <label>Facility type<select name="facilityType" required defaultValue={center?.facility_type ?? ''}>
            <option value="" disabled>Choose…</option>
            {FACILITY_TYPES.map((type) => <option value={type} key={type}>{facilityTypeLabel(type)}</option>)}
          </select></label>
          <label class="is-wide">Address<input name="location" required minLength="2" maxLength="160" defaultValue={center?.location ?? ''} placeholder="Street or sitio, barangay, Santa Maria, Bulacan" /></label>
          <label class="is-wide">Contact numbers <small class="admin-field-help">Optional. Separate numbers with “/”.</small><input name="contactNumbers" maxLength="120" defaultValue={center?.contact_numbers ?? ''} placeholder="e.g. 0917-123-4567 / 0998-765-4321" /></label>
        </div>
        <fieldset class="center-choice-group">
          <legend>Classification</legend>
          <div class="center-choices">
            {CLASSIFICATIONS.map(([value, label, help]) => <label class={`center-choice is-${value}${classification === value ? ' is-selected' : ''}`} key={value}>
              <input type="radio" name="classification" value={value} checked={classification === value} onChange={() => setClassification(value)} required />
              <strong>{label}</strong><small>{help}</small>
            </label>)}
          </div>
        </fieldset>
      </section>

      <section class="center-compose-section">
        <h3><span>2</span> Capacity</h3>
        <fieldset class="center-choice-group">
          <legend>How is the capacity known?</legend>
          <div class="center-choices is-three">
            {CAPACITY_MODES.map(([value, label, help]) => <label class={`center-choice${capacityMode === value ? ' is-selected' : ''}`} key={value}>
              <input type="radio" name="capacityStatus" value={value} checked={capacityMode === value} onChange={() => setCapacityMode(value)} required />
              <strong>{label}</strong><small>{help}</small>
            </label>)}
          </div>
        </fieldset>
        {capacityMode === 'documented' && <div class="center-compose-grid field-reveal">
          <label>Registered capacity (people)<input type="number" min="1" max="100000" required value={capacityLow} onInput={(event) => setCapacityLow(event.currentTarget.value)} /></label>
          <label>Source <small class="admin-field-help">Optional</small><input maxLength="200" value={capacitySource} onInput={(event) => setCapacitySource(event.currentTarget.value)} placeholder="e.g. MDRRMO registry" /></label>
        </div>}
        {capacityMode === 'estimated' && <div class="center-estimate field-reveal">
          <div class="center-guides">
            <span>MDRRMO guide:</span>
            {CAPACITY_GUIDES.map((guide) => <button type="button" key={guide.id} class={Number(capacityLow) === guide.low && Number(capacityHigh) === guide.high && capacitySource.includes(guide.label.toLowerCase()) ? 'is-selected' : ''} onClick={() => applyGuide(guide)}>{guide.label} · {guide.low}–{guide.high}</button>)}
          </div>
          <div class="center-compose-grid">
            <label>From (people)<input type="number" min="1" max="100000" required value={capacityLow} onInput={(event) => setCapacityLow(event.currentTarget.value)} /></label>
            <label>To (people)<input type="number" min="1" max="100000" required value={capacityHigh} onInput={(event) => setCapacityHigh(event.currentTarget.value)} /></label>
            <label class="is-wide">Source of the estimate<input maxLength="200" required value={capacitySource} onInput={(event) => setCapacitySource(event.currentTarget.value)} placeholder="e.g. MDRRMO guidance" /></label>
          </div>
          <p class="admin-field-help">Size matters: use the smaller-chapel range for a small chapel, and record the official figure once there is one.</p>
        </div>}
        {capacityMode === 'unverified' && <p class="center-compose-note field-reveal">No number will be shown. Residents and the dashboard will say the capacity is not confirmed.</p>}
        <div class="center-compose-grid">
          <label>People here now<input name="occupants" type="number" required min="0" max={topOfCapacity} defaultValue={center?.occupants ?? 0} /></label>
          <label class="check-row center-open-check"><input type="checkbox" name="isOpen" defaultChecked={center?.is_open ?? true} /> Open: residents may be sent here</label>
        </div>
      </section>

      <section class="center-compose-section">
        <h3><span>3</span> Map location</h3>
        {!position && suggestion && <div class="center-suggestion">
          <span><strong>Map data suggests a possible spot</strong> (not checked): {suggestion.latitude.toFixed(5)}, {suggestion.longitude.toFixed(5)}. See the notes below.</span>
          <button type="button" class="secondary-action" onClick={() => movePin(suggestion, PIN_FROM_SUGGESTION)}>Place the pin there</button>
        </div>}
        <div class="admin-pin-field">
          <span>Pin {pinOutside
            ? <small class="pin-outside" role="status">That spot is outside Santa Maria. Tap inside the town.</small>
            : <small>{position ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}${locationSource ? ` · ${locationSource}` : ''}` : 'No pin: residents see the address only. Tap the map on the actual building.'}</small>}</span>
          <PinPicker position={position} onChange={(next) => movePin(next, PIN_BY_ADMIN)} onOutside={() => setPinOutside((count) => count + 1)} />
        </div>
        {position && <div class="center-pin-actions">
          <label class="check-row"><input type="checkbox" checked={pinConfirmed} onChange={(event) => setPinConfirmed(event.currentTarget.checked)} /> I checked on site that the pin is on the actual building</label>
          <button type="button" class="inline-link" onClick={() => movePin(null, '')}>Remove the pin</button>
        </div>}
      </section>

      <section class="center-compose-section">
        <h3><span>4</span> Record</h3>
        <div class="center-compose-grid">
          <label class="is-wide">Source of this record<input name="source" maxLength="200" defaultValue={center?.source ?? ''} placeholder="e.g. Inventory of Evacuation Centers" /></label>
          <label class="is-wide">Remarks for residents <small class="admin-field-help">Optional. Shown in the center’s details.</small><textarea name="remarks" rows="2" maxLength="600" defaultValue={center?.remarks ?? ''} /></label>
          <label class="is-wide">What still needs checking <small class="admin-field-help">For admins only.</small><textarea name="verificationNotes" rows="3" maxLength="800" defaultValue={center?.verification_notes ?? ''} /></label>
        </div>
      </section>

      {error && <p class="form-error" role="alert" key={error}>{error}</p>}
      <div class="center-compose-actions">
        <button type="button" class="alert-cancel-button" onClick={onClose}>Cancel</button>
        <button type="submit" class="add-alert-button" disabled={isSaving}>{isSaving && <span class="btn-spinner" aria-hidden="true" />}{center ? 'Save changes' : 'Add center'}</button>
      </div>
    </form>
  </Modal>
}

const defaultNames = { 'Danger zone': 'Danger zone', 'Closed road': 'Closed road', 'Other info': 'Notice' }

export function PointForm({ pointType, position, onClose, onSaved }) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setIsSaving(true)
    setError('')
    try {
      const saved = await addMapPoint({
        name: form.get('name').trim(),
        pointType,
        severity: form.get('severity'),
        description: form.get('description').trim() || null,
        latitude: position.latitude,
        longitude: position.longitude,
      })
      onSaved(saved)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return <Modal title={`New ${pointType.toLowerCase()}`} eyebrow={`${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`} onClose={onClose}>
    <form class="alert-form" onSubmit={submit}>
      <label>Name<input name="name" required minLength="2" maxLength="120" defaultValue={defaultNames[pointType]} autoFocus /></label>
      <label>Severity<select name="severity" defaultValue={pointType === 'Danger zone' ? 'High' : 'Medium'}><option>High</option><option>Medium</option><option>Low</option></select></label>
      <label>Details for the public<textarea name="description" rows="3" maxLength="300" placeholder="e.g. Waist-deep flooding, avoid this road" /></label>
      {error && <p class="form-error" role="alert" key={error}>{error}</p>}
      <div class="alert-form-actions">
        <button type="button" class="alert-cancel-button" onClick={onClose}>Cancel</button>
        <button type="submit" class="add-alert-button" disabled={isSaving}>{isSaving && <span class="btn-spinner" aria-hidden="true" />}Save point</button>
      </div>
    </form>
  </Modal>
}

export { Modal }
