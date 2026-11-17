import { useState } from 'preact/hooks'
import { getPriorityProofUrl } from '../../lib/supabase.js'
import { useConfirm } from '../../components/ConfirmDialog.jsx'
import { Icon, LoadingCards, timeAgo } from '../../lib/ui.jsx'
import { CHILD_MAX_AGE, PRIORITY_ICONS, SENIOR_AGE, STAFF_LABELS, ageFromBirthYear } from '../../lib/priority.js'

const FILTERS = [['pending', 'Waiting'], ['verified', 'Verified'], ['rejected', 'Rejected'], ['all', 'All']]
const STATUS_LABELS = { pending: 'Waiting for review', verified: 'Verified', rejected: 'Rejected' }
const PROOF_NEEDED = {
  pwd: 'PWD ID or a medical certificate',
  pregnant: 'Prenatal record or a medical certificate with the due date',
  senior: 'Senior citizen ID, or an ID with the birth date',
  child: 'Birth certificate, school ID or a record with the birth date',
}
const REJECT_REASONS = [
  'The proof is unclear or cannot be read',
  'The name on the proof does not match',
  'The proof does not show the category',
  'The birth year or due date does not match the proof',
  'The proof appears to be altered',
]

const formatDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })

// Loads the proof through a five-minute link only when the admin asks for it.
function ProofViewer({ path }) {
  const [state, setState] = useState({ status: 'idle', url: '' })
  const isPdf = path.toLowerCase().endsWith('.pdf')
  const load = async () => {
    setState({ status: 'loading', url: '' })
    try {
      setState({ status: 'ready', url: await getPriorityProofUrl(path) })
    } catch {
      setState({ status: 'failed', url: '' })
    }
  }
  if (state.status === 'ready' && isPdf) {
    return <a class="admin-chip-button priority-proof-open" href={state.url} target="_blank" rel="noreferrer noopener"><Icon name="file" size={14} /> Open the PDF proof</a>
  }
  if (state.status === 'ready') {
    return <figure class="priority-proof">
      <img src={state.url} alt="Proof submitted by the household" referrerpolicy="no-referrer" />
      <figcaption>
        <a href={state.url} target="_blank" rel="noreferrer noopener">Open full size</a>
        <button type="button" onClick={() => setState({ status: 'idle', url: '' })}>Hide</button>
      </figcaption>
    </figure>
  }
  return <button type="button" class="admin-chip-button priority-proof-open" onClick={load} disabled={state.status === 'loading'}>
    {state.status === 'loading' ? <span class="btn-spinner" aria-hidden="true" /> : <Icon name="file" size={14} />}
    {state.status === 'failed' ? 'Proof unavailable. Try again' : isPdf ? 'View proof (PDF)' : 'View proof'}
  </button>
}

function ReviewCard({ member, busy, onReview }) {
  const [confirm, confirmDialog] = useConfirm()
  const reject = async () => {
    const revoking = member.status === 'verified'
    const reason = await confirm({
      title: revoking ? `Revoke ${member.full_name}'s priority?` : `Reject the proof for ${member.full_name}?`,
      message: revoking
        ? 'Rescuers stop seeing this category as verified on the household\'s calls. The household sees the reason and can send a new proof.'
        : 'The household sees the reason and can send a new proof. Until then, rescuers see this category as unverified.',
      confirmLabel: revoking ? 'Revoke' : 'Reject proof',
      reasons: REJECT_REASONS,
      reasonLabel: 'Reason shown to the household',
      otherPlaceholder: 'Say what to fix, for example: upload the back of the ID',
      icon: 'x',
    })
    if (reason) onReview(member, 'rejected', reason)
  }
  const age = ageFromBirthYear(member.birth_year)
  // A child turns 18, or a pregnancy is long past its due date: no longer counted.
  const lapsed = (member.category === 'child' && age > CHILD_MAX_AGE)
    || (member.category === 'pregnant' && member.due_date && new Date(`${member.due_date}T00:00:00`).getTime() < Date.now() - 60 * 86400000)
  const household = member.household ?? {}
  return <article class={`priority-review-card is-${member.status}`}>
    <div class="priority-review-head">
      <span class="priority-review-icon"><Icon name={PRIORITY_ICONS[member.category]} size={20} /></span>
      <div>
        <strong>{member.full_name}</strong>
        <small>
          {STAFF_LABELS[member.category]}
          {age !== null ? ` · ${age} years old (born ${member.birth_year})` : ''}
          {member.due_date ? ` · due ${formatDate(member.due_date)}` : ''}
        </small>
      </div>
      <span class={`priority-review-status is-${member.status}`}>{STATUS_LABELS[member.status]}</span>
    </div>
    {lapsed && <p class="priority-review-lapsed"><Icon name="clock" size={14} /> No longer counted on calls: {member.category === 'child' ? 'this person is now 18 or older' : 'the due date has passed'}.</p>}
    <dl class="priority-review-facts">
      <div><dt>Household</dt><dd>
        {household.display_name || 'Unnamed account'}{household.barangay ? ` · ${household.barangay}` : ''}
        {household.phone && <a href={`tel:${household.phone}`}><Icon name="phone" size={12} /> {household.phone}</a>}
      </dd></div>
      <div><dt>Proof to look for</dt><dd>{PROOF_NEEDED[member.category]}</dd></div>
      {member.details && <div><dt>Details</dt><dd>{member.details}</dd></div>}
      <div><dt>{member.status === 'pending' ? 'Sent' : 'Reviewed'}</dt><dd>{timeAgo(member.status === 'pending' ? member.updated_at : member.reviewed_at ?? member.updated_at)}</dd></div>
      {member.review_note && <div><dt>{member.status === 'rejected' ? 'Reason given' : 'Note'}</dt><dd>{member.review_note}</dd></div>}
    </dl>
    <ProofViewer key={member.proof_path} path={member.proof_path} />
    <div class="priority-review-actions">
      {member.status !== 'verified' && <button type="button" class="approve-button" disabled={busy} onClick={() => onReview(member, 'verified')}><Icon name="check" size={14} /> Verify</button>}
      {member.status !== 'rejected' && <button type="button" class="reject-button" disabled={busy} onClick={reject}><Icon name="x" size={14} /> {member.status === 'verified' ? 'Revoke' : 'Reject'}</button>}
    </div>
    {confirmDialog}
  </article>
}

// Proofs for priority rescue (persons with disability, pregnant women, senior
// citizens, children). Verified categories appear on that household's calls.
export function PriorityPanel({ members, loading, error, busyId, onReview }) {
  const [filter, setFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const count = (status) => members.filter((member) => member.status === status).length
  const query = search.trim().toLowerCase()
  const shown = members
    .filter((member) => filter === 'all' || member.status === filter)
    .filter((member) => !query || `${member.full_name} ${member.household?.display_name ?? ''} ${member.household?.barangay ?? ''} ${STAFF_LABELS[member.category]}`.toLowerCase().includes(query))
    // Waiting: oldest first, so nobody waits longest. Others: most recent first.
    .sort((a, b) => filter === 'pending'
      ? new Date(a.updated_at) - new Date(b.updated_at)
      : new Date(b.reviewed_at ?? b.updated_at) - new Date(a.reviewed_at ?? a.updated_at))
  const households = new Set(members.filter((member) => member.status === 'verified').map((member) => member.user_id)).size

  return <section class="admin-centers-panel priority-review-panel">
    <div class="queue-heading">
      <div><span class="ops-eyebrow">PWD · Pregnant · Senior citizens · Children</span><h2>Priority rescue proofs</h2></div>
    </div>
    <div class="admin-security-checks">
      <p><Icon name="shield" size={15} /><span><b>Sensitive personal information (RA 10173).</b> Open a proof only to check it, and do not download, screenshot or share it. Rescuers never see names or proofs, only the verified categories on a household's SOS and reports.</span></p>
    </div>
    <div class="priority-review-stats">
      <span><b>{count('pending')}</b> waiting</span>
      <span><b>{count('verified')}</b> verified ({households} {households === 1 ? 'household' : 'households'})</span>
      <span><b>{count('rejected')}</b> rejected</span>
    </div>
    <div class="priority-review-tools">
      <div class="rx-segment" role="tablist" aria-label="Review status">
        {FILTERS.map(([id, label]) => <button type="button" role="tab" key={id} aria-selected={filter === id} class={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}>
          {label} <b>{id === 'all' ? members.length : count(id)}</b>
        </button>)}
      </div>
      <input type="search" value={search} placeholder="Search name, household or barangay" onInput={(event) => setSearch(event.currentTarget.value)} aria-label="Search priority entries" />
    </div>
    {error && <p class="form-error" role="alert">{error}</p>}
    {loading
      ? <LoadingCards label="Loading priority entries…" count={2} />
      : <div class="priority-review-list">
        {shown.map((member) => <ReviewCard key={member.id} member={member} busy={busyId === member.id} onReview={onReview} />)}
        {shown.length === 0 && <p class="admin-empty-state">{filter === 'pending' ? 'No proofs waiting for review.' : 'Nothing to show here.'}</p>}
      </div>}
    <p class="admin-field-help">A senior citizen must be {SENIOR_AGE} or older and a child under {CHILD_MAX_AGE + 1}, by birth year. Any change by the household sends the entry back here for review.</p>
  </section>
}
