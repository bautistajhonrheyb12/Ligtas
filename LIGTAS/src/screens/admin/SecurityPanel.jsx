import { Icon, LoadingCards, timeAgo } from '../../lib/ui.jsx'
import { ConfirmButton } from './AdminPanels.jsx'

const FLAG_LABELS = {
  impossible_travel: 'Impossible travel',
  outside_area: 'Outside Santa Maria',
  foreign_network: 'Foreign network',
}

// Accounts whose reports failed the location checks, grouped so an admin can
// look into each person once and clear their flags.
export function SecurityPanel({ flags, people, loading, error, country, onClear }) {
  const open = flags.filter((flag) => !flag.cleared_at)
  const accounts = [...new Set(open.map((flag) => flag.user_id))].map((userId) => ({
    userId,
    person: people.find((item) => item.id === userId),
    items: open.filter((flag) => flag.user_id === userId),
  }))
  const clearedCount = flags.length - open.length
  // The database pauses ordinary reports after 3 open flags within a day.
  const isPaused = (items) => items.filter((flag) => Date.now() - new Date(flag.created_at).getTime() < 86400000).length >= 3

  return <section class="admin-centers-panel admin-security-panel">
    <div class="queue-heading">
      <div><span class="ops-eyebrow">Report safety</span><h2>Flagged accounts</h2></div>
    </div>

    <div class="admin-security-checks">
      <p><Icon name="check" size={15} /><span><b>Location check is on.</b> Reports from outside Santa Maria, or GPS reports impossibly far from the same person's last one, are blocked. An SOS always goes through, marked for rescuers. Three flags within a day pause an account's ordinary reports until you clear them.</span></p>
      {country
        ? <p><Icon name="check" size={15} /><span><b>Network check is on.</b> This connection shows as {country}. Reports from networks outside the Philippines are marked, not blocked.</span></p>
        : <p class="is-off"><Icon name="alert" size={15} /><span><b>Network check is unavailable.</b> Supabase is not passing on the network country, so only the location check runs.</span></p>}
    </div>

    {error && <p class="form-error" role="alert">{error}</p>}
    {loading ? <LoadingCards label="Loading security flags…" count={2} /> : <div class="admin-security-list">
      {accounts.map(({ userId, person, items }) => <article class="admin-security-card" key={userId}>
        <div class="admin-security-head">
          <div>
            <strong>{person?.display_name || 'Unnamed account'}</strong>
            <small>{person?.role ?? 'citizen'}{person?.barangay ? ` · ${person.barangay}` : ''} · {items.length} {items.length === 1 ? 'flag' : 'flags'}</small>
          </div>
          {person?.phone && <a href={`tel:${person.phone}`}><Icon name="phone" size={13} /> {person.phone}</a>}
        </div>
        <ul>
          {items.map((flag) => <li key={flag.id}>
            <span class={`admin-flag admin-flag--${flag.kind}`}>{FLAG_LABELS[flag.kind] ?? flag.kind}</span>
            <span>{flag.detail}</span>
            <small>{flag.report_id ? 'Report kept and marked' : 'Report blocked'} · {timeAgo(flag.created_at)}</small>
          </li>)}
        </ul>
        {isPaused(items) && <p class="admin-security-paused"><Icon name="alert" size={14} /> Reporting is paused for this account (SOS still works). Clearing the flags lifts the pause.</p>}
        <ConfirmButton class="admin-security-clear" label={`Clear flags for ${person?.display_name || 'this account'}`} confirmLabel="Tap again to clear" onConfirm={() => onClear(userId)}>
          <Icon name="check" size={13} /> Clear flags
        </ConfirmButton>
      </article>)}
      {accounts.length === 0 && <p class="admin-empty-state">No flagged accounts. Reports that fail the location checks will show here.</p>}
      {clearedCount > 0 && <p class="admin-field-help">{clearedCount} cleared {clearedCount === 1 ? 'flag' : 'flags'} in the last 30 days.</p>}
    </div>}
  </section>
}
