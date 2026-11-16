import { useEffect, useState } from 'preact/hooks'
import { rescueHotline } from '../../lib/hotlines.js'
import { PRIORITY_CATEGORIES, PRIORITY_ICONS, PROOF_ACCEPT, ageFromBirthYear, priorityFormProblem } from '../../lib/priority.js'
import {
  answerPriorityQuestion,
  clearPriorityInformation,
  getPriorityProofUrl,
  givePriorityConsent,
  removePriorityMember,
  savePriorityMember,
} from '../../lib/supabase.js'
import { Icon, Logo } from '../../lib/ui.jsx'

export const categoryKeys = { pwd: 'priorityCatPwd', pregnant: 'priorityCatPregnant', senior: 'priorityCatSenior', child: 'priorityCatChild' }
const statusKeys = { pending: 'priorityStatusPending', verified: 'priorityStatusVerified', rejected: 'priorityStatusRejected' }

const isoDate = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10)
const formatDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })

// A button that asks for a second tap before doing something that cannot be undone.
function TapTwice({ class: className, label, confirmLabel, onConfirm, disabled }) {
  const [state, setState] = useState('idle')
  useEffect(() => {
    if (state !== 'confirm') return undefined
    const timer = setTimeout(() => setState('idle'), 4000)
    return () => clearTimeout(timer)
  }, [state])
  const press = async () => {
    if (state === 'idle') { setState('confirm'); return }
    setState('busy')
    try {
      await onConfirm()
    } finally {
      setState('idle')
    }
  }
  return <button type="button" class={`${className}${state === 'confirm' ? ' is-confirming' : ''}`} disabled={disabled || state === 'busy'} onClick={press}>
    {state === 'busy' ? <span class="btn-spinner" aria-hidden="true" /> : state === 'confirm' ? confirmLabel : label}
  </button>
}

// Opens the person's own proof in a new tab through a short-lived link.
function ProofButton({ t, path }) {
  const [failed, setFailed] = useState(false)
  const open = async () => {
    // Opened before the link is fetched so phones do not block it as a pop-up.
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    try {
      const url = await getPriorityProofUrl(path)
      if (tab) tab.location.href = url
      else window.location.assign(url)
    } catch {
      tab?.close()
      setFailed(true)
    }
  }
  return <button type="button" class="priority-link" onClick={open} disabled={failed}>
    <Icon name="file" size={14} /> {t('priorityViewProof')}
  </button>
}

const draftFrom = (member) => ({
  id: member?.id ?? null,
  category: member?.category ?? '',
  fullName: member?.full_name ?? '',
  birthYear: member?.birth_year ? String(member.birth_year) : '',
  dueDate: member?.due_date ?? '',
  details: member?.details ?? '',
  proofFile: null,
  oldProofPath: member?.proof_path ?? null,
})

function PriorityForm({ t, member, onSaved, onCancel }) {
  const [draft, setDraft] = useState(() => draftFrom(member))
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const year = new Date().getFullYear()
  const needsBirthYear = draft.category === 'child' || draft.category === 'senior'
  const edit = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setError('')
  }

  const save = async (event) => {
    event.preventDefault()
    const problem = draft.category ? priorityFormProblem(draft, t) : t('priorityErrCategory')
    if (problem) {
      setError(problem)
      return
    }
    setIsSaving(true)
    try {
      onSaved(await savePriorityMember(draft))
    } catch (saveError) {
      setError(saveError.message)
      setIsSaving(false)
    }
  }

  return <form class="priority-form" onSubmit={save} noValidate>
    <h3>{member ? t('priorityFormTitleEdit') : t('priorityFormTitleAdd')}</h3>
    <fieldset class="priority-category-picker">
      <legend>{t('priorityCategoryLabel')}</legend>
      {PRIORITY_CATEGORIES.map((category) => <label key={category} class={draft.category === category ? 'is-selected' : ''}>
        <input type="radio" name="priority-category" value={category} checked={draft.category === category} onChange={() => edit('category', category)} />
        <Icon name={PRIORITY_ICONS[category]} size={22} />
        <span>{t(categoryKeys[category])}</span>
      </label>)}
    </fieldset>

    {draft.category && <>
      <label>
        {t('priorityNameLabel')}
        <input value={draft.fullName} maxLength="80" autoComplete="off" placeholder={t('priorityNamePlaceholder')} onInput={(event) => edit('fullName', event.currentTarget.value)} />
      </label>
      <label>
        {needsBirthYear ? t('priorityBirthYearLabel') : t('priorityBirthYearOptional')}
        <input type="number" inputMode="numeric" min="1900" max={year} value={draft.birthYear} placeholder={draft.category === 'senior' ? String(year - 65) : draft.category === 'child' ? String(year - 6) : ''} onInput={(event) => edit('birthYear', event.currentTarget.value)} />
      </label>
      {draft.category === 'pregnant' && <label>
        {t('priorityDueLabel')}
        <input type="date" min={isoDate(-30)} max={isoDate(300)} value={draft.dueDate} onInput={(event) => edit('dueDate', event.currentTarget.value)} />
      </label>}
      <label>
        {t('priorityDetailsLabel')}
        <textarea rows="2" maxLength="300" value={draft.details} placeholder={t('priorityDetailsPlaceholder')} onInput={(event) => edit('details', event.currentTarget.value)} />
        <small>{t('priorityDetailsHelp')}</small>
      </label>
      <div class="priority-proof-field">
        <span>{t('priorityProofLabel')}</span>
        <small>{t('priorityProofHelp')[draft.category]} {t('priorityProofTypes')}</small>
        <label class={`priority-proof-pick${draft.proofFile ? ' has-file' : ''}`}>
          <input type="file" accept={PROOF_ACCEPT} onChange={(event) => edit('proofFile', event.currentTarget.files?.[0] ?? null)} />
          <Icon name={draft.proofFile ? 'check' : 'camera'} size={18} />
          <span>{draft.proofFile ? draft.proofFile.name : draft.oldProofPath ? t('priorityProofReplace') : t('priorityProofChoose')}</span>
        </label>
        {!draft.proofFile && draft.oldProofPath && <small>{t('priorityProofKeep')}</small>}
      </div>
      {member && <p class="priority-form-note">{t('priorityEditNote')}</p>}
    </>}

    {error && <p class="form-error" role="alert" key={error}>{error}</p>}
    <div class="priority-form-actions">
      <button type="button" class="priority-secondary" onClick={onCancel} disabled={isSaving}>{t('cancel')}</button>
      <button type="submit" class="priority-primary" disabled={isSaving || !draft.category}>
        {isSaving && <span class="btn-spinner" aria-hidden="true" />}
        {isSaving ? t('prioritySaving') : t('prioritySave')}
      </button>
    </div>
  </form>
}

function PriorityList({ t, members, onEdit, onRemove }) {
  return <ul class="priority-list">
    {members.map((member) => {
      const age = ageFromBirthYear(member.birth_year)
      return <li class={`priority-member is-${member.status}`} key={member.id}>
        <span class="priority-member-icon"><Icon name={PRIORITY_ICONS[member.category]} size={20} /></span>
        <div class="priority-member-body">
          <strong>{member.full_name}</strong>
          <small>
            {t(categoryKeys[member.category])}
            {age !== null ? ` · ${t('priorityAge', { age })}` : ''}
            {member.due_date ? ` · ${t('priorityDue', { date: formatDate(member.due_date) })}` : ''}
          </small>
          <span class={`priority-status priority-status--${member.status}`}>
            <Icon name={member.status === 'verified' ? 'check' : member.status === 'rejected' ? 'alert' : 'clock'} size={12} />
            {t(statusKeys[member.status])}
          </span>
          {member.status === 'rejected' && member.review_note && <p class="priority-reason">{t('priorityReason', { reason: member.review_note })}</p>}
          <div class="priority-member-actions">
            <ProofButton t={t} path={member.proof_path} />
            <button type="button" class="priority-link" onClick={() => onEdit(member)}><Icon name="edit" size={14} /> {member.status === 'rejected' ? t('priorityProofReplace') : t('priorityEdit')}</button>
            <TapTwice class="priority-link is-danger" label={<><Icon name="trash" size={14} /> {t('priorityRemove')}</>} confirmLabel={t('priorityRemoveConfirm')} onConfirm={() => onRemove(member)} />
          </div>
        </div>
      </li>
    })}
  </ul>
}

function PriorityConsent({ t, onAgreed }) {
  const [agreed, setAgreed] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const agree = async () => {
    setIsSaving(true)
    setError('')
    try {
      await givePriorityConsent()
      onAgreed()
    } catch (consentError) {
      setError(consentError.message)
      setIsSaving(false)
    }
  }
  return <div class="priority-consent">
    <h3><Icon name="shield" size={18} /> {t('priorityConsentTitle')}</h3>
    <ul>
      {t('priorityConsentPoints').map(([lead, text]) => <li key={lead}><b>{lead}:</b> {text}</li>)}
    </ul>
    <p class="priority-law">{t('priorityConsentLaw')}</p>
    <label class="priority-check">
      <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.currentTarget.checked)} />
      <span>{t('priorityConsentCheck')}</span>
    </label>
    {error && <p class="form-error" role="alert">{error}</p>}
    <button type="button" class="priority-primary" disabled={!agreed || isSaving} onClick={agree}>
      {isSaving && <span class="btn-spinner" aria-hidden="true" />}
      {t('priorityConsentButton')}
    </button>
  </div>
}

// Consent first, then the list of people with their review status, and the
// form to add or fix one.
function PriorityEditor({ t, members, hasConsent, startAdding = false, onConsented, onChanged, onToast }) {
  const [editing, setEditing] = useState(startAdding && members.length === 0 ? 'new' : null)

  if (!hasConsent) return <PriorityConsent t={t} onAgreed={() => { onConsented(); if (members.length === 0) setEditing('new') }} />

  const remove = async (member) => {
    try {
      await removePriorityMember(member)
      onToast(t('priorityRemoved'), 'success')
      onChanged()
    } catch (error) {
      onToast(error.message, 'urgent')
    }
  }

  return <div class="priority-editor">
    {members.length > 0 && <PriorityList t={t} members={members} onEdit={setEditing} onRemove={remove} />}
    {editing
      ? <PriorityForm
        key={editing === 'new' ? 'new' : editing.id}
        t={t}
        member={editing === 'new' ? null : editing}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          onToast(t('prioritySaved'), 'success')
          onChanged()
        }}
      />
      : <button type="button" class="priority-add" onClick={() => setEditing('new')}>
        <Icon name="plus" size={16} /> {members.length ? t('priorityAddAnother') : t('priorityAdd')}
      </button>}
  </div>
}

// Asked of every citizen once, after signing in. SOS and the rescue hotline
// stay one tap away, so the question never stands between someone and help.
export function PriorityQuestion({ t, lang, setLang, profile, members, onReload, onConsented, onAnswered, onSos, onSignOut, onToast }) {
  const [step, setStep] = useState(members.length ? 'yes' : 'ask')
  const [confirmNo, setConfirmNo] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const hasConsent = Boolean(profile.priority_consent_at)

  useEffect(() => {
    if (!confirmNo) return undefined
    const timer = setTimeout(() => setConfirmNo(false), 5000)
    return () => clearTimeout(timer)
  }, [confirmNo])

  const answer = async (hasPriority) => {
    setIsSaving(true)
    setError('')
    try {
      await answerPriorityQuestion(hasPriority)
      onAnswered()
    } catch (answerError) {
      setError(answerError.message)
      setIsSaving(false)
    }
  }

  return <div class="priority-gate" role="dialog" aria-modal="true" aria-label={t('priorityQTitle')}>
    <header class="priority-gate-bar">
      <span class="priority-gate-brand"><Logo small /> LIGTAS</span>
      <div>
        <button type="button" class="priority-gate-tool" onClick={() => setLang(lang === 'en' ? 'tl' : 'en')}><Icon name="globe" size={15} /> {t('langToggle')}</button>
        <button type="button" class="priority-gate-tool" onClick={onSignOut}>{t('signOut')}</button>
      </div>
    </header>
    <div class="priority-gate-scroll">
      <div class="priority-gate-emergency">
        <span>{t('priorityEmergency')}</span>
        <div>
          <button type="button" class="priority-gate-sos" onClick={onSos}><Icon name="sos" size={16} /> SOS</button>
          <a class="priority-gate-call" href={`tel:${rescueHotline.number}`}><Icon name="phone" size={15} /> {rescueHotline.display}</a>
        </div>
      </div>

      <section class="priority-gate-card">
        {step === 'ask' && <>
          <span class="priority-eyebrow">{t('priorityQEyebrow')}</span>
          <h2>{t('priorityQTitle')}</h2>
          <p class="priority-lead">{t('priorityQText')}</p>
          <ul class="priority-category-grid">
            {PRIORITY_CATEGORIES.map((category) => <li key={category}><Icon name={PRIORITY_ICONS[category]} size={26} /><span>{t(categoryKeys[category])}</span></li>)}
          </ul>
          {error && <p class="form-error" role="alert">{error}</p>}
          <div class="priority-gate-actions">
            <button type="button" class="priority-primary" disabled={isSaving} onClick={() => setStep('yes')}>{t('priorityYes')}</button>
            <button type="button" class={`priority-secondary${confirmNo ? ' is-confirming' : ''}`} disabled={isSaving} onClick={() => confirmNo ? answer(false) : setConfirmNo(true)}>
              {isSaving && <span class="btn-spinner" aria-hidden="true" />}
              {confirmNo ? t('priorityNoConfirm') : t('priorityNo')}
            </button>
          </div>
          <small class="priority-footnote">{t('priorityChangeLater')}</small>
        </>}

        {step === 'yes' && <>
          {members.length === 0 && <button type="button" class="priority-back" onClick={() => { setStep('ask'); setError('') }}>‹ {t('priorityBack')}</button>}
          {hasConsent && <h2>{t('priorityListTitle')}</h2>}
          <PriorityEditor t={t} members={members} hasConsent={hasConsent} startAdding onConsented={onConsented} onChanged={onReload} onToast={onToast} />
          {hasConsent && <>
            {error && <p class="form-error" role="alert">{error}</p>}
            <button type="button" class="priority-primary priority-finish" disabled={!members.length || isSaving} onClick={() => answer(true)}>
              {isSaving && <span class="btn-spinner" aria-hidden="true" />}
              {t('priorityFinish')}
            </button>
            {!members.length && <small class="priority-footnote">{t('priorityFinishHint')}</small>}
          </>}
        </>}
      </section>
    </div>
  </div>
}

// The Prepare tab card: the list and its review status, adding people later,
// and withdrawing consent (which deletes everything).
export function PrioritySection({ t, profile, members, onReload, onConsented, onWithdrawn, onToast }) {
  const [isAdding, setIsAdding] = useState(false)
  // Before the priority rescue migration the profile has no such field.
  if (!profile || profile.priority_answered_at === undefined) return null
  const hasConsent = Boolean(profile.priority_consent_at)

  const withdraw = async () => {
    try {
      await clearPriorityInformation()
      setIsAdding(false)
      onWithdrawn()
      onToast(t('priorityWithdrawn'), 'success')
    } catch (error) {
      onToast(error.message, 'urgent')
    }
  }

  return <section class="prepare-card priority-card" id="priority-rescue">
    <h2><Icon name="accessible" size={18} /> {t('prioritySectionTitle')}</h2>
    <p class="prepare-note">{t('prioritySectionNote')}</p>
    {members.length > 0 || isAdding
      ? <PriorityEditor t={t} members={members} hasConsent={hasConsent} startAdding={isAdding} onConsented={onConsented} onChanged={onReload} onToast={onToast} />
      : <>
        <p class="priority-none">{t('prioritySectionNone')}</p>
        <button type="button" class="priority-add" onClick={() => setIsAdding(true)}><Icon name="plus" size={16} /> {t('priorityAdd')}</button>
      </>}
    {hasConsent && members.length > 0 && <TapTwice class="priority-withdraw" label={t('priorityWithdraw')} confirmLabel={t('priorityWithdrawConfirm')} onConfirm={withdraw} />}
  </section>
}
