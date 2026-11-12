import { Icon, Logo } from '../lib/ui.jsx'

const TEAM = [
  { name: 'Gabriel Santos', role: 'Project Manager', title: 'Co-founder', photo: '/team/gabriel-santos.jpg' },
  { name: 'Jhon Rhey Bautista', role: 'Backend & Frontend Developer', title: 'Founder', photo: '/team/jhon-rhey-bautista.jpg' },
  { name: 'Cedric James Resurreccion', role: 'Quality Assurance', title: 'Co-founder', photo: '/team/cedric-james-resurreccion.jpg' },
  { name: 'Carlo Resurreccion', role: 'Data Analyst', title: 'Co-founder', photo: '/team/carlo-resurreccion.jpg' },
]

const AUDIENCES = [
  {
    icon: 'users',
    title: 'For residents',
    points: [
      'See danger zones, closed roads and open evacuation centers on a map of Santa Maria',
      'Get alerts meant for your barangay',
      'Report flooding, fallen trees and other incidents with a photo and location',
      'Send an SOS that goes straight to rescuers, or mark yourself safe',
    ],
  },
  {
    icon: 'navigate',
    title: 'For rescuers',
    points: [
      'A live queue of verified calls, most urgent first',
      'Take a call, get directions and update your progress',
      'Call the reporter back with one tap',
      'Share your location with the operations team while on duty',
    ],
  },
  {
    icon: 'shield',
    title: 'For the operations team',
    points: [
      'Review and verify incoming reports',
      'Send alerts to the whole town or to chosen barangays',
      'Manage evacuation centers, hazard points and rescue teams',
      'Follow trends with response analytics',
    ],
  },
]

const SAFEGUARDS = [
  { title: 'Every report is checked', text: 'A report must come from inside Santa Maria and from a believable position. Repeated problems flag the account for review.' },
  { title: 'Reports cannot be quietly changed', text: 'Each report is signed when it is sent, so any change made outside the app is caught and shown to staff.' },
  { title: 'Staff accounts are protected', text: 'Admins sign in with a code from an authenticator app, and a stolen session can be ended instantly.' },
  { title: 'Your details stay with responders', text: 'Your phone number is shown only to rescuers and the operations team, so they can call you back.' },
]

// The public "About us" page: what LIGTAS is, who it serves, and the team.
export function AboutPage({ onGetStarted }) {
  return <div class="about-page">
    <section class="about-hero" data-reveal>
      <span class="about-eyebrow">About us</span>
      <h1>Built in Santa Maria,<br />for Santa Maria.</h1>
      <p>
        <b>LIGTAS</b>, the <b>Localized Informative Geographic Tagging &amp; Safety Mapping System</b>, brings
        hazard maps, verified alerts, incident reports and rescue coordination into one place. Residents,
        rescuers and the municipal operations team all see the same picture when it matters most.
      </p>
      <p class="about-name-note"><i>Ligtas</i> is also the Filipino word for <i>safe</i>.</p>
    </section>

    <section class="about-section" aria-labelledby="about-what">
      <div class="about-section-heading" data-reveal>
        <span class="about-eyebrow">What it does</span>
        <h2 id="about-what">One system for everyone in a disaster</h2>
      </div>
      <div class="about-audiences">
        {AUDIENCES.map((audience) => <article class="about-card" key={audience.title} data-reveal>
          <span class="about-card-icon"><Icon name={audience.icon} size={22} /></span>
          <h3>{audience.title}</h3>
          <ul>{audience.points.map((point) => <li key={point}><Icon name="check" size={14} />{point}</li>)}</ul>
        </article>)}
      </div>
    </section>

    <section class="about-section about-trust" aria-labelledby="about-trust">
      <div class="about-section-heading" data-reveal>
        <span class="about-eyebrow">Built to be trusted</span>
        <h2 id="about-trust">Information people can act on</h2>
        <p>During a disaster, a false report can send rescuers to the wrong place. LIGTAS is designed so the information on the map can be relied on.</p>
      </div>
      <div class="about-safeguards">
        {SAFEGUARDS.map((item) => <article key={item.title} data-reveal>
          <h3><Icon name="shield" size={16} /> {item.title}</h3>
          <p>{item.text}</p>
        </article>)}
      </div>
    </section>

    <section class="about-section" aria-labelledby="about-team">
      <div class="about-section-heading" data-reveal>
        <span class="about-eyebrow">The team</span>
        <h2 id="about-team">The people behind LIGTAS</h2>
      </div>
      <div class="about-team">
        {TEAM.map((person) => <article class="about-person" key={person.name} data-reveal>
          <div class="about-photo"><img src={person.photo} alt={`Photo of ${person.name}`} loading="lazy" width="240" height="240" /></div>
          <span class={`about-title${person.title === 'Founder' ? ' is-founder' : ''}`}>{person.title}</span>
          <h3>{person.name}</h3>
          <p>{person.role}</p>
        </article>)}
      </div>
    </section>

    <section class="about-cta" data-reveal>
      <Logo />
      <div>
        <h2>Stay ready with LIGTAS</h2>
        <p>Create a free account to see your barangay's hazards and alerts. In an emergency, call <a href="tel:911">911</a>.</p>
      </div>
      <button type="button" class="primary" onClick={onGetStarted}>Get started <b>→</b></button>
    </section>
  </div>
}
