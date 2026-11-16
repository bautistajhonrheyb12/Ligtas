// The Terms of Use and Privacy Policy (text in content/terms.js and
// content/privacy.js, shown by screens/LegalPage.jsx). LEGAL_VERSION is the
// date they were last changed in a way people should agree to again: change it
// and everyone is asked to accept once more. Typo fixes keep the same version.
export const LEGAL_VERSION = '2026-11-17'

// Where people send privacy requests and questions. Shown on both pages.
export const CONTACT_EMAIL = 'ligtas1130@gmail.com'

export const termsUrl = '/#terms'
export const privacyUrl = '/#privacy'

// The profile's accepted version: undefined before the acceptance migration
// (nothing is asked then), null when never accepted.
export function needsTermsAcceptance(profile) {
  return Boolean(profile) && profile.terms_version !== undefined && profile.terms_version !== LEGAL_VERSION
}
