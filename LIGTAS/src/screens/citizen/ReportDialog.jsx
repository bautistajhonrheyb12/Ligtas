import { useEffect, useRef, useState } from 'preact/hooks'
import { SESSION_ENDED, isNetworkError, submitIncidentReport } from '../../lib/supabase.js'
import { PinPicker } from '../../components/PinPicker.jsx'
import { coordinatesLabel, describeLocation } from '../../lib/geocode.js'
import { queueReport } from '../../lib/offlineQueue.js'
import { isInsideSantaMaria } from '../../lib/santaMaria.js'
import { Icon, getCurrentPosition, reportTypeStyle } from '../../lib/ui.jsx'
import { rescueHotline } from '../../lib/hotlines.js'

const REPORT_TYPES = ['Flooding', 'Blocked road', 'Fallen tree', 'Power outage', 'Landslide', 'Fire', 'Medical', 'Other']
// Photos are resized before upload, so only reject files too big to process on a phone.
const MAX_PHOTO_BYTES = 25 * 1024 * 1024

// limit: a report limit already reached (lib/limits.js); the form is replaced
// by an explanation, with SOS and the hotline for emergencies.
export function ReportDialog({ t, ownerId, hasPhone, onAddPhone, onClose, onDone, limit: limitNow = null, onSos }) {
  // Decided when the form opens, so it never changes while a report is being sent.
  const [limit] = useState(limitNow)
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
  // Set for a few seconds after a tap outside Santa Maria on the pin map.
  const [pinOutside, setPinOutside] = useState(0)

  useEffect(() => {
    if (!pinOutside) return undefined
    const timer = setTimeout(() => setPinOutside(0), 4000)
    return () => clearTimeout(timer)
  }, [pinOutside])

  // The address of the pin, looked up whenever the pin is placed or moved.
  // It fills the location field unless the person has typed their own text,
  // in which case it is offered instead.
  const [lookup, setLookup] = useState({ status: 'idle', label: '', filled: false })
  const autoFilledRef = useRef('')
  const locationRef = useRef(location)
  locationRef.current = location

  const fillLocation = (label) => {
    const current = locationRef.current.trim()
    if (current && current !== autoFilledRef.current) return false
    autoFilledRef.current = label
    setLocation(label)
    return true
  }

  useEffect(() => {
    if (!position) {
      if (autoFilledRef.current && locationRef.current === autoFilledRef.current) setLocation('')
      autoFilledRef.current = ''
      setLookup({ status: 'idle', label: '', filled: false })
      return undefined
    }
    const fallback = () => {
      const label = coordinatesLabel(position.latitude, position.longitude)
      setLookup({ status: 'failed', label, filled: fillLocation(label) })
    }
    if (!navigator.onLine) {
      fallback()
      return undefined
    }
    const controller = new AbortController()
    setLookup({ status: 'looking', label: '', filled: false })
    const show = (result, isFinal) => setLookup({ status: isFinal ? 'done' : 'looking', label: result.label, filled: fillLocation(result.label) })
    describeLocation(position.latitude, position.longitude, { signal: controller.signal, onPartial: (result) => show(result, false) })
      .then((result) => show(result, true))
      .catch((lookupError) => { if (lookupError.name !== 'AbortError') fallback() })
    return () => controller.abort()
  }, [position])

  const useSuggestedAddress = () => {
    autoFilledRef.current = lookup.label
    setLocation(lookup.label)
    setLookup((current) => ({ ...current, filled: true }))
  }

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
      locationAccuracy: position?.source === 'gps' ? position.accuracy ?? null : null,
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
      // Signed out elsewhere: keep the report, which is sent after signing in
      // again (the app is already returning to the sign-in screen).
      if (submitError?.code === SESSION_ENDED) queueReport(report, ownerId)
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
      {limit && <div class="report-limit" role="alert">
        <span class="report-limit-icon" aria-hidden="true"><Icon name="clock" size={22} /></span>
        <h3>{t(`limit_${limit}_title`)}</h3>
        <p>{t(`limit_${limit}_text`)}</p>
        <p class="report-limit-emergency">{t('limitEmergency')}</p>
        <div class="report-limit-actions">
          <button type="button" class="report-limit-sos" onClick={onSos}><Icon name="sos" size={18} /> {t('limitSos')}</button>
          <a class="report-limit-call" href={`tel:${rescueHotline.number}`}><Icon name="phone" size={17} /> {t('limitCall', { name: rescueHotline.name })}</a>
        </div>
      </div>}
      {!limit && <>
      <p class="incident-report-prompt">{t('reportPrompt')}</p>
      {!hasPhone &&<p class="report-phone-hint"><Icon name="phone" size={15} /><span>{t('phoneHint')}</span><button type="button" onClick={onAddPhone}>{t('addPhone')}</button></p>}
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
            {/* Two lines, so a full address stays readable on a phone. */}
            <textarea name="location" rows="2" required minLength="2" maxLength="160" placeholder={t('locationPlaceholder')} value={location} onInput={(event) => setLocation(event.currentTarget.value.replace(/\s*\n\s*/g, ' '))} />
            <button type="button" class="location-button" onClick={locate} disabled={isLocating} aria-label={t('useMyLocation')} title={t('useMyLocation')}>
              {isLocating ? <span class="btn-spinner" aria-hidden="true" /> : <Icon name="locate" size={18} />}
            </button>
          </div>
        </label>
        {lookup.status !== 'idle' && <p class={`address-status address-status--${lookup.status}`} role="status">
          {lookup.status === 'looking' && !lookup.label && <><span class="btn-spinner" aria-hidden="true" /> <span>{t('addressLooking')}</span></>}
          {(lookup.status === 'done' || (lookup.status === 'looking' && lookup.label)) && (lookup.filled
            ? <><Icon name="check" size={14} /> <span>{t('addressFilled')}</span></>
            : <><Icon name="pin" size={14} /> <span>{t('addressSuggest', { address: lookup.label })}</span> <button type="button" onClick={useSuggestedAddress}>{t('addressUse')}</button></>)}
          {lookup.status === 'failed' && (lookup.filled
            ? <><Icon name="alert" size={14} /> <span>{t('addressFailed')}</span></>
            : <><Icon name="pin" size={14} /> <span>{t('addressSuggest', { address: lookup.label })}</span> <button type="button" onClick={useSuggestedAddress}>{t('addressUse')}</button></>)}
        </p>}
        <div class="pin-picker-wrap">
          <PinPicker position={position} onChange={(next) => { setPinOutside(0); setPosition({ ...next, source: 'pin' }) }} onOutside={() => setPinOutside((count) => count + 1)} />
          <div class="pin-picker-caption">
            {pinOutside
              ? <span class="pin-outside" role="status"><Icon name="alert" size={14} /> {t('pinOutside')}</span>
              : position
              ? <><span class="pin-attached"><Icon name="check" size={14} /> {position.source === 'gps' ? t('locationAttached') : t('pinAttached')}</span><button type="button" onClick={() => setPosition(null)}>{t('removePin')}</button></>
              : <span>{t('pinOnMap')}</span>}
          </div>
          {position?.source === 'gps' && position.accuracy > 30 && <p class="gps-accuracy-hint">{t('gpsAccuracyHint', { meters: Math.round(position.accuracy) })}</p>}
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
      </>}
    </section>
  </div>
}
