import { useEffect, useState } from 'preact/hooks'
import { addMapPoint, saveEvacuationCenter } from '../../lib/supabase.js'
import { PinPicker } from '../../components/PinPicker.jsx'

function Modal({ title, eyebrow, onClose, children, wide = false }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  return <div class="alert-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section class={`alert-modal${wide ? ' admin-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
      <div class="alert-modal-heading">
        <div><span class="ops-eyebrow">{eyebrow}</span><h2 id="admin-modal-title">{title}</h2></div>
        <button type="button" class="alert-modal-close" aria-label="Close" onClick={onClose}>×</button>
      </div>
      {children}
    </section>
  </div>
}

export function CenterForm({ center, initialPosition = null, onClose, onSaved }) {
  const [position, setPosition] = useState(center?.latitude != null
    ? { latitude: center.latitude, longitude: center.longitude }
    : initialPosition)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const capacity = Number(form.get('capacity'))
    const occupants = Number(form.get('occupants'))
    if (occupants > capacity) {
      setError('Occupants cannot be more than the capacity.')
      return
    }
    setIsSaving(true)
    setError('')
    try {
      const saved = await saveEvacuationCenter({
        id: center?.id,
        name: form.get('name').trim(),
        location: form.get('location').trim(),
        latitude: position?.latitude ?? null,
        longitude: position?.longitude ?? null,
        capacity,
        occupants,
        isOpen: form.get('isOpen') === 'on',
      })
      onSaved(saved)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return <Modal title={center ? 'Edit evacuation center' : 'Add evacuation center'} eyebrow="Shelter capacity" onClose={onClose} wide>
    <form class="alert-form admin-center-form" onSubmit={submit}>
      <label>Name<input name="name" required minLength="2" maxLength="120" defaultValue={center?.name ?? ''} placeholder="e.g. Catmon Elementary School" /></label>
      <label>Address or area<input name="location" required minLength="2" maxLength="160" defaultValue={center?.location ?? ''} placeholder="Barangay, Santa Maria" /></label>
      <div class="admin-form-row">
        <label>Capacity<input name="capacity" type="number" required min="1" max="100000" defaultValue={center?.capacity ?? ''} /></label>
        <label>Current occupants<input name="occupants" type="number" required min="0" max="100000" defaultValue={center?.occupants ?? 0} /></label>
      </div>
      <label class="check-row"><input type="checkbox" name="isOpen" defaultChecked={center?.is_open ?? true} /> Open and accepting evacuees</label>
      <div class="admin-pin-field">
        <span>Map location <small>{position ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : 'Tap the map to place the center'}</small></span>
        <PinPicker position={position} onChange={setPosition} />
      </div>
      {error && <p class="form-error" role="alert" key={error}>{error}</p>}
      <div class="alert-form-actions">
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
