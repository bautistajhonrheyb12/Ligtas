// "Continue with Google" with Google's own button (Google Identity Services),
// shown on LIGTAS's page. Google's sign-in window then names LIGTAS's address,
// not the Supabase project address that the redirect sign-in shows. Google
// gives the app a signed ID token, which Supabase checks and turns into a
// LIGTAS sign-in (lib/supabase.js, signInWithGoogleToken).
//
// The client ID is not a secret (it is part of every Google sign-in link).
// It is the Web client in Google Cloud whose Authorized JavaScript origins
// list this site (SETUP.md, "Continue with Google").
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
  || '477404475227-t999jt2ect34j1a2lbifscln78noeodq.apps.googleusercontent.com'

// In English, like the rest of the sign-in screen (otherwise Google follows
// the phone's language for the button's label).
const SCRIPT_URL = 'https://accounts.google.com/gsi/client?hl=en'
let loading = null

// Google's script is only fetched when the citizen sign-in screen opens.
export function loadGoogleButton() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SCRIPT_URL
      script.async = true
      script.onload = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error('Google sign-in did not load.')))
      script.onerror = () => {
        loading = null
        script.remove()
        reject(new Error('Google sign-in could not be loaded.'))
      }
      document.head.appendChild(script)
    })
  }
  return loading
}

// A fresh random value for each sign-in. Google signs its hash into the ID
// token and Supabase compares it with the original, so a token caught on its
// way cannot be used again.
export async function makeNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const raw = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hashed = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return { raw, hashed }
}
