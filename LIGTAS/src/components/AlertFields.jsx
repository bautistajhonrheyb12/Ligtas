import { ALERT_TYPES, alertEndText } from '../lib/ui.jsx'

// Fields shared by the admin and rescuer alert forms.

// The alert type. "Other" must say what it really is (for example "Chemical
// spill"); that text is shown to everyone instead of "Other".
export function AlertTypeField({ type, onTypeChange, other, onOtherChange }) {
  return <div class="alert-type-field">
    <label>
      Alert type
      <select name="type" value={type} onChange={(event) => onTypeChange(event.currentTarget.value)}>
        {ALERT_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
    {type === 'Other' && <label class="field-reveal">
      What kind of alert?
      <input
        name="typeOther"
        required
        minLength="2"
        maxLength="60"
        value={other}
        placeholder="e.g. Chemical spill"
        autoFocus
        onInput={(event) => onOtherChange(event.currentTarget.value)}
      />
      <small class="admin-field-help">Shown to everyone in place of "Other".</small>
    </label>}
  </div>
}

// '' when the type is fine, otherwise what to fix.
export function alertTypeProblem(type, other) {
  if (type !== 'Other') return ''
  const text = other.trim()
  if (text.length < 2) return 'Say what kind of alert this is, for example "Chemical spill".'
  if (/^others?$/i.test(text)) return 'Name the actual type (for example "Chemical spill"), not "Other".'
  return ''
}

const PRESETS = [['', 'Does not expire'], ['3', 'In 3 hours'], ['6', 'In 6 hours'], ['12', 'In 12 hours'], ['24', 'In 24 hours'], ['72', 'In 3 days'], ['custom', 'Custom date and time…']]
// The same limits as the database (alerts_validate): from 15 minutes to 30 days ahead.
const MIN_MINUTES = 15
const MAX_DAYS = 30

// The value a datetime-local input uses, in the phone's own time zone.
function toLocalInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

// The end time for a choice: { expiresAt, error }.
export function expiryFor(choice, custom, now = Date.now()) {
  if (!choice) return { expiresAt: null, error: '' }
  if (choice !== 'custom') return { expiresAt: new Date(now + Number(choice) * 3600000).toISOString(), error: '' }
  if (!custom) return { expiresAt: null, error: 'Choose the date and time when the alert should end.' }
  // A datetime-local value has no time zone, so it is read as local time.
  const end = new Date(custom)
  if (Number.isNaN(end.getTime())) return { expiresAt: null, error: 'That date and time is not valid.' }
  if (end.getTime() < now + MIN_MINUTES * 60000) return { expiresAt: null, error: `The end time must be at least ${MIN_MINUTES} minutes from now.` }
  if (end.getTime() > now + MAX_DAYS * 86400000) return { expiresAt: null, error: `An alert can end at most ${MAX_DAYS} days from now.` }
  return { expiresAt: end.toISOString(), error: '' }
}

// When the alert ends: a preset, or a chosen date and time. The line below
// always says exactly when it will end.
export function ExpiryField({ choice, onChoiceChange, custom, onCustomChange, now }) {
  const { expiresAt, error } = expiryFor(choice, custom, now)
  const choose = (value) => {
    onChoiceChange(value)
    // A sensible starting point: this time tomorrow.
    if (value === 'custom' && !custom) onCustomChange(toLocalInput(new Date(now + 24 * 3600000)))
  }
  return <div class="alert-expiry-field">
    <label>
      Ends
      <select name="expiresIn" value={choice} onChange={(event) => choose(event.currentTarget.value)}>
        {PRESETS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
    </label>
    {choice === 'custom' && <label class="field-reveal">
      End date and time
      <input
        type="datetime-local"
        name="expiresAt"
        required
        min={toLocalInput(new Date(now + MIN_MINUTES * 60000))}
        max={toLocalInput(new Date(now + MAX_DAYS * 86400000))}
        value={custom}
        onInput={(event) => onCustomChange(event.currentTarget.value)}
      />
    </label>}
    <p class={`alert-expiry-summary${error ? ' is-error' : ''}`} aria-live="polite">
      {!choice ? 'Stays until you end it.' : expiresAt ? `Ends ${alertEndText(expiresAt, now)}.` : error}
    </p>
  </div>
}
