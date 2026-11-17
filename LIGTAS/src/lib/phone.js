// Philippine mobile numbers are saved as +63 followed by the 10-digit number
// (9XX XXX XXXX). People can type, paste or autofill 0917…, 63917… or
// +63 917…; the country code and the leading 0 are removed automatically.
export function toLocalDigits(value) {
  return String(value ?? '')
    .replace(/\D/g, '')
    .replace(/^63(?=9)/, '')
    .replace(/^0+/, '')
    .slice(0, 10)
}

// The 10 digits grouped for reading, like the placeholder: 917 123 4567.
export function formatLocalDigits(value) {
  const digits = toLocalDigits(value)
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean).join(' ')
}

export const isValidMobile = (stored) => /^\+639\d{9}$/.test(stored ?? '')

export function toStoredMobile(value) {
  const digits = toLocalDigits(value)
  return digits ? `+63${digits}` : ''
}
