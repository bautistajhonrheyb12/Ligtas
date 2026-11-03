import { useState } from 'preact/hooks'
import { sendPasswordReset } from '../lib/supabase.js'
import { Icon, Logo } from '../lib/ui.jsx'

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

    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (mode === 'signup' && displayName.trim().length < 2) {
      setError('Please enter your name')
      return
    }

    if (mode === 'signup' && phone.trim() && !/^\+?[0-9][0-9 -]{5,19}$/.test(phone.trim())) {
      setError('Enter a valid mobile number, for example 0917 123 4567')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await onLogin(role, email.trim(), password, mode, {
        displayName: displayName.trim(),
        barangay: barangay.trim(),
        phone: phone.trim(),
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

  if (!selectedRole) {
    return (
      <section class="auth-screen">

        <div class="auth-top">
          <button class="back-button" onClick={onClose}>
            ← Back
          </button>

          <Logo small />
        </div>

        <div class="auth-intro">

          <Logo />

          <h2>LIGTAS</h2>

          <p>
            Choose how you want to access the system.
          </p>

        </div>

        {authMessage && <div class="form-error">{authMessage}</div>}

        <div class="role-list">

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
      <div class="input-group input-group--plain">
        <input type="tel" name="phone" autoComplete="tel" inputMode="tel" maxLength="20" placeholder="0917 123 4567" value={phone} onInput={(e) => setPhone(e.currentTarget.value)} />
      </div>
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
