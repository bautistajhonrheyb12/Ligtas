import { useState } from 'preact/hooks'
import { Icon, timeAgo } from '../../lib/ui.jsx'
import { ConfirmAction } from '../../components/ConfirmDialog.jsx'
import { createFamily, joinFamily, leaveFamily, removeFamilyMember, renewFamilyCode } from '../../lib/supabase.js'

// Family safety: family members see each other's safety (Safe, Needs help,
// SOS sent and how the rescue is going), never locations or reports.

const SOS_STAGE = { Assigned: 'famSosAssigned', 'En route': 'famSosEnRoute', 'On scene': 'famSosOnScene' }

// What to show for one family member: tone, words and since when.
export function memberState(member, t) {
  if (member.sos_status === 'Verified') {
    return { tone: 'sos', icon: 'sos', label: t(SOS_STAGE[member.sos_stage] ?? 'famSosWaiting'), at: member.sos_at }
  }
  if (member.status === 'Need help') return { tone: 'help', icon: 'alert', label: t('famNeedsHelp'), at: member.status_at }
  if (member.status === 'Safe') return { tone: 'safe', icon: 'check', label: t('famSafe'), at: member.status_at }
  if (member.sos_status === 'Resolved') return { tone: 'resolved', icon: 'check', label: t('famSosResolved'), at: member.sos_at }
  return { tone: 'none', icon: 'clock', label: t('famNoUpdate'), at: null }
}

function MemberRow({ member, t, canRemove, onRemove }) {
  const state = memberState(member, t)
  const name = member.name ?? t('famUnnamed')
  return <li class={`family-member is-${state.tone}`}>
    <span class="family-member-icon" aria-hidden="true"><Icon name={state.icon} size={16} /></span>
    <span class="family-member-text">
      <strong>{name}{member.is_me && <em>{t('famYou')}</em>}</strong>
      <small>{state.label}{state.at ? ` · ${timeAgo(state.at).toLowerCase()}` : ''}{member.barangay ? ` · ${member.barangay}` : ''}</small>
    </span>
    {canRemove && !member.is_me && <ConfirmAction class="family-remove" label={t('famRemove', { name })} onConfirm={() => onRemove(member)} ask={{
      title: t('famRemoveTitle', { name }),
      message: t('famRemoveText'),
      confirmLabel: t('famRemoveButton'),
      cancelLabel: t('cancel'),
      tone: 'danger',
      icon: 'userPlus',
    }}><Icon name="x" size={16} /></ConfirmAction>}
  </li>
}

// Prepare tab: start or join a family, share the code, manage it.
export function FamilyCard({ t, family, onChanged, onToast }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  if (family === undefined || family?.unavailable) return null

  const run = async (name, action) => {
    setBusy(name)
    setError('')
    try {
      await action()
    } catch (actionError) {
      setError(actionError.message)
    } finally {
      setBusy('')
    }
  }
  const start = () => run('start', async () => {
    await createFamily()
    onToast(t('famCreated'), 'success')
    await onChanged()
  })
  const join = (event) => {
    event.preventDefault()
    run('join', async () => {
      const result = await joinFamily(code)
      if (result === 'not-found') throw new Error(t('famNotFound'))
      if (result === 'full') throw new Error(t('famFull'))
      setCode('')
      onToast(t('famJoined'), 'success')
      await onChanged()
    })
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(family.code)
      onToast(t('famCopied'), 'success')
    } catch {
      onToast(family.code, 'info')
    }
  }
  const share = () => navigator.share({ title: 'LIGTAS', text: t('famShareText', { code: family.code }), url: window.location.origin }).catch(() => {})

  if (!family) {
    return <section class="prepare-card family-card" id="my-family">
      <h2><Icon name="users" size={18} /> {t('famTitle')}</h2>
      <p class="prepare-note">{t('famIntro')}</p>
      <p class="family-privacy"><Icon name="shield" size={14} /> {t('famPrivacy')}</p>
      <button type="button" class="family-primary" onClick={start} disabled={Boolean(busy)}>
        {busy === 'start' ? <span class="btn-spinner" aria-hidden="true" /> : <Icon name="userPlus" size={17} />} {t('famStart')}
      </button>
      <form class="family-join" onSubmit={join}>
        <label for="family-code">{t('famJoinLabel')}</label>
        <div class="family-join-row">
          <input id="family-code" value={code} onInput={(event) => setCode(event.currentTarget.value.toUpperCase())} placeholder={t('famCodePlaceholder')} autoComplete="off" autoCapitalize="characters" spellcheck={false} maxLength="12" required minLength="8" />
          <button type="submit" class="family-secondary" disabled={Boolean(busy) || code.replace(/[^A-Za-z0-9]/g, '').length < 8}>
            {busy === 'join' && <span class="btn-spinner" aria-hidden="true" />} {t('famJoin')}
          </button>
        </div>
      </form>
      {error && <p class="form-error" role="alert">{error}</p>}
    </section>
  }

  return <section class="prepare-card family-card" id="my-family">
    <h2><Icon name="users" size={18} /> {t('famTitle')}</h2>
    <ul class="family-list">
      {family.members.map((member) => <MemberRow key={member.user_id} member={member} t={t} canRemove={family.is_owner} onRemove={(person) => run('remove', async () => { await removeFamilyMember(person.user_id); await onChanged() })} />)}
    </ul>
    <div class="family-code">
      <span>{t('famCodeLabel')}</span>
      <strong aria-label={family.code.split('').join(' ')}>{family.code.slice(0, 4)} {family.code.slice(4)}</strong>
      <small>{t('famCodeHint')}</small>
      <div class="family-code-actions">
        <button type="button" class="family-secondary" onClick={copy}><Icon name="file" size={15} /> {t('famCopy')}</button>
        {typeof navigator.share === 'function' && <button type="button" class="family-secondary" onClick={share}><Icon name="share" size={15} /> {t('famShare')}</button>}
        {family.is_owner && <ConfirmAction class="family-quiet" onConfirm={() => run('renew', async () => { await renewFamilyCode(); await onChanged() })} ask={{
          title: t('famRenewTitle'),
          message: t('famRenewText'),
          confirmLabel: t('famRenew'),
          cancelLabel: t('cancel'),
          tone: 'warning',
          icon: 'refresh',
        }}>{t('famRenew')}</ConfirmAction>}
      </div>
    </div>
    <p class="family-privacy"><Icon name="shield" size={14} /> {t('famPrivacy')}</p>
    {error && <p class="form-error" role="alert">{error}</p>}
    <ConfirmAction class="family-leave" onConfirm={() => run('leave', async () => { await leaveFamily(); await onChanged() })} ask={{
      title: t('famLeaveTitle'),
      message: t('famLeaveText'),
      confirmLabel: t('famLeave'),
      cancelLabel: t('cancel'),
      tone: 'danger',
      icon: 'logout',
    }}>{t('famLeave')}</ConfirmAction>
  </section>
}

// Home tab: the family at a glance, most urgent first.
export function FamilyStatus({ t, family, onManage }) {
  if (!family || family.unavailable) return null
  const others = family.members.filter((member) => !member.is_me)
  const rank = { sos: 0, help: 1, none: 2, resolved: 3, safe: 4 }
  const sorted = [...others].sort((a, b) => rank[memberState(a, t).tone] - rank[memberState(b, t).tone])
  return <section class="family-status" aria-label={t('famTitle')}>
    <div class="family-status-head">
      <span><Icon name="users" size={16} /> {t('famTitle')}</span>
      <button type="button" onClick={onManage}>{t('famManage')}</button>
    </div>
    {sorted.length === 0
      ? <p class="family-status-empty">{t('famAlone')}</p>
      : <ul class="family-list">{sorted.map((member) => <MemberRow key={member.user_id} member={member} t={t} canRemove={false} />)}</ul>}
  </section>
}
