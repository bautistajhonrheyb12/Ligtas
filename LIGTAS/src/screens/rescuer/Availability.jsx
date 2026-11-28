import { AVAILABILITY } from '../../lib/rescue.js'
import { Icon, timeAgo } from '../../lib/ui.jsx'

// The rescuer's availability, seen by operations on the admin dashboard.
// status: the rescuer's rescuer_status row, or null when never set.
export function AvailabilityPicker({ status, saving, error, onChange }) {
  const current = status?.availability ?? null
  return <div class="rx-availability" role="group" aria-labelledby="rx-availability-label">
    <div class="rx-availability-head">
      <span id="rx-availability-label">Your availability</span>
      <small>{current ? `Operations sees: ${current} · ${timeAgo(status.updated_at).toLowerCase()}` : 'Not set yet. Operations cannot see if you can take a call.'}</small>
    </div>
    <div class="rx-availability-options">
      {AVAILABILITY.map((option) => <button
        type="button"
        key={option.id}
        class={`rx-availability-option is-${option.tone}${current === option.id ? ' is-active' : ''}`}
        aria-pressed={current === option.id}
        disabled={saving}
        onClick={() => current !== option.id && onChange(option.id)}
      >
        <i aria-hidden="true" />
        <span><strong>{option.id}</strong><small>{option.hint}</small></span>
        {saving === option.id && <span class="btn-spinner" aria-hidden="true" />}
      </button>)}
    </div>
    {error && <p class="rx-inline-error" role="alert"><Icon name="alert" size={14} /> {error}</p>}
  </div>
}
