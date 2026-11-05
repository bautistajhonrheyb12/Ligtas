import { useEffect, useState } from 'preact/hooks'
import { isNetworkError, submitIncidentReport } from '../../lib/supabase.js'
import { PinPicker } from '../../components/PinPicker.jsx'
import { queueReport } from '../../lib/offlineQueue.js'
import { isInsideSantaMaria } from '../../lib/santaMaria.js'
import { Icon, getCurrentPosition, reportTypeStyle } from '../../lib/ui.jsx'

const REPORT_TYPES = ['Flooding', 'Blocked road', 'Fallen tree', 'Power outage', 'Landslide', 'Fire', 'Medical', 'Other']
// Photos are resized before upload, so only reject files too big to process on a phone.
const MAX_PHOTO_BYTES = 25 * 1024 * 1024

export function ReportDialog({ t, ownerId, hasPhone, onAddPhone, onClose, onDone }) {
  const [reportType, setReportType] = useState('Flooding')
  const [location, setLocation] = useState('')
  const [position, setPosition] = useState(null)
  const [isLocating, setIsLocating] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [peopleAffected, setPeopleAffected] = useState('')
  const [vulnerablePeople, setVulnerablePeople] = useState(false)
  const [inDanger, setInDanger] = useState(false)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview) }, [photoPreview])

  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape' && !isSubmitting) onClose() }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isSubmitting])

  const locate = async () => {
    setIsLocating(true)
    setError('')
    try {
      const here = await getCurrentPosition()
      // The database refuses GPS positions outside Santa Maria, so say so now.
      if (!isInsideSantaMaria(here.latitude, here.longitude)) {
        setError(t('outsideAreaReport'))
        return
      }
      setPosition({ ...here, source: 'gps' })
    } catch (locateError) {
      setError(locateError.message)
    } finally {
      setIsLocating(false)
    }
  }

  const choosePhoto = (event) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > MAX_PHOTO_BYTES) {
      setError(t('photoTooLarge'))
      return
    }
    setError('')
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const submit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    const report = {
      reportType,
      location: location.trim(),
      notes: notes.trim(),
      latitude: position?.latitude ?? null,
      longitude: position?.longitude ?? null,
      locationSource: position?.source ?? null,
      photoFile,
      priority: inDanger ? 'Urgent' : 'Normal',
      peopleAffected: peopleAffected === '' ? null : Number(peopleAffected),
      vulnerablePeople,
    }
    try {
      if (!navigator.onLine) {
        queueReport(report, ownerId)
        onDone('queued')
        return
      }
      await submitIncidentReport(report)
      onDone('sent')
    } catch (submitError) {
      if (isNetworkError(submitError)) {
        queueReport(report, ownerId)
        onDone('queued')
        return
      }
      setError(submitError instanceof Error ? submitError.message : 'Could not submit incident report.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return <div class="alert-modal-backdrop citizen-report-backdrop" onClick={(event) => {
    if (event.target === event.currentTarget && !isSubmitting) onClose()
  }}>
    <section class="alert-modal citizen-report-dialog" role="dialog" aria-modal="true" aria-labelledby="citizen-report-title">
      <div class="alert-modal-heading">
        <div><span class="ops-eyebrow">{t('reportEyebrow')}</span><h2 id="citizen-report-title">{t('reportTitle')}</h2></div>
        <button type="button" class="alert-modal-close" aria-label={t('close')} disabled={isSubmitting} onClick={onClose}>×</button>
      </div>
      <p class="incident-report-prompt">{t('reportPrompt')}</p>
      {!hasPhone && <p class="report-phone-hint"><Icon name="phone" size={15} /><span>{t('phoneHint')}</span><button type="button" onClick={onAddPhone}>{t('addPhone')}</button></p>}
      <div class="report-type-grid" role="group" aria-label="Incident type">
        {REPORT_TYPES.map((type) => {
          const style = reportTypeStyle(type)
          return <button
            type="button"
            key={type}
            class={`report-type rx-tone--${style.tone}${reportType === type ? ' active' : ''}`}
            aria-pressed={reportType === type}
            onClick={() => setReportType(type)}
          >
            <span class="report-type-icon"><Icon name={style.icon} size={18} /></span>
            {t('types')[type]}
          </button>
        })}
      </div>
      {error && <p class="form-error" role="alert" key={error}>{error}</p>}
      <form class="citizen-report-form" onSubmit={submit}>
        <label>
          {t('locationLabel')}
          <div class="location-input">
            <input name="location" type="text" required minLength="2" maxLength="160" placeholder={t('locationPlaceholder')} value={location} onInput={(event) => setLocation(event.currentTarget.value)} />
            <button type="button" class="location-button" onClick={locate} disabled={isLocating} aria-label={t('useMyLocation')} title={t('useMyLocation')}>
              {isLocating ? <span class="btn-spinner" aria-hidden="true" /> : <Icon name="locate" size={18} />}
            </button>
          </div>
        </label>
        <div class="pin-picker-wrap">
          <PinPicker position={position} onChange={(next) => setPosition({ ...next, source: 'pin' })} />
          <div class="pin-picker-caption">
            {position
              ? <><span class="pin-attached"><Icon name="check" size={14} /> {t('locationAttached')}</span><button type="button" onClick={() => setPosition(null)}>{t('removePin')}</button></>
              : <span>{t('pinOnMap')}</span>}
          </div>
        </div>

        <div class="photo-field">
          <span class="photo-field-label">{t('photoLabel')}</span>
          {photoPreview && <img class="photo-preview" src={photoPreview} alt="" />}
          <div class="photo-actions">
            <label class="secondary-action photo-button">
              <Icon name="camera" size={18} /> {photoFile ? t('changePhoto') : t('addPhoto')}
              <input type="file" accept="image/*" onChange={choosePhoto} />
            </label>
            {photoFile && <button type="button" class="photo-remove" onClick={() => { setPhotoFile(null); setPhotoPreview('') }}>{t('removePhoto')}</button>}
          </div>
        </div>

        <div class="report-extra">
          <label>
            {t('peopleLabel')}
            <input type="number" min="0" max="10000" inputMode="numeric" value={peopleAffected} onInput={(event) => setPeopleAffected(event.currentTarget.value)} placeholder="0" />
          </label>
          <label class="check-row"><input type="checkbox" checked={inDanger} onChange={(event) => setInDanger(event.currentTarget.checked)} /> {t('dangerLabel')}</label>
          <label class="check-row"><input type="checkbox" checked={vulnerablePeople} onChange={(event) => setVulnerablePeople(event.currentTarget.checked)} /> {t('vulnerableLabel')}</label>
        </div>

        <label>
          {t('notesLabel')}
          <textarea name="notes" required maxLength="1000" rows="3" placeholder={t('notesPlaceholder')} value={notes} onInput={(event) => setNotes(event.currentTarget.value)} />
        </label>
        <button type="submit" class="primary report-submit" disabled={isSubmitting}>
          {isSubmitting && <span class="btn-spinner" aria-hidden="true" />}
          {isSubmitting ? t('submitting') : t('submitReport')}
        </button>
      </form>
    </section>
  </div>
}
