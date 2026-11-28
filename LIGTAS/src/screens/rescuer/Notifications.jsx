import { useEffect, useRef, useState } from 'preact/hooks'
import { Icon, timeAgo } from '../../lib/ui.jsx'

const KIND_ICON = { sos: 'sos', call: 'calls', assigned: 'user', update: 'file', alert: 'bell' }
const KIND_LABEL = { sos: 'SOS', call: 'New call', assigned: 'Assignment', update: 'Update', alert: 'Alert' }

// The bell in the header: new SOS and calls, calls given to you, changes to
// your calls and situation alerts. Unread ones are marked until opened.
export function NotificationBell({ items, readIds, onOpen, onMarkAllRead }) {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef(null)
  const buttonRef = useRef(null)
  const read = new Set(readIds)
  const unread = items.filter((item) => !read.has(item.id)).length

  useEffect(() => {
    if (!isOpen) return undefined
    const close = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'pointerdown' && (panelRef.current?.contains(event.target) || buttonRef.current?.contains(event.target))) return
      setIsOpen(false)
      if (event.type === 'keydown') buttonRef.current?.focus()
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    panelRef.current?.querySelector('button')?.focus()
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
    }
  }, [isOpen])

  return <div class="rx-bell-wrap">
    <button
      type="button"
      ref={buttonRef}
      class={`rx-icon-btn rx-bell${unread ? ' has-unread' : ''}`}
      aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      onClick={() => setIsOpen((value) => !value)}
    >
      <Icon name={unread ? 'bellRing' : 'bell'} size={19} />
      {unread > 0 && <b class="rx-bell-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</b>}
    </button>
    {isOpen && <section class="rx-inbox" ref={panelRef} role="dialog" aria-label="Notifications">
      <div class="rx-inbox-head">
        <strong>Notifications</strong>
        <button type="button" class="rx-link-button" disabled={!unread} onClick={onMarkAllRead}>Mark all as read</button>
      </div>
      {items.length === 0
        ? <p class="rx-inbox-empty"><Icon name="check" size={16} /> Nothing new. New SOS calls, assignments and alerts appear here.</p>
        : <ol class="rx-inbox-list">
          {items.slice(0, 60).map((item) => {
            const isUnread = !read.has(item.id)
            return <li key={item.id}>
              <button type="button" class={`rx-inbox-item is-${item.kind}${isUnread ? ' is-unread' : ''}${item.urgent ? ' is-urgent' : ''}`} onClick={() => { setIsOpen(false); onOpen(item) }}>
                <span class="rx-inbox-icon"><Icon name={KIND_ICON[item.kind] ?? 'bell'} size={16} /></span>
                <span class="rx-inbox-copy">
                  <small>{KIND_LABEL[item.kind]}{isUnread ? <b> · Unread</b> : ''}</small>
                  <strong>{item.title}</strong>
                  {item.detail && <span>{item.detail}</span>}
                </span>
                <time dateTime={item.at}>{timeAgo(item.at)}</time>
              </button>
            </li>
          })}
        </ol>}
    </section>}
  </div>
}
