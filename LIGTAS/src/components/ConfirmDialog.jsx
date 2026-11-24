import { useEffect, useRef, useState } from 'preact/hooks'
import { Icon } from '../lib/ui.jsx'
import { Portal } from './Portal.jsx'

// A confirmation box for actions that are hard to undo (rejecting, deleting,
// signing someone out). Cancel has the focus, Escape or a tap outside cancels,
// and the confirm button ignores taps for a moment after opening, so a
// double-click on the original button cannot confirm by accident.
const ARMING_MS = 450
const OTHER = '__other__'

function ConfirmDialog({ title, message, details, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'danger', icon, reasons, reasonLabel = 'Reason', otherLabel = 'Other reason', otherPlaceholder = 'Type the reason', onCancel, onConfirm }) {
  const [isArmed, setIsArmed] = useState(false)
  const [reason, setReason] = useState(reasons?.[0] ?? '')
  const [other, setOther] = useState('')
  const cancelRef = useRef(null)
  const chosen = reason === OTHER ? other.trim() : reason
  const canConfirm = isArmed && (!reasons || chosen.length >= 3)

  useEffect(() => {
    cancelRef.current?.focus()
    const timer = setTimeout(() => setIsArmed(true), ARMING_MS)
    const onKey = (event) => { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return <Portal><div class="alert-modal-backdrop confirm-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onCancel() }}>
    <section class={`alert-modal confirm-dialog confirm-dialog--${tone}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <span class="confirm-icon" aria-hidden="true"><Icon name={icon ?? (tone === 'danger' ? 'alert' : 'check')} size={22} /></span>
      <h2 id="confirm-title">{title}</h2>
      {message && <p id="confirm-message">{message}</p>}
      {details && <p class="confirm-details">{details}</p>}
      {reasons && <div class="confirm-reason">
        <label>
          <span>{reasonLabel}</span>
          <select value={reason} onChange={(event) => setReason(event.currentTarget.value)}>
            {reasons.map((item) => <option key={item} value={item}>{item}</option>)}
            <option value={OTHER}>{otherLabel}</option>
          </select>
        </label>
        {reason === OTHER && <input value={other} maxLength="300" placeholder={otherPlaceholder} aria-label={otherLabel} onInput={(event) => setOther(event.currentTarget.value)} />}
      </div>}
      <div class="confirm-actions">
        <button type="button" class="confirm-cancel" ref={cancelRef} onClick={onCancel}>{cancelLabel}</button>
        <button type="button" class="confirm-ok" disabled={!canConfirm} onClick={() => onConfirm(reasons ? chosen : true)}>{confirmLabel}</button>
      </div>
    </section>
  </div></Portal>
}

// const [confirm, confirmDialog] = useConfirm()
// const answer = await confirm({ title, message, confirmLabel, tone, reasons })
// answer is false when cancelled, true when confirmed, or the chosen reason
// when `reasons` is given. Render {confirmDialog} somewhere in the screen.
export function useConfirm() {
  const [request, setRequest] = useState(null)
  const confirm = (options) => new Promise((resolve) => setRequest({ ...options, resolve }))
  const finish = (answer) => {
    request?.resolve(answer)
    setRequest(null)
  }
  const dialog = request && <ConfirmDialog {...request} onCancel={() => finish(false)} onConfirm={finish} />
  return [confirm, dialog]
}

// A button that asks first. `ask` holds the confirmation's options.
export function ConfirmAction({ class: className, ask, onConfirm, disabled, children, label }) {
  const [confirm, dialog] = useConfirm()
  const [isBusy, setIsBusy] = useState(false)
  const press = async () => {
    const answer = await confirm(ask)
    if (!answer) return
    setIsBusy(true)
    try {
      await onConfirm(answer)
    } finally {
      setIsBusy(false)
    }
  }
  return <>
    <button type="button" class={className} disabled={disabled || isBusy} onClick={press} aria-label={label}>
      {isBusy ? <span class="btn-spinner" aria-hidden="true" /> : children}
    </button>
    {dialog}
  </>
}
