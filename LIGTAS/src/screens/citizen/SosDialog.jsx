import { useEffect, useState } from 'preact/hooks'
import { isNetworkError, saveCheckin, submitIncidentReport } from '../../lib/supabase.js'
import { Icon, getCurrentPosition } from '../../lib/ui.jsx'

// SOS skips admin review and reaches rescuers immediately, so it asks for
// one deliberate confirmation and always offers a phone fallback.
export function SosDialog({ t, onClose, onSent }) {
  const [position, setPosition] = useState(null)
  const [locationState, setLocationState] = useState('locating')
  const [locationText, setLocationText] = useState('')
  const [note, setNote] = useState('')
  const [phase, setPhase] = useState('confirm')
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true
    getCurrentPosition()
      .then((coords) => {
        if (!isMounted) return
        setPosition(coords)
        setLocationState('ready')
      })
      .catch(() => { if (isMounted) setLocationState('failed') })
    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape' && phase !== 'sending') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [phase])

  const send = async (event) => {
    event.preventDefault()
    if (!navigator.onLine) {
      setPhase('offline')
      return
    }
    setPhase('sending')
    setError('')
    try {
      await submitIncidentReport({
        reportType: 'SOS',
        location: position ? `GPS ${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : locationText.trim(),
        notes: note.trim() || 'SOS: needs immediate help.',
        latitude: position?.latitude ?? null,
        longitude: position?.longitude ?? null,
        priority: 'Critical',
      })
      saveCheckin({ status: 'Need help', note: note.trim() || null, latitude: position?.latitude ?? null, longitude: position?.longitude ?? null }).catch(() => {})
      setPhase('sent')
      onSent()
    } catch (sendError) {
      if (isNetworkError(sendError)) {
        setPhase('offline')
        return
      }
      setError(sendError instanceof Error ? sendError.message : 'Could not send SOS.')
      setPhase('confirm')
    }
  }

  const needsLocationText = locationState === 'failed'

  return <div class="alert-modal-backdrop sos-backdrop" onClick={(event) => {
    if (event.target === event.currentTarget && phase !== 'sending') onClose()
  }}>
    <section class="alert-modal sos-dialog" role="alertdialog" aria-modal="true" aria-labelledby="sos-title" aria-describedby="sos-text">
      <div class="sos-badge" aria-hidden="true"><Icon name="sos" size={34} /></div>
      {(phase === 'confirm' || phase === 'sending') && <form onSubmit={send}>
        <h2 id="sos-title">{t('sosTitle')}</h2>
        <p id="sos-text">{t('sosText')}</p>
        <div class={`sos-location sos-location--${locationState}`}>
          <Icon name={locationState === 'ready' ? 'check' : 'locate'} size={16} />
          {locationState === 'locating' && t('sosGettingLocation')}
          {locationState === 'ready' && t('sosLocationReady', { accuracy: Math.round(position.accuracy) })}
          {needsLocationText && t('sosLocationFailed')}
        </div>
        {needsLocationText && <input class="sos-input" required minLength="2" maxLength="160" value={locationText} onInput={(event) => setLocationText(event.currentTarget.value)} placeholder={t('sosLocationPlaceholder')} aria-label={t('locationLabel')} />}
        <label class="sos-note">
          {t('sosNoteLabel')}
          <textarea rows="2" maxLength="500" value={note} onInput={(event) => setNote(event.currentTarget.value)} placeholder={t('sosNotePlaceholder')} />
        </label>
        {error && <p class="form-error" role="alert" key={error}>{error}</p>}
        <div class="sos-actions">
          <button type="button" class="sos-cancel" onClick={onClose} disabled={phase === 'sending'}>{t('cancel')}</button>
          <button type="submit" class="sos-send" disabled={phase === 'sending' || locationState === 'locating'}>
            {phase === 'sending' && <span class="btn-spinner" aria-hidden="true" />}
            {phase === 'sending' ? t('sosSending') : t('sosSend')}
          </button>
        </div>
      </form>}
      {phase === 'sent' && <div class="sos-result">
        <h2 id="sos-title">{t('sosButton')} ✓</h2>
        <p id="sos-text">{t('sosSent')}</p>
        <div class="sos-actions">
          <a class="sos-call" href="tel:911"><Icon name="phone" size={18} /> {t('sosCall')}</a>
          <button type="button" class="sos-cancel" onClick={onClose}>{t('close')}</button>
        </div>
      </div>}
      {phase === 'offline' && <div class="sos-result">
        <h2 id="sos-title">{t('sosTitle')}</h2>
        <p id="sos-text" class="sos-offline">{t('sosOffline')}</p>
        <div class="sos-actions">
          <a class="sos-call" href="tel:911"><Icon name="phone" size={18} /> {t('sosCall')}</a>
          <button type="button" class="sos-cancel" onClick={onClose}>{t('close')}</button>
        </div>
      </div>}
    </section>
  </div>
}
