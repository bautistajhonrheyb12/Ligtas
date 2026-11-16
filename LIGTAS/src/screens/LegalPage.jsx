import { Fragment } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { terms } from '../content/terms.js'
import { privacy } from '../content/privacy.js'
import { hotlines, rescueHotline } from '../lib/hotlines.js'
import { useLanguage } from '../lib/i18n.js'
import { CONTACT_EMAIL, LEGAL_VERSION, privacyUrl, termsUrl } from '../lib/legal.js'
import { Icon } from '../lib/ui.jsx'

// The Terms of Use (#terms) and Privacy Policy (#privacy), in English and
// Filipino. The text lives in content/terms.js and content/privacy.js.

const DOCUMENTS = { terms, privacy }

const UI = {
  en: {
    back: 'Back',
    updated: 'Last updated {date}',
    keyTitle: 'The key points',
    onThisPage: 'On this page',
    print: 'Print or save as PDF',
    top: 'Back to top',
    terms: 'Terms of Use',
    privacy: 'Privacy Policy',
    npc: 'National Privacy Commission',
    next: 'Next, read the {doc}',
    hotlines: 'Santa Maria emergency hotlines',
    columns: ['What', 'Details', 'When', 'Why'],
    keepColumns: ['Information', 'How long'],
    providerLink: 'Their privacy policy',
    languages: 'Language',
    translation: '',
  },
  tl: {
    back: 'Bumalik',
    updated: 'Huling binago noong {date}',
    keyTitle: 'Ang mahahalagang punto',
    onThisPage: 'Sa pahinang ito',
    print: 'I-print o i-save bilang PDF',
    top: 'Bumalik sa itaas',
    terms: 'Mga Tuntunin ng Paggamit',
    privacy: 'Patakaran sa Privacy',
    npc: 'National Privacy Commission',
    next: 'Susunod, basahin ang {doc}',
    hotlines: 'Mga emergency hotline ng Santa Maria',
    columns: ['Ano', 'Detalye', 'Kailan', 'Bakit'],
    keepColumns: ['Impormasyon', 'Gaano katagal'],
    providerLink: 'Patakaran nila sa privacy',
    languages: 'Wika',
    translation: 'Ito ay salin sa Filipino. Kung magkaiba ang bersyong Ingles at Filipino, ang bersyong Ingles ang susundin.',
  },
}

const fill = (text, values) => text.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match)

// Text with **bold** and {placeholders} for links.
function Rich({ text, links }) {
  return text.split(/(\*\*[^*]+\*\*|\{[a-z]+\})/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <b key={index}>{part.slice(2, -2)}</b>
    const token = part.match(/^\{([a-z]+)\}$/)?.[1]
    if (token && links[token]) return <Fragment key={index}>{links[token]}</Fragment>
    return part
  })
}

function Block({ block, links, ui }) {
  const rich = (text) => <Rich text={text} links={links} />
  if (block.p) return <p>{rich(block.p)}</p>
  if (block.note) return <p class="legal-note">{rich(block.note)}</p>
  if (block.callout) {
    return <p class={`legal-callout legal-callout--${block.tone ?? 'info'}`}>
      <Icon name={block.tone === 'danger' ? 'phone' : 'shield'} size={18} /><span>{rich(block.callout)}</span>
    </p>
  }
  if (block.list) {
    return <ul class="legal-list">
      {block.list.map((item, index) => <li key={index}>
        {Array.isArray(item) ? <><b>{item[0]}:</b> {rich(item[1])}</> : rich(item)}
      </li>)}
    </ul>
  }
  if (block.hotlines) {
    return <div class="legal-hotlines">
      <strong>{ui.hotlines}</strong>
      <ul>
        {hotlines.map((line) => <li key={line.number}><span>{line.name}</span><a href={`tel:${line.number}`}><Icon name="phone" size={13} /> {line.display}</a></li>)}
      </ul>
    </div>
  }
  if (block.collected) {
    return <div class="legal-table" role="table">
      <div class="legal-row legal-row--head" role="row">{ui.columns.map((column) => <span role="columnheader" key={column}>{column}</span>)}</div>
      {block.collected.map(([what, details, when, why]) => <div class="legal-row" role="row" key={what}>
        <b role="cell">{what}</b>
        <span role="cell">{details}</span>
        <span role="cell"><i>{ui.columns[2]}: </i>{when}</span>
        <span role="cell"><i>{ui.columns[3]}: </i>{why}</span>
      </div>)}
    </div>
  }
  if (block.retention) {
    return <div class="legal-table legal-table--two" role="table">
      <div class="legal-row legal-row--head" role="row">{ui.keepColumns.map((column) => <span role="columnheader" key={column}>{column}</span>)}</div>
      {block.retention.map(([what, howLong]) => <div class="legal-row" role="row" key={what}><b role="cell">{what}</b><span role="cell">{howLong}</span></div>)}
    </div>
  }
  if (block.who) {
    return <dl class="legal-who">
      {block.who.map(([who, what]) => <div key={who}><dt>{who}</dt><dd>{what}</dd></div>)}
    </dl>
  }
  if (block.providers) {
    return <ul class="legal-providers">
      {block.providers.map(([name, what, url]) => <li key={name}>
        <b>{name}</b>
        <span>{what}</span>
        <a href={url} target="_blank" rel="noreferrer">{ui.providerLink} <Icon name="arrow" size={13} /></a>
      </li>)}
    </ul>
  }
  return null
}

export function LegalPage({ doc, onBack }) {
  const { lang, setLang } = useLanguage()
  const ui = UI[lang] ?? UI.en
  const content = DOCUMENTS[doc][lang] ?? DOCUMENTS[doc].en
  const other = doc === 'terms' ? 'privacy' : 'terms'
  const [active, setActive] = useState(content.sections[0].id)
  const [isContentsOpen, setIsContentsOpen] = useState(false)
  const bodyRef = useRef(null)

  const date = new Date(`${LEGAL_VERSION}T00:00:00`).toLocaleDateString(lang === 'tl' ? 'fil-PH' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const links = {
    email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>,
    rescue: <a href={`tel:${rescueHotline.number}`}>{rescueHotline.name} ({rescueHotline.display})</a>,
    privacy: <a href={privacyUrl}>{ui.privacy}</a>,
    terms: <a href={termsUrl}>{ui.terms}</a>,
    npc: <a href="https://privacy.gov.ph" target="_blank" rel="noreferrer">{ui.npc}</a>,
  }

  useEffect(() => {
    window.scrollTo(0, 0)
    setActive(content.sections[0].id)
  }, [doc])

  useEffect(() => {
    const previous = document.title
    document.title = `${content.title} · LIGTAS`
    return () => { document.title = previous }
  }, [doc, lang])

  // Highlights the section being read in the contents list.
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (visible) setActive(visible.target.id.replace('legal-', ''))
    }, { rootMargin: '-15% 0px -70% 0px' })
    bodyRef.current?.querySelectorAll('.legal-section').forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [doc, lang])

  const goTo = (id) => {
    setIsContentsOpen(false)
    document.getElementById(`legal-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return <article class="legal-page" lang={lang === 'tl' ? 'fil' : 'en'}>
    <header class="legal-hero">
      <div class="legal-topline">
        <button type="button" class="legal-back" onClick={onBack}><Icon name="arrow" size={16} /> {ui.back}</button>
        <div class="legal-tools">
          <div class="legal-lang" role="group" aria-label={ui.languages}>
            <button type="button" aria-pressed={lang === 'en'} class={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>English</button>
            <button type="button" aria-pressed={lang === 'tl'} class={lang === 'tl' ? 'is-active' : ''} onClick={() => setLang('tl')}>Filipino</button>
          </div>
          <button type="button" class="legal-print" onClick={() => window.print()} title={ui.print} aria-label={ui.print}><Icon name="download" size={16} /><span>{ui.print}</span></button>
        </div>
      </div>
      <span class="about-eyebrow">LIGTAS</span>
      <h1>{content.title}</h1>
      <p class="legal-meta">{fill(ui.updated, { date })}</p>
      <nav class="legal-switch" aria-label={`${ui.terms} / ${ui.privacy}`}>
        <a href={termsUrl} aria-current={doc === 'terms' ? 'page' : undefined}>{ui.terms}</a>
        <a href={privacyUrl} aria-current={doc === 'privacy' ? 'page' : undefined}>{ui.privacy}</a>
      </nav>
    </header>

    <div class="legal-layout">
      <nav class={`legal-toc${isContentsOpen ? ' is-open' : ''}`} aria-label={ui.onThisPage}>
        <button type="button" class="legal-toc-toggle" aria-expanded={isContentsOpen} onClick={() => setIsContentsOpen((open) => !open)}>
          <Icon name="list" size={16} /> {ui.onThisPage}
        </button>
        <ol>
          {content.sections.map((section, index) => <li key={section.id}>
            <button type="button" class={active === section.id ? 'is-active' : ''} aria-current={active === section.id ? 'location' : undefined} onClick={() => goTo(section.id)}>
              <span>{index + 1}</span>{section.title}
            </button>
          </li>)}
        </ol>
      </nav>

      <div class="legal-body" ref={bodyRef}>
        {ui.translation && <p class="legal-translation"><Icon name="globe" size={15} /> {ui.translation}</p>}
        <p class="legal-lead"><Rich text={content.intro} links={links} /></p>

        <section class="legal-keypoints" aria-labelledby="legal-key-title">
          <h2 id="legal-key-title">{ui.keyTitle}</h2>
          <ul>
            {content.keyPoints.map(([icon, text]) => <li key={icon}>
              <span class="legal-key-icon"><Icon name={icon} size={18} /></span>
              <span><Rich text={text} links={links} /></span>
            </li>)}
          </ul>
        </section>

        {content.sections.map((section, index) => <section class="legal-section" id={`legal-${section.id}`} key={section.id} aria-labelledby={`legal-${section.id}-title`}>
          <h2 id={`legal-${section.id}-title`}><span>{index + 1}</span>{section.title}</h2>
          {section.blocks.map((block, blockIndex) => <Block key={blockIndex} block={block} links={links} ui={ui} />)}
        </section>)}

        <footer class="legal-end">
          <a class="legal-next" href={other === 'terms' ? termsUrl : privacyUrl}>
            <span>{fill(ui.next, { doc: ui[other] })}</span><Icon name="arrow" size={18} />
          </a>
          <button type="button" class="legal-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>{ui.top} ↑</button>
        </footer>
      </div>
    </div>
  </article>
}
