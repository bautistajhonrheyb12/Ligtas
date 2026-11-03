import { useState } from 'preact/hooks'
import { PhoneInput } from '../components/PhoneInput.jsx'
import { isValidMobile } from '../lib/phone.js'
import { sendPasswordReset, signInWithGoogle } from '../lib/supabase.js'
import { Icon, Logo, passwordProblem } from '../lib/ui.jsx'

const roles = [
  { id: 'citizen', name: 'Citizen', description: 'Stay informed, report incidents, and receive important alerts.', icon: 'citizen' },
  { id: 'rescuer', name: 'Rescuer', description: 'Coordinate operations, manage reports, and assist communities.', icon: 'rescue' },
  { id: 'admin', name: 'Admin', description: 'Coordinate alerts, review reports, and manage community safety information.', icon: 'admin' },
]

function RoleIcon({ type }) {
  return <span class="role-icon-placeholder"><img src={`/roles/${type}.png`} alt={`${type} icon`} onError={(event) => { event.currentTarget.style.display = 'none' }} /></span>
}

export function AuthScreen({
  showAdmin = false,
  role,
  mode,
  onChooseRole,
  onBack,
  onClose,
  onModeChange,
  onLogin,
  authMessage,
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [barangay, setBarangay] = useState('')
  const [phone, setPhone] = useState('')
  const [isSendingReset, setIsSendingReset] = useState(false)
  const [isOpeningGoogle, setIsOpeningGoogle] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const visibleRoles = showAdmin ? roles : roles.filter((item) => item.id !== 'admin')
  const selectedRole = visibleRoles.find(r => r.id === role)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')

    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (mode === 'signup' && passwordProblem(password)) {
      setError(passwordProblem(password))
      return
    }

    if (mode === 'signup' && displayName.trim().length < 2) {
      setError('Please enter your name')
      return
    }

    if (mode === 'signup' && phone && !isValidMobile(phone)) {
      setError('Enter the 10 digits after +63, for example 917 123 4567')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await onLogin(role, email.trim(), password, mode, {
        displayName: displayName.trim(),
        barangay: barangay.trim(),
        phone,
      })
      if (result?.confirmationRequired) {
        setNotice('Check your email to confirm your account before signing in.')
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : ''
      if (/email rate limit exceeded|too many requests/i.test(message)) {
        setError(
          mode === 'signup'
            ? 'Supabase has temporarily limited confirmation emails. Stop retrying sign-up. For development, disable email confirmations in Supabase Authentication settings; before production, configure custom SMTP.'
            : 'Supabase has temporarily limited authentication requests. Wait before trying again.'
        )
      } else {
        setError(message || 'Authentication failed. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetPassword = async () => {
    setError('')
    setNotice('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter your email above first, then tap Forgot password again.')
      return
    }
    setIsSendingReset(true)
    try {
      await sendPasswordReset(email.trim())
      setNotice('If that email has an account, a reset link is on its way. Open it on this device.')
    } catch (resetError) {
      setError(resetError.message)
    } finally {
      setIsSendingReset(false)
    }
  }

  // Leaves the page for Google; the app finishes signing in when it comes back.
  const continueWithGoogle = async () => {
    setError('')
    setNotice('')
    setIsOpeningGoogle(true)
    try {
      await signInWithGoogle()
    } catch (googleError) {
      setError(googleError.message)
      setIsOpeningGoogle(false)
    }
  }

  if (!selectedRole) {
    return (
      <section class="auth-screen">

        <div class="auth-top">
          <button class="back-button" onClick={onClose}>
            ← Back
          </button>
        </div>

        <div class="auth-intro">

          <Logo />

          <h2>LIGTAS</h2>

          <p>
            Choose how you want to access the system.
          </p>

        </div>

        {authMessage && <div class="form-error">{authMessage}</div>}

        <div class={`role-list role-list--${visibleRoles.length}`}>

          {visibleRoles.map(item => (

            <button
              key={item.id}
              class={`role-card role-card--${item.id}`}
              onClick={() => onChooseRole(item.id)}
            >

              <div class="role-image-placeholder">
                <RoleIcon type={item.id} />
              </div>

              <div class="role-card-copy">

                <b>{item.name}</b>

                <small>{item.description}</small>

              </div>

              <span class="role-card-cta"><span>Continue</span><Icon name="arrow" size={18} /></span>

            </button>

          ))}

        </div>

      </section>
    )
  }

  return (

<section class="login-page">

<div class="login-overlay">

<div class="login-card">

<div class="login-logo">

<img
    src="/LigtasLogo.png"
    alt="LIGTAS Logo"
/>
</div>
<h1>LIGTAS</h1>

<p class="login-subtitle">

Localized Intelligent Geographic
Tagging & Safety Mapping System

</p>

<div class={`role-circle role-circle--${selectedRole.id}`}>

<img
    src={`/roles/${selectedRole.id}.png`}
    alt=""
/>

</div>
<h2>{selectedRole.name}</h2>

<p class="role-description">

{selectedRole.id === "citizen" &&
"View disaster zones, evacuation centers, and stay informed during emergencies."}

{selectedRole.id === "rescuer" &&
"Coordinate rescue operations and emergency response."}

{selectedRole.id === "admin" &&
"Manage the entire LIGTAS platform."}

</p>

{selectedRole.id !== "citizen" && (

<div class="restricted-box">

<strong>⚠ Restricted Access</strong>

<p>

{selectedRole.id === "rescuer"
? "Rescuer accounts are created by the Super Administrator."
: "Only authorized personnel may access this portal. You'll also need the code from your authenticator app."}

</p>

</div>

)}

<form onSubmit={handleSubmit}>

{error && <div class="form-error" role="alert" key={error}>{error}</div>}
{authMessage && <div class="form-error" key={authMessage}>{authMessage}</div>}
{notice && <div class="form-notice" role="status">{notice}</div>}

{mode === 'signup' && <div class="signup-details field-reveal">
  <label>
    FULL NAME
    <div class="input-group input-group--plain">
      <input type="text" name="name" autoComplete="name" required minLength="2" maxLength="80" placeholder="e.g. Juan Dela Cruz" value={displayName} onInput={(e) => setDisplayName(e.currentTarget.value)} />
    </div>
  </label>
  <div class="signup-row">
    <label>
      BARANGAY
      <div class="input-group input-group--plain">
        <input type="text" name="barangay" autoComplete="address-level3" maxLength="80" placeholder="e.g. Poblacion" value={barangay} onInput={(e) => setBarangay(e.currentTarget.value)} />
      </div>
    </label>
    <label>
      MOBILE NUMBER
      <PhoneInput class="input-group phone-field" name="phone" title="Enter the 10 digits after +63, for example 917 123 4567" value={phone} onChange={setPhone} />
    </label>
  </div>
  <p class="signup-help">Responders use your number to call you back about your reports. You can change these later.</p>
</div>}

<label>

EMAIL

<div class="input-group">

<div class="input-icon">

<img
    src="/icons/email.png"
    alt=""
/>

</div>

<input
type="email"
name="email"
autoComplete={mode === 'signup' ? 'email' : 'username'}
required
placeholder="Enter your email"
value={email}
onInput={(e) => setEmail(e.currentTarget.value)}
/>

</div>

</label>

<label>

PASSWORD

<div class="input-group">

<div class="input-icon">

<img
    src="/icons/lock.png"
    alt=""
/>

</div>
<input
type={showPassword ? "text" : "password"}
name="password"
autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
required
placeholder="Enter your password"
value={password}
onInput={(e) => setPassword(e.currentTarget.value)}
/>

<button
type="button"
class={`eye-button ${showPassword ? 'is-visible' : ''}`}
aria-label={showPassword ? 'Hide password' : 'Show password'}
aria-pressed={showPassword}
onClick={(e) => {
  e.preventDefault()
  setShowPassword(!showPassword)
}}
>

<img
    src={showPassword ? '/icons/eye.png' : '/icons/eye-off.png'}
    alt={showPassword ? 'Hide password' : 'Show password'}
/>

</button>

</div>

</label>

{mode === 'signup' && (
<label class="field-reveal">

CONFIRM PASSWORD

<div class="input-group">

<div class="input-icon">

<img
    src="/icons/lock.png"
    alt=""
/>

</div>
<input
type={showConfirmPassword ? "text" : "password"}
name="confirm-password"
autoComplete="new-password"
required
placeholder="Confirm your password"
value={confirmPassword}
onInput={(e) => setConfirmPassword(e.currentTarget.value)}
/>

<button
  type="button"
  class={`eye-button ${showConfirmPassword ? 'is-visible' : ''}`}
  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
  aria-pressed={showConfirmPassword}
  onClick={(e) => {
    e.preventDefault()
    setShowConfirmPassword(!showConfirmPassword)
  }}
>
  <img
    src={showConfirmPassword ? '/icons/eye.png' : '/icons/eye-off.png'}
    alt={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
  />
</button>

</div>

</label>
)}

{mode === 'login' && <button type="button" class="forgot-password" onClick={resetPassword} disabled={isSendingReset}>

{isSendingReset ? 'Sending reset link…' : 'Forgot Password?'}

</button>}

<button
type="submit"
class="login-button"
disabled={isSubmitting}
>

{isSubmitting && <span class="btn-spinner" aria-hidden="true" />}
{isSubmitting ? 'Please wait…' : mode === 'signup' ? 'Create account →' : 'LOG IN'}

</button>

</form>

{selectedRole.id === "citizen" && (

<>

<div class="login-divider">

<span></span>

OR

<span></span>

</div>

<button type="button" class="google-button" onClick={continueWithGoogle} disabled={isOpeningGoogle}>
  {isOpeningGoogle
    ? <span class="btn-spinner" aria-hidden="true" />
    : <svg class="google-mark" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>}
  {isOpeningGoogle ? 'Opening Google…' : 'Continue with Google'}
</button>

<p class="signup-text">

{mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}

<button
type="button"
class="signup-link"
onClick={() => { setError(''); setNotice(''); onModeChange(mode === 'signup' ? 'login' : 'signup') }}
>

{mode === 'signup' ? 'Log In' : 'Sign Up'}

</button>

</p>

</>

)}

<div class="bottom-buttons">

<button
class="back-role"
onClick={onBack}
>

Change Role

</button>

<button
class="back-role"
onClick={onClose}
>

Back Home

</button>

</div>

</div>

</div>

</section>

  )

}
