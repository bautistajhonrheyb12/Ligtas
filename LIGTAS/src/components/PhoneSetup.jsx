import { useEffect, useRef, useState } from 'preact/hooks'
import { Icon } from '../lib/ui.jsx'
import { promptInstall, useInstallMode } from '../lib/install.js'
import { disablePush, enablePush, sendTestPush, usePush } from '../lib/push.js'

// "This phone": installing LIGTAS and turning on notifications that arrive
// even when it is closed. Citizens see it in English or Filipino; staff
// screens are in English.

const TEXT = {
  en: {
    installTitle: 'Install LIGTAS',
    installText: 'Open it from your home screen like an app: full screen, and it works without signal.',
    installButton: 'Install app',
    installed: 'Installed on this phone.',
    stepsTitle: 'Add LIGTAS to your home screen',
    iosSteps: [
      ['share', 'Tap the Share button at the bottom of Safari (at the top on iPad).'],
      ['addToHome', 'Scroll down and tap Add to Home Screen.'],
      ['check', 'Tap Add, then open LIGTAS from your Home Screen.'],
    ],
    iosNote: 'Opened this from Facebook or Messenger? Open the page in Safari first.',
    androidSteps: [
      ['menuDots', 'Tap the menu (⋮) at the top right of your browser.'],
      ['addToHome', 'Tap Install app or Add to Home screen.'],
      ['check', 'Tap Install. LIGTAS appears on your home screen.'],
    ],
    gotIt: 'Got it',
    close: 'Close',
    notifyTitle: 'Notifications',
    notifyOn: 'On for this phone. Alerts arrive even when LIGTAS is closed.',
    notifyOff: 'Get alerts on this phone even when LIGTAS is closed.',
    notifyBlocked: 'Notifications are blocked for LIGTAS. Allow them in your browser\'s site settings (the icon beside the address). If LIGTAS is installed, use your phone\'s Settings → Apps → LIGTAS → Notifications. Then come back here.',
    notifyInstallFirst: 'On iPhone, notifications work once LIGTAS is on your Home Screen. Install it, open it from the Home Screen, then turn notifications on here.',
    notifyUnsupported: 'This browser cannot show notifications. Use Chrome on Android, or Safari on iPhone (iOS 16.4 or newer).',
    turnOn: 'Turn on',
    turnOff: 'Turn off',
    test: 'Send a test',
    testSent: 'Test sent. It should arrive in a few seconds.',
    testNone: 'No test was sent. Wait a minute, or turn notifications off and on, then try again.',
    showSteps: 'Show me how',
    promptTitle: 'Get alerts even when LIGTAS is closed',
    promptInstallTitle: 'Install LIGTAS to get alerts when it is closed',
    later: 'Not now',
    gets: {
      citizen: 'Alerts for your barangay, and updates on your reports and SOS.',
      rescuer: 'New SOS calls, new calls, calls assigned to your team, and alerts.',
      admin: 'SOS calls, new reports to review, returned calls, and alerts.',
    },
  },
  tl: {
    installTitle: 'I-install ang LIGTAS',
    installText: 'Buksan ito mula sa home screen na parang app: buong screen, at gumagana kahit walang signal.',
    installButton: 'I-install',
    installed: 'Naka-install na sa teleponong ito.',
    stepsTitle: 'Idagdag ang LIGTAS sa home screen',
    iosSteps: [
      ['share', 'Pindutin ang Share sa ibaba ng Safari (sa itaas kung iPad).'],
      ['addToHome', 'Mag-scroll pababa at pindutin ang Add to Home Screen.'],
      ['check', 'Pindutin ang Add, saka buksan ang LIGTAS mula sa Home Screen.'],
    ],
    iosNote: 'Binuksan mo ba ito mula sa Facebook o Messenger? Buksan muna ang page sa Safari.',
    androidSteps: [
      ['menuDots', 'Pindutin ang menu (⋮) sa kanang itaas ng browser.'],
      ['addToHome', 'Pindutin ang Install app o Add to Home screen.'],
      ['check', 'Pindutin ang Install. Lalabas ang LIGTAS sa home screen mo.'],
    ],
    gotIt: 'Sige',
    close: 'Isara',
    notifyTitle: 'Mga notification',
    notifyOn: 'Bukas sa teleponong ito. Darating ang mga alerto kahit nakasara ang LIGTAS.',
    notifyOff: 'Makatanggap ng mga alerto sa teleponong ito kahit nakasara ang LIGTAS.',
    notifyBlocked: 'Naka-block ang mga notification para sa LIGTAS. Payagan ito sa site settings ng browser (ang icon sa tabi ng address). Kung naka-install ang LIGTAS, pumunta sa Settings → Apps → LIGTAS → Notifications ng telepono. Saka bumalik dito.',
    notifyInstallFirst: 'Sa iPhone, gumagana ang notifications kapag nasa Home Screen na ang LIGTAS. I-install ito, buksan mula sa Home Screen, saka buksan dito ang notifications.',
    notifyUnsupported: 'Hindi kaya ng browser na ito ang notifications. Gamitin ang Chrome sa Android, o Safari sa iPhone (iOS 16.4 o mas bago).',
    turnOn: 'Buksan',
    turnOff: 'Isara',
    test: 'Subukan',
    testSent: 'Naipadala ang test. Darating ito sa loob ng ilang segundo.',
    testNone: 'Walang naipadalang test. Maghintay ng isang minuto, o isara at buksan ulit ang notifications, saka subukan.',
    showSteps: 'Paano?',
    promptTitle: 'Makatanggap ng alerto kahit nakasara ang LIGTAS',
    promptInstallTitle: 'I-install ang LIGTAS para makatanggap ng alerto kahit nakasara',
    later: 'Mamaya na',
    gets: {
      citizen: 'Mga alerto para sa barangay mo, at mga update sa mga ulat at SOS mo.',
      rescuer: 'Mga bagong SOS, bagong tawag, tawag na naka-assign sa team mo, at mga alerto.',
      admin: 'Mga SOS, bagong ulat na susuriin, ibinalik na tawag, at mga alerto.',
    },
  },
}

const text = (lang) => TEXT[lang === 'tl' ? 'tl' : 'en']

export function InstallSteps({ mode, lang, onClose }) {
  const t = text(lang)
  const closeRef = useRef(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const steps = mode === 'ios' ? t.iosSteps : t.androidSteps
  return <div class="alert-modal-backdrop phone-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section class="alert-modal install-steps" role="dialog" aria-modal="true" aria-labelledby="install-steps-title">
      <div class="alert-modal-heading">
        <h2 id="install-steps-title">{t.stepsTitle}</h2>
        <button type="button" class="alert-modal-close" onClick={onClose} aria-label={t.close}>×</button>
      </div>
      <ol>
        {steps.map(([icon, step]) => <li key={step}><span class="install-step-icon" aria-hidden="true"><Icon name={icon} size={18} /></span><span>{step}</span></li>)}
      </ol>
      {mode === 'ios' && <p class="install-steps-note">{t.iosNote}</p>}
      <button type="button" class="install-steps-done" ref={closeRef} onClick={onClose}>{t.gotIt}</button>
    </section>
  </div>
}

// One tap where the browser allows it, otherwise the steps.
function useInstall(lang) {
  const mode = useInstallMode()
  const [showSteps, setShowSteps] = useState(false)
  const install = () => {
    if (mode === 'prompt') promptInstall()
    else setShowSteps(true)
  }
  const steps = showSteps && <InstallSteps mode={mode === 'ios' ? 'ios' : 'android'} lang={lang} onClose={() => setShowSteps(false)} />
  return { mode, install, steps, canInstall: mode === 'prompt' || mode === 'ios' || mode === 'android' }
}

export function InstallButton({ lang = 'en', class: className = '', label }) {
  const { install, steps, canInstall } = useInstall(lang)
  if (!canInstall) return null
  return <>
    <button type="button" class={`install-button ${className}`} onClick={install}><Icon name="download" size={17} /> {label ?? text(lang).installButton}</button>
    {steps}
  </>
}

// The card on the settings screens: notifications, then installing.
export function PhoneSettings({ role, lang = 'en' }) {
  const t = text(lang)
  const push = usePush()
  const install = useInstall(lang)
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState({ text: '', isError: false })
  const [testWait, setTestWait] = useState(false)

  const run = async (name, action) => {
    setBusy(name)
    setNote({ text: '', isError: false })
    try {
      await action()
    } catch (error) {
      setNote({ text: error.message, isError: true })
    } finally {
      setBusy('')
    }
  }
  const test = () => run('test', async () => {
    const sent = await sendTestPush()
    setNote({ text: sent > 0 ? t.testSent : t.testNone, isError: sent === 0 })
    setTestWait(true)
    setTimeout(() => setTestWait(false), 60000)
  })

  const status = push.status
  const message = { on: t.notifyOn, off: t.notifyOff, blocked: t.notifyBlocked, 'install-first': t.notifyInstallFirst, unsupported: t.notifyUnsupported }[status]
  return <div class="phone-settings">
    <div class={`phone-row phone-notify is-${status}`}>
      <span class="phone-row-icon" aria-hidden="true"><Icon name={status === 'on' ? 'bellRing' : status === 'blocked' ? 'bellOff' : 'bell'} size={20} /></span>
      <div class="phone-row-text">
        <strong>{t.notifyTitle}{status === 'on' && <em class="phone-on-badge">{lang === 'tl' ? 'Bukas' : 'On'}</em>}</strong>
        {message && <p>{message}</p>}
        {(status === 'on' || status === 'off') && <small>{t.gets[role] ?? t.gets.citizen}</small>}
        <div class="phone-row-actions">
          {status === 'off' && <button type="button" class="phone-primary" onClick={() => run('on', () => enablePush(lang))} disabled={Boolean(busy)}>
            {busy === 'on' ? <span class="btn-spinner" aria-hidden="true" /> : <Icon name="bell" size={16} />} {t.turnOn}
          </button>}
          {status === 'on' && <>
            <button type="button" class="phone-secondary" onClick={test} disabled={Boolean(busy) || testWait}>
              {busy === 'test' ? <span class="btn-spinner" aria-hidden="true" /> : <Icon name="send" size={15} />} {t.test}
            </button>
            <button type="button" class="phone-quiet" onClick={() => run('off', disablePush)} disabled={Boolean(busy)}>
              {busy === 'off' && <span class="btn-spinner" aria-hidden="true" />} {t.turnOff}
            </button>
          </>}
          {status === 'install-first' && install.canInstall && <button type="button" class="phone-primary" onClick={install.install}><Icon name="download" size={16} /> {t.showSteps}</button>}
        </div>
        {note.text && <p class={`phone-note${note.isError ? ' is-error' : ''}`} role={note.isError ? 'alert' : 'status'}>{note.text}</p>}
      </div>
    </div>
    {install.mode !== 'none' && status !== 'install-first' && <div class="phone-row">
      <span class="phone-row-icon" aria-hidden="true"><Icon name="phoneApp" size={20} /></span>
      <div class="phone-row-text">
        <strong>{t.installTitle}</strong>
        <p>{install.mode === 'installed' ? t.installed : t.installText}</p>
        {install.canInstall && <div class="phone-row-actions"><button type="button" class="phone-secondary" onClick={install.install}><Icon name="download" size={16} /> {t.installButton}</button></div>}
      </div>
    </div>}
    {install.steps}
  </div>
}

const LATER_KEY = 'ligtas-push-prompt-later'
const LATER_MS = 3 * 24 * 3600 * 1000

function askedRecently() {
  try {
    return Date.now() - Number(localStorage.getItem(LATER_KEY) || 0) < LATER_MS
  } catch {
    return false
  }
}

// A slim banner on the dashboard until notifications are on (or the person
// says "not now", which hides it for three days).
export function NotificationPrompt({ role, lang = 'en' }) {
  const t = text(lang)
  const push = usePush()
  const install = useInstall(lang)
  const [hidden, setHidden] = useState(askedRecently)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const show = !hidden && (push.status === 'off' || (push.status === 'install-first' && install.canInstall))
  if (!show) return install.steps || null

  const later = () => {
    try {
      localStorage.setItem(LATER_KEY, String(Date.now()))
    } catch {
      // Hidden for this visit only.
    }
    setHidden(true)
  }
  const turnOn = async () => {
    setBusy(true)
    setError('')
    try {
      await enablePush(lang)
    } catch (enableError) {
      setError(enableError.message)
    } finally {
      setBusy(false)
    }
  }
  const needsInstall = push.status === 'install-first'
  return <div class="notify-prompt" role="region" aria-label={t.notifyTitle}>
    <span class="notify-prompt-icon" aria-hidden="true"><Icon name="bellRing" size={20} /></span>
    <div class="notify-prompt-text">
      <strong>{needsInstall ? t.promptInstallTitle : t.promptTitle}</strong>
      <small>{error || (t.gets[role] ?? t.gets.citizen)}</small>
    </div>
    <div class="notify-prompt-actions">
      <button type="button" class="phone-primary" onClick={needsInstall ? install.install : turnOn} disabled={busy}>
        {busy ? <span class="btn-spinner" aria-hidden="true" /> : null}{needsInstall ? t.showSteps : t.turnOn}
      </button>
      <button type="button" class="phone-quiet" onClick={later}>{t.later}</button>
    </div>
    {install.steps}
  </div>
}

// For rescuers and admins: the same settings in a window, opened from the header.
export function PhoneSettingsDialog({ role, onClose }) {
  const closeRef = useRef(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return <div class="alert-modal-backdrop phone-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section class="alert-modal phone-dialog" role="dialog" aria-modal="true" aria-labelledby="phone-dialog-title">
      <div class="alert-modal-heading">
        <h2 id="phone-dialog-title">This phone</h2>
        <button type="button" class="alert-modal-close" ref={closeRef} onClick={onClose} aria-label="Close">×</button>
      </div>
      <PhoneSettings role={role} lang="en" />
    </section>
  </div>
}
