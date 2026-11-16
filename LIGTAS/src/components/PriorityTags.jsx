import { Icon } from '../lib/ui.jsx'
import { PRIORITY_ICONS, STAFF_LABELS, countCategories } from '../lib/priority.js'

// The priority categories on a report or SOS call, for rescuers and admins.
// Verified ones were checked against a proof by an admin; the others were
// listed by the household but not checked yet. No names or documents appear.
export function PriorityTags({ needs = [], pending = [] }) {
  const verified = countCategories(needs)
  const unverified = countCategories(pending)
  return <>
    {verified.map(([category, count]) => <span class="priority-tag is-verified" key={`v-${category}`} title="Proof checked by an administrator">
      <Icon name={PRIORITY_ICONS[category]} size={14} /> {STAFF_LABELS[category]}{count > 1 ? ` ×${count}` : ''}
    </span>)}
    {unverified.map(([category, count]) => <span class="priority-tag is-pending" key={`p-${category}`} title="Listed by the household; the proof is not checked yet">
      <Icon name={PRIORITY_ICONS[category]} size={14} /> {STAFF_LABELS[category]}{count > 1 ? ` ×${count}` : ''} · unverified
    </span>)}
  </>
}

export function hasPriority(report) {
  return Boolean(report.priority_needs?.length || report.priority_pending?.length)
}
