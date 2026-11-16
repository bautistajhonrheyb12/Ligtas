import { useState } from 'preact/hooks'
import { rescueHotline } from '../lib/hotlines.js'
import { LEGAL_VERSION, privacyUrl, termsUrl } from '../lib/legal.js'
import { acceptTerms } from '../lib/supabase.js'
import { Icon, Logo } from '../lib/ui.jsx'

const TEXT = {
  en: {
    eyebrowNew: 'Before you continue',
    eyebrowUpdate: 'We updated our terms',
    title: 'Terms of Use and Privacy Policy',
    intro: 'Please read and accept them to use LIGTAS. The main points:',
    points: [
      ['sos', `LIGTAS is not an emergency service. If a life is in danger, call ${rescueHotline.name} at ${rescueHotline.display}, even after sending an SOS.`],
      ['alert', 'Send only true reports. False reports or SOS can get your account closed.'],
      ['users', 'Rescuers and administrators see your name, number and location on your reports, so they can help you.'],
      ['shield', 'Your information is protected under the Data Privacy Act of 2012. We never sell it, and you can correct it or ask us to delete it.'],
    ],
    staffPoint: 'Use the information in LIGTAS only for disaster response, and keep it confidential.',
    readTerms: 'Read the Terms of Use',
    readPrivacy: 'Read the Privacy Policy',
    check: 'I have read and agree to the Terms of Use and Privacy Policy.',
    accept: 'Accept and continue',
    emergency: 'Emergency? You can still ask for help.',
    signOut: 'Sign out',
    language: 'Filipino',
  },
  tl: {
    eyebrowNew: 'Bago magpatuloy',
    eyebrowUpdate: 'In-update namin ang aming mga tuntunin',
    title: 'Mga Tuntunin ng Paggamit at Patakaran sa Privacy',
    intro: 'Pakibasa at tanggapin ang mga ito para magamit ang LIGTAS. Ang mahahalagang punto:',
    points: [
      ['sos', `Hindi emergency service ang LIGTAS. Kapag may panganib sa buhay, tumawag sa ${rescueHotline.name}: ${rescueHotline.display}, kahit nakapagpadala ka na ng SOS.`],
      ['alert', 'Totoong ulat lang ang ipadala. Puwedeng isara ang account dahil sa pekeng ulat o SOS.'],
      ['users', 'Nakikita ng mga rescuer at admin ang pangalan, numero at lokasyon mo sa mga ulat mo, para matulungan ka.'],
      ['shield', 'Protektado ng Data Privacy Act of 2012 ang impormasyon mo. Hindi namin ito ibinebenta, at puwede mo itong ipatama o ipabura.'],
    ],
    staffPoint: 'Gamitin lang ang impormasyon sa LIGTAS para sa pagtugon sa sakuna, at ilihim ito.',
    readTerms: 'Basahin ang Terms of Use',
    readPrivacy: 'Basahin ang Privacy Policy',
    check: 'Nabasa ko at sumasang-ayon ako sa Terms of Use at Privacy Policy.',
    accept: 'Tanggapin at magpatuloy',
    emergency: 'May emergency? Makakahingi ka pa rin ng tulong.',
    signOut: 'Mag-sign out',
    language: 'English',
  },
}

// Shown once to everyone who has not accepted the current version. Citizens
// keep SOS and the rescue hotline one tap away.
export function TermsGate({ lang = 'en', onToggleLang, isUpdate = false, isStaff = false, onSos, onAccepted, onSignOut }) {
  const text = TEXT[lang] ?? TEXT.en
  const [agreed, setAgreed] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const accept = async () => {
    setIsSaving(true)
    setError('')
    try {
      await acceptTerms(LEGAL_VERSION)
      onAccepted()
    } catch (acceptError) {
      setError(acceptError.message)
      setIsSaving(false)
    }
  }

  return <div class="app-gate terms-gate" role="dialog" aria-modal="true" aria-labelledby="terms-gate-title">
    <header class="app-gate-bar">
      <span class="app-gate-brand"><Logo small /> LIGTAS</span>
      <div>
        {onToggleLang && <button type="button" class="app-gate-tool" onClick={onToggleLang}><Icon name="globe" size={15} /> {text.language}</button>}
        <button type="button" class="app-gate-tool" onClick={onSignOut}>{text.signOut}</button>
      </div>
    </header>
    <div class="app-gate-scroll">
      {onSos && <div class="app-gate-emergency">
        <span>{text.emergency}</span>
        <div>
          <button type="button" class="app-gate-sos" onClick={onSos}><Icon name="sos" size={16} /> SOS</button>
          <a class="app-gate-call" href={`tel:${rescueHotline.number}`}><Icon name="phone" size={15} /> {rescueHotline.display}</a>
        </div>
      </div>}
      <section class="app-gate-card">
        <span class="priority-eyebrow">{isUpdate ? text.eyebrowUpdate : text.eyebrowNew}</span>
        <h2 id="terms-gate-title">{text.title}</h2>
        <p class="priority-lead">{text.intro}</p>
        <ul class="terms-points">
          {text.points.map(([icon, point]) => <li key={icon}><Icon name={icon} size={16} /><span>{point}</span></li>)}
          {isStaff && <li><Icon name="user" size={16} /><span>{text.staffPoint}</span></li>}
        </ul>
        <div class="terms-read">
          <a href={termsUrl} target="_blank" rel="noopener"><Icon name="file" size={15} /> {text.readTerms}</a>
          <a href={privacyUrl} target="_blank" rel="noopener"><Icon name="shield" size={15} /> {text.readPrivacy}</a>
        </div>
        <label class="priority-check">
          <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.currentTarget.checked)} />
          <span>{text.check}</span>
        </label>
        {error && <p class="form-error" role="alert">{error}</p>}
        <button type="button" class="priority-primary" disabled={!agreed || isSaving} onClick={accept}>
          {isSaving && <span class="btn-spinner" aria-hidden="true" />}
          {text.accept}
        </button>
      </section>
    </div>
  </div>
}
