import { toLocalDigits, toStoredMobile } from '../lib/phone.js'

// A mobile number field with +63 already filled in, so people enter only the
// 10 digits. `value` and `onChange` use the saved form, e.g. +639171234567.
export function PhoneInput({ value, onChange, class: className = 'phone-field', title, ...inputProps }) {
  return <div class={className}>
    <span class="phone-prefix" aria-hidden="true">+63</span>
    <input
      {...inputProps}
      class="phone-input"
      type="tel"
      inputMode="numeric"
      autoComplete="tel"
      pattern="9[0-9]{9}"
      title={title}
      placeholder="917 123 4567"
      value={toLocalDigits(value)}
      onInput={(event) => {
        // Written back straight away: typing a lone 0 leaves the saved value
        // unchanged, so there would be no re-render to remove it.
        const digits = toLocalDigits(event.currentTarget.value)
        event.currentTarget.value = digits
        onChange(toStoredMobile(digits))
      }}
    />
  </div>
}
