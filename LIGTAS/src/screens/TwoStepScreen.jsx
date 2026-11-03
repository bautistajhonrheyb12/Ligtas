import { useEffect, useState } from 'preact/hooks'
import { startTwoStepSetup, verifyTwoStepCode } from '../lib/supabase.js'

// Shown to admins after their password. The first time, it links an
// authenticator app; every sign-in after that asks for the app's code.
export function TwoStepScreen({ mode, onVerified, onCancel }) {
  const [setup, setSetup] = useState(null)
  const [setupError, setSetupError] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadSetup = () => {
    setSetupError('')
    startTwoStepSetup().then(setSetup).catch((loadError) => setSetupError(loadError.message))
  }

  useEffect(() => { if (mode === 'enroll') loadSetup() }, [mode])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app')
      return
    }
    setIsVerifying(true)
    try {
      await verifyTwoStepCode(code, setup?.factorId)
      await onVerified()
    } catch (verifyError) {
      setError(verifyError.message)
      setCode('')
    } finally {
      setIsVerifying(false)
    }
  }

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(setup.secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setShowKey(true)
    }
  }

  const isEnroll = mode === 'enroll'
  const codeForm = <form onSubmit={submit}>
    {error && <div class="form-error" role="alert" key={error}>{error}</div>}
    <label>
      6-DIGIT CODE
      <div class="input-group input-group--plain">
        <input
          class="two-step-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength="6"
          required
          autoFocus={!isEnroll}
          placeholder="123456"
          value={code}
          onInput={(event) => setCode(event.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
        />
      </div>
    </label>
    <button type="submit" class="login-button" disabled={isVerifying || (isEnroll && !setup)}>
      {isVerifying && <span class="btn-spinner" aria-hidden="true" />}
      {isVerifying ? 'Checking…' : isEnroll ? 'Turn on two-step sign-in' : 'Confirm and continue'}
    </button>
  </form>

  return <section class="login-page">
    <div class="login-overlay">
      <div class="login-card two-step-card">
        <div class="login-logo"><img src="/LigtasLogo.png" alt="LIGTAS Logo" /></div>
        <h1>LIGTAS</h1>
        <h2>{isEnroll ? 'Set up two-step sign-in' : 'Two-step sign-in'}</h2>
        <p class="role-description">
          {isEnroll
            ? 'Admin accounts need a code from an authenticator app as well as the password, so a stolen password alone cannot get in.'
            : 'Open your authenticator app and enter the code shown for LIGTAS.'}
        </p>

        {isEnroll && <ol class="two-step-steps">
          <li>Install an authenticator app on your phone, such as Google Authenticator, Microsoft Authenticator or Authy.</li>
          <li>
            In the app, add an account and scan this code.
            <div class="two-step-qr">
              {setup && <img src={setup.qrCode} alt="QR code for your authenticator app" width="180" height="180" />}
              {!setup && !setupError && <span class="btn-spinner" aria-hidden="true" />}
              {setupError && <div class="two-step-qr-error"><p role="alert">{setupError}</p><button type="button" class="back-role" onClick={loadSetup}>Try again</button></div>}
            </div>
            {setup && <div class="two-step-key">
              {showKey
                ? <code>{setup.secret}</code>
                : <button type="button" class="signup-link" onClick={() => setShowKey(true)}>Can't scan? Show the setup key</button>}
              {showKey && <button type="button" class="signup-link" onClick={copyKey}>{copied ? 'Copied' : 'Copy key'}</button>}
            </div>}
          </li>
          <li>Enter the 6-digit code the app shows.</li>
        </ol>}

        {codeForm}

        <p class="two-step-help">
          {isEnroll
            ? 'Keep this phone safe. If you lose it, the Supabase project owner can reset two-step sign-in for your account.'
            : 'Lost your phone? Ask the Supabase project owner to reset two-step sign-in for your account.'}
        </p>
        <div class="bottom-buttons"><button type="button" class="back-role" onClick={onCancel}>Cancel and sign out</button></div>
      </div>
    </div>
  </section>
}
