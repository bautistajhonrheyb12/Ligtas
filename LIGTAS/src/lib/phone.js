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

export const isValidMobile = (stored) => /^\+639\d{9}$/.test(stored ?? '')

export function toStoredMobile(value) {
  const digits = toLocalDigits(value)
  return digits ? `+63${digits}` : ''
}
