import { createPortal } from 'preact/compat'

// Draws its children at the end of the page body instead of where they are
// written. Pop-up windows (confirmations, forms, install steps) use it, so a
// panel they are opened from can never trap, clip or cover them: a transform,
// an overflow rule or a stacking order on any parent no longer applies.
export function Portal({ children }) {
  return typeof document === 'undefined' ? children : createPortal(children, document.body)
}
