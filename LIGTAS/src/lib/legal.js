// The Terms of Use and Privacy Policy (screens/LegalPage.jsx). Change
// LEGAL_VERSION to the new date whenever either document changes in a way
// people should agree to again: everyone is then asked to accept once more.
export const LEGAL_VERSION = '2026-11-17'
export const LEGAL_UPDATED = 'November 17, 2026'

// Where people send privacy requests and questions. Shown on both pages.
export const CONTACT_EMAIL = ''

export const termsUrl = '/#terms'
export const privacyUrl = '/#privacy'

// The profile's accepted version: undefined before the acceptance migration
// (nothing is asked then), null when never accepted.
export function needsTermsAcceptance(profile) {
  return Boolean(profile) && profile.terms_version !== undefined && profile.terms_version !== LEGAL_VERSION
}
