import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { Icon } from '../lib/ui.jsx'

// A guided tour: dims the screen, highlights one button at a time and explains
// it in a card beside it. Steps come from lib/tours.js. While it runs, the app
// underneath cannot be tapped, so nothing is pressed by accident.

const TEXT = {
  en: { next: 'Next', back: 'Back', skip: 'Skip tour', done: 'Done', of: 'of', label: 'How to use LIGTAS' },
  tl: { next: 'Susunod', back: 'Bumalik', skip: 'Laktawan', done: 'Tapos na', of: 'sa', label: 'Paano gamitin ang LIGTAS' },
}
const PAD = 6
const GAP = 12
const EDGE = 12

const pick = (value, lang) => (typeof value === 'string' ? value : value?.[lang] ?? value?.en ?? '')

function findTarget(selector) {
  if (!selector) return null
  return [...document.querySelectorAll(selector)].find((element) => {
    const box = element.getBoundingClientRect()
    return box.width > 0 && box.height > 0
  }) ?? null
}

export function Tour({ steps, lang = 'en', prepare = {}, onClose }) {
  const t = TEXT[lang === 'tl' ? 'tl' : 'en']
  const [index, setIndex] = useState(0)
  // Where the highlighted button is, for the step it belongs to (box is null
  // for steps that only show a card).
  const [placed, setPlaced] = useState(null)
  const [cardStyle, setCardStyle] = useState({ visibility: 'hidden' })
  const directionRef = useRef(1)
  const targetRef = useRef(null)
  const cardRef = useRef(null)
  const nextRef = useRef(null)
  const step = steps[index]
  const isLast = index === steps.length - 1

  const go = (delta) => {
    directionRef.current = delta
    setIndex((current) => Math.min(Math.max(current + delta, 0), steps.length - 1))
  }
  const finish = () => onClose(isLast)

  // Get the screen ready, then find what to highlight. Steps whose target is
  // missing (for example, no calls in the list) are skipped.
  useEffect(() => {
    let cancelled = false
    let tries = 0
    targetRef.current = null
    prepare[step.prepare]?.()
    const locate = () => {
      if (cancelled) return
      const element = findTarget(step.target)
      if (step.target && !element && tries < 10) {
        tries += 1
        setTimeout(locate, 120)
        return
      }
      if (step.target && !element) {
        const next = index + directionRef.current
        if (next >= 0 && next < steps.length) setIndex(next)
        else setIndex(index - directionRef.current)
        return
      }
      targetRef.current = element
      // Small targets go to the middle of the screen, clear of the fixed
      // header and tab bar; big ones only as far as needed.
      if (element) {
        const isSmall = element.getBoundingClientRect().height < window.innerHeight * 0.3
        element.scrollIntoView({ block: isSmall ? 'center' : 'nearest', inline: 'nearest' })
      }
      // Let panels finish opening and scrolling before measuring.
      setTimeout(() => {
        if (cancelled) return
        setPlaced({ index, box: element ? element.getBoundingClientRect() : null })
        nextRef.current?.focus({ preventScroll: true })
      }, 260)
    }
    const timer = setTimeout(locate, step.prepare ? 220 : 40)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [index])

  // Follow the highlighted button if the layout moves (rotation, panels).
  useEffect(() => {
    const follow = () => {
      const element = targetRef.current
      if (element?.isConnected) setPlaced((current) => current && { ...current, box: element.getBoundingClientRect() })
    }
    const timer = setInterval(follow, 400)
    window.addEventListener('resize', follow)
    window.addEventListener('scroll', follow, true)
    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', follow)
      window.removeEventListener('scroll', follow, true)
    }
  }, [])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose(false)
      if (event.key === 'ArrowRight' && !isLast) go(1)
      if (event.key === 'ArrowLeft' && index > 0) go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, isLast])

  // Place the card beside a tall highlight (such as a side menu) when there is
  // room, otherwise under it or above it, or along the bottom of the screen
  // for big areas such as the map.
  const isPlaced = placed?.index === index
  const box = isPlaced ? placed.box : null
  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return
    if (!isPlaced) {
      setCardStyle({ visibility: 'hidden' })
      return
    }
    const width = window.innerWidth
    const height = window.innerHeight
    const cardWidth = Math.min(360, width - EDGE * 2)
    const cardHeight = card.offsetHeight
    if (!box) {
      setCardStyle({ width: `${cardWidth}px`, left: `${(width - cardWidth) / 2}px`, top: `${Math.max(EDGE, (height - cardHeight) / 2)}px` })
      return
    }
    if (box.height > height * 0.5) {
      const sideTop = Math.min(Math.max(box.top + box.height / 2 - cardHeight / 2, EDGE), height - cardHeight - EDGE)
      if (box.right + PAD + GAP + cardWidth <= width - EDGE) {
        setCardStyle({ width: `${cardWidth}px`, left: `${box.right + PAD + GAP}px`, top: `${sideTop}px` })
        return
      }
      if (box.left - PAD - GAP - cardWidth >= EDGE) {
        setCardStyle({ width: `${cardWidth}px`, left: `${box.left - PAD - GAP - cardWidth}px`, top: `${sideTop}px` })
        return
      }
    }
    const left = Math.min(Math.max(box.left + box.width / 2 - cardWidth / 2, EDGE), width - cardWidth - EDGE)
    const below = box.bottom + PAD + GAP
    const above = box.top - PAD - GAP - cardHeight
    let top
    if (below + cardHeight <= height - EDGE) top = below
    else if (above >= EDGE) top = above
    else top = box.top > height - box.bottom ? EDGE : height - cardHeight - EDGE
    setCardStyle({ width: `${cardWidth}px`, left: `${left}px`, top: `${top}px` })
  }, [placed, index, lang])

  const spot = box && {
    left: `${box.left - PAD}px`,
    top: `${box.top - PAD}px`,
    width: `${box.width + PAD * 2}px`,
    height: `${box.height + PAD * 2}px`,
  }

  return <div class="tour" role="presentation">
    <div class={`tour-shade${spot ? '' : ' is-full'}`} aria-hidden="true" />
    {spot && <div class="tour-spot" style={spot} aria-hidden="true" />}
    <section class="tour-card" ref={cardRef} style={cardStyle} role="dialog" aria-modal="true" aria-label={t.label} aria-describedby="tour-body">
      <div class="tour-card-head">
        <span class="tour-card-icon" aria-hidden="true"><Icon name={step.icon ?? 'info'} size={20} /></span>
        <span class="tour-count">{index + 1} {t.of} {steps.length}</span>
        {!isLast && <button type="button" class="tour-skip" onClick={() => onClose(false)}>{t.skip}</button>}
      </div>
      <h2 aria-live="polite">{pick(step.title, lang)}</h2>
      <p id="tour-body">{pick(step.body, lang)}</p>
      <div class="tour-dots" aria-hidden="true">{steps.map((_, dot) => <i key={dot} class={dot === index ? 'is-active' : dot < index ? 'is-done' : ''} />)}</div>
      <div class="tour-actions">
        {index > 0 && <button type="button" class="tour-back" onClick={() => go(-1)}>{t.back}</button>}
        <button type="button" class="tour-next" ref={nextRef} onClick={isLast ? finish : () => go(1)}>
          {isLast ? t.done : t.next}{!isLast && <Icon name="arrow" size={16} />}
        </button>
      </div>
    </section>
  </div>
}
