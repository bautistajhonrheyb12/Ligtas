import { useEffect, useState } from 'preact/hooks'
import { PhoneInput } from '../../components/PhoneInput.jsx'
import { hotlines } from '../../lib/hotlines.js'
import { toStoredMobile } from '../../lib/phone.js'
import { Icon } from '../../lib/ui.jsx'

const CHECKLIST_KEY = 'ligtas-gobag'

function readChecklist() {
  try {
    return JSON.parse(localStorage.getItem(CHECKLIST_KEY)) ?? []
  } catch {
    return []
  }
}

const profileDraft = (profile) => ({
  displayName: profile?.display_name ?? '',
  // Numbers saved before the +63 format are shown and re-saved in it.
  phone: toStoredMobile(profile?.phone),
  barangay: profile?.barangay ?? '',
})

export function PreparePanel({ t, lang, setLang, profile, onSaveProfile }) {
  const [packed, setPacked] = useState(readChecklist)
  const [hazard, setHazard] = useState('flood')
  const [phase, setPhase] = useState('before')
  const [draft, setDraft] = useState(() => profileDraft(profile))
  const [saveState, setSaveState] = useState('idle')
  const [saveError, setSaveError] = useState('')
  const items = t('checklist')
  const hazards = t('hazards')

  useEffect(() => { setDraft(profileDraft(profile)) }, [profile])

  useEffect(() => {
    try {
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify(packed))
    } catch {
      // The checklist simply won't persist on this device.
    }
  }, [packed])

  const toggleItem = (index) => setPacked((current) => current.includes(index)
    ? current.filter((item) => item !== index)
    : [...current, index])

  const editValue = (field) => (value) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setSaveState('idle')
    setSaveError('')
  }
  const editField = (field) => (event) => editValue(field)(event.currentTarget.value)

  const saveProfile = async (event) => {
    event.preventDefault()
    setSaveState('saving')
    setSaveError('')
    try {
      await onSaveProfile(draft)
      setSaveState('saved')
    } catch (error) {
      setSaveError(error.message)
      setSaveState('idle')
    }
  }

  return <div class="citizen-panel prepare-panel">
    <section class="prepare-card">
      <h2><Icon name="phone" size={18} /> {t('hotlinesTitle')}</h2>
      <p class="prepare-note">{t('hotlinesNote')}</p>
      <div class="hotline-list">
        {hotlines.map((line) => <a class={`hotline rx-tone--${line.tone}`} href={`tel:${line.number}`} key={line.number}>
          <span class="hotline-icon"><Icon name={line.icon} size={18} /></span>
          <span class="hotline-copy"><strong>{line.name}</strong><small>{line.description}</small></span>
          <span class="hotline-number">{line.display}<Icon name="phone" size={14} /></span>
        </a>)}
      </div>
    </section>

    <section class="prepare-card">
      <div class="prepare-card-head">
        <h2><Icon name="bag" size={18} /> {t('checklistTitle')}</h2>
        <span class="prepare-progress">{t('checklistProgress', { done: packed.length, total: items.length })}</span>
      </div>
      <div class="prepare-meter" aria-hidden="true"><i style={{ width: `${packed.length / items.length * 100}%` }} /></div>
      <ul class="checklist">
        {items.map((item, index) => <li key={item}>
          <label class={packed.includes(index) ? 'is-checked' : ''}>
            <input type="checkbox" checked={packed.includes(index)} onChange={() => toggleItem(index)} />
            <span class="checkbox-mark" aria-hidden="true"><Icon name="check" size={14} /></span>
            {item}
          </label>
        </li>)}
      </ul>
    </section>

    <section class="prepare-card">
      <h2><Icon name="shield" size={18} /> {t('tipsTitle')}</h2>
      <div class="hazard-tabs" role="tablist" aria-label={t('tipsTitle')}>
        {Object.entries(hazards).map(([key, value]) => <button type="button" role="tab" aria-selected={hazard === key} class={hazard === key ? 'is-active' : ''} onClick={() => setHazard(key)} key={key}>{value.name}</button>)}
      </div>
      <div class="rx-segment phase-tabs" role="tablist">
        {['before', 'during', 'after'].map((key) => <button type="button" role="tab" aria-selected={phase === key} class={phase === key ? 'is-active' : ''} onClick={() => setPhase(key)} key={key}>{t(key)}</button>)}
      </div>
      <ul class="tip-list" key={`${hazard}-${phase}`}>
        {hazards[hazard][phase].map((tip) => <li key={tip}><Icon name="check" size={16} />{tip}</li>)}
      </ul>
    </section>

    <section class="prepare-card">
      <h2><Icon name="user" size={18} /> {t('settingsTitle')}</h2>
      <form class="profile-form" onSubmit={saveProfile}>
        <label>
          {t('nameLabel')}
          <input name="name" autoComplete="name" value={draft.displayName} maxLength="80" placeholder={t('namePlaceholder')} onInput={editField('displayName')} />
        </label>
        <label>
          {t('phoneLabel')}
          <PhoneInput class="phone-field phone-field--boxed" name="phone" title={t('phoneInvalid')} value={draft.phone} onChange={editValue('phone')} />
          <small>{t('phoneHelp')}</small>
        </label>
        <label>
          {t('barangayLabel')}
          <input name="barangay" value={draft.barangay} maxLength="80" placeholder={t('barangayPlaceholder')} onInput={editField('barangay')} />
          <small>{t('barangayHelp')}</small>
        </label>
        {saveError && <p class="form-error" role="alert" key={saveError}>{saveError}</p>}
        <button type="submit" class="secondary-action" disabled={saveState === 'saving'}>
          {saveState === 'saving' && <span class="btn-spinner" aria-hidden="true" />}
          {saveState === 'saved' ? <><Icon name="check" size={16} /> {t('saved')}</> : t('save')}
        </button>
      </form>
      <div class="language-row">
        <span>{t('languageLabel')}</span>
        <div class="rx-segment">
          <button type="button" class={lang === 'en' ? 'is-active' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
          <button type="button" class={lang === 'tl' ? 'is-active' : ''} aria-pressed={lang === 'tl'} onClick={() => setLang('tl')}>Filipino</button>
        </div>
      </div>
    </section>
  </div>
}
