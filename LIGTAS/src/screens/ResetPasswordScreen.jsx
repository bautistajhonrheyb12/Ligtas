import { useState } from 'preact/hooks'
import { updatePassword } from '../lib/supabase.js'
import { PasswordChecklist, passwordProblem } from '../lib/ui.jsx'

// Shown after someone opens the password reset link from their email.
export function ResetPasswordScreen({ onDone, onCancel }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (passwordProblem(password)) {
      setError(passwordProblem(password))
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setIsSaving(true)
    try {
      await updatePassword(password)
      setIsSaved(true)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return <section class="login-page">
    <div class="login-overlay">
      <div class="login-card">
        <h1>LIGTAS</h1>
        <h2>{isSaved ? 'Password changed' : 'Set a new password'}</h2>
        <p class="role-description">{isSaved ? 'Your new password is saved. Use it the next time you sign in.' : 'Choose a new password for your account.'}</p>

        {isSaved
          ? <button type="button" class="login-button" onClick={onDone}>Continue →</button>
          : <form onSubmit={submit}>
            {error && <div class="form-error" role="alert" key={error}>{error}</div>}
            <label>
              NEW PASSWORD
              <div class="input-group">
                <div class="input-icon"><img src="/icons/lock.png" alt="" /></div>
                <input type={showPassword ? 'text' : 'password'} name="new-password" autoComplete="new-password" required minLength="8" maxLength="72" placeholder="Create a strong password" value={password} onInput={(event) => setPassword(event.currentTarget.value)} />
                <button type="button" class={`eye-button ${showPassword ? 'is-visible' : ''}`} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
                  <img src={showPassword ? '/icons/eye.png' : '/icons/eye-off.png'} alt="" />
                </button>
              </div>
            </label>
            <PasswordChecklist password={password} />
            <label>
              CONFIRM PASSWORD
              <div class="input-group">
                <div class="input-icon"><img src="/icons/lock.png" alt="" /></div>
                <input type={showPassword ? 'text' : 'password'} name="confirm-password" autoComplete="new-password" required placeholder="Type it again" value={confirmPassword} onInput={(event) => setConfirmPassword(event.currentTarget.value)} />
              </div>
            </label>
            <button type="submit" class="login-button" disabled={isSaving}>
              {isSaving && <span class="btn-spinner" aria-hidden="true" />}
              {isSaving ? 'Saving…' : 'Save new password'}
            </button>
          </form>}

        {!isSaved && <div class="bottom-buttons"><button type="button" class="back-role" onClick={onCancel}>Cancel and sign out</button></div>}
      </div>
    </div>
  </section>
}
