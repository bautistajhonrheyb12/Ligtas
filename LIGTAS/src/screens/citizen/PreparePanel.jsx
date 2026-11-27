import { useEffect, useState } from 'preact/hooks'
import { hotlines } from '../../lib/hotlines.js'
import { Icon, timeAgo } from '../../lib/ui.jsx'
import { PrioritySection } from './Priority.jsx'
import { FamilyCard } from './Family.jsx'

// Prepare holds what helps before and during a disaster: hotlines, the
// family, priority rescue, the go-bag checklist and safety tips. Account
// details and app settings are in the profile (components/Profile.jsx).

const CHECKLIST_KEY = 'ligtas-gobag'

function readChecklist() {
  try {
    return JSON.parse(localStorage.getItem(CHECKLIST_KEY)) ?? []
  } catch {
    return []
  }
}

// "I'm safe": the same check-in as before (status Safe, with the position when
// known), which responders and the family see.
function SafetyCheckin({ t, status, saving, onMarkSafe }) {
  const isSafe = status?.status === 'Safe'
  const when = status?.updated_at ? timeAgo(status.updated_at).toLowerCase() : ''
  return <section class="prepare-card safety-checkin" id="safety-checkin">
    <h2><Icon name="heart" size={18} /> {t('checkinTitle')}</h2>
    <p class="prepare-note">{t('checkinText')}</p>
    <p class={`safety-checkin-status${isSafe ? ' is-safe' : status?.status === 'Need help' ? ' is-help' : ''}`} role="status">
      {isSafe ? t('safeMarked', { time: when }) : status?.status === 'Need help' ? t('checkinNeedHelp', { time: when }) : t('checkinNone')}
    </p>
    <button type="button" class={`safe-trigger${isSafe ? ' is-marked' : ''}`} onClick={onMarkSafe} disabled={saving}>
      <span class="safe-trigger-icon">{saving ? <span class="btn-spinner" aria-hidden="true" /> : <Icon name={isSafe ? 'check' : 'heart'} size={22} />}</span>
      <span><strong>{t('safeButton')}</strong><small>{isSafe ? t('safeMarked', { time: when }) : t('safeHint')}</small></span>
    </button>
  </section>
}

export function PreparePanel({ t, profile, priority, family, checkin }) {
  const [packed, setPacked] = useState(readChecklist)
  const [hazard, setHazard] = useState('flood')
  const [phase, setPhase] = useState('before')
  const items = t('checklist')
  const hazards = t('hazards')

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

  return <div class="citizen-panel prepare-panel">
    {checkin && <SafetyCheckin t={t} {...checkin} />}

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

    {family && <FamilyCard t={t} {...family} />}

    <PrioritySection t={t} profile={profile} {...priority} />

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
  </div>
}
