import { Icon, Logo } from '../lib/ui.jsx'

// The Founder first, then the Co-founders.
const TEAM = [
  { name: 'Jhon Rhey Bautista', role: 'Backend & Frontend Developer', title: 'Founder', photo: '/team/jhon-rhey-bautista.jpg' },
  { name: 'Gabriel Santos', role: 'Project Manager', title: 'Co-founder', photo: '/team/gabriel-santos.jpg' },
  { name: 'Cedric James Resurreccion', role: 'Quality Assurance', title: 'Co-founder', photo: '/team/cedric-james-resurreccion.jpg' },
  { name: 'John Carlo Resurreccion', role: 'Data Analyst', title: 'Co-founder', photo: '/team/john-carlo-resurreccion.jpg' },
]

// The problems LIGTAS was built to address, and what it does about each.
const PROBLEMS = [
  {
    icon: 'bell',
    title: 'Warnings are scattered',
    problem: 'Advisories spread through posts, group chats and word of mouth, and can arrive late, incomplete or wrong.',
    answer: 'Verified alerts go to the barangays they concern, straight to residents’ phones, even when LIGTAS is closed.',
  },
  {
    icon: 'map',
    title: 'No one sees the whole picture',
    problem: 'Danger zones, closed roads and open evacuation centers are hard to find in one place.',
    answer: 'One up-to-date map of Santa Maria is shared by residents, rescuers and the operations team.',
  },
  {
    icon: 'sos',
    title: 'Calls for help get lost',
    problem: 'Requests arrive through many channels, and the most urgent ones can wait too long.',
    answer: 'Reports and SOS calls arrive in one queue, are checked, and reach rescue teams most urgent first.',
  },
  {
    icon: 'wifiOff',
    title: 'Signal fails when it matters',
    problem: 'Mobile networks are often weakest during the worst of a storm.',
    answer: 'Alerts, evacuation centers and hotlines stay on the phone, and reports are sent once the signal returns.',
  },
]

const STAGES = [
  {
    title: 'Before a disaster',
    points: [
      'Know the danger zones and evacuation centers near you',
      'Pack a go-bag with the checklist, and read flood, typhoon and earthquake safety tips',
      'Link your family, and register household members who need priority rescue',
    ],
  },
  {
    title: 'During a disaster',
    points: [
      'Receive the alerts meant for your barangay',
      'Send an SOS, or tell responders and your family that you are safe',
      'Get directions to the nearest safe evacuation center, around danger zones',
    ],
  },
  {
    title: 'After a disaster',
    points: [
      'Report flooding, fallen trees, blocked roads and power outages',
      'Follow what happens to the reports you sent',
      'See which centers are open and how much space is left',
    ],
  },
]

const AUDIENCES = [
  {
    icon: 'users',
    title: 'Residents',
    points: [
      'See hazards, closed roads and open evacuation centers',
      'Get alerts meant for their barangay',
      'Report incidents with a photo and location',
      'Send an SOS, or mark themselves safe',
    ],
  },
  {
    icon: 'navigate',
    title: 'Rescuers',
    points: [
      'A live queue of verified calls, most urgent first',
      'Directions that avoid reported hazards',
      'Call the person back with one tap',
      'Share their location while on duty',
    ],
  },
  {
    icon: 'shield',
    title: 'The operations team',
    points: [
      'Review and verify incoming reports',
      'Send alerts to the whole town or chosen barangays',
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

// The public "About us" page: why LIGTAS exists, what it does for residents,
// how it connects the community, and the team behind it.
export function AboutPage({ onGetStarted }) {
  return <div class="about-page">
    <section class="about-hero" data-reveal>
      <span class="about-eyebrow">About us</span>
      <h1>A safer Santa Maria starts <span class="about-hero-break">with being prepared.</span></h1>
      <p>
        <b>LIGTAS</b>, the <b>Localized Informative Geographic Tagging &amp; Safety Mapping System</b>, is a disaster
        preparedness and response system built for Santa Maria, Bulacan. Its purpose is to give residents, rescuers
        and the municipal operations team the same accurate, up-to-date picture before, during and after a disaster.
      </p>
    </section>

    <section class="about-section" aria-labelledby="about-why">
      <div class="about-section-heading" data-reveal>
        <span class="about-eyebrow">Why LIGTAS</span>
        <h2 id="about-why">The problems it sets out to solve</h2>
        <p>In a typhoon or flood, the hardest part is often not knowing what is happening, where it is safe, and who needs help first.</p>
      </div>
      <div class="about-problems">
        {PROBLEMS.map((item) => <article class="about-problem" key={item.title} data-reveal>
          <span class="about-card-icon"><Icon name={item.icon} size={22} /></span>
          <h3>{item.title}</h3>
          <p>{item.problem}</p>
          <p class="about-answer"><Icon name="check" size={15} /><span>{item.answer}</span></p>
        </article>)}
      </div>
    </section>

    <section class="about-section about-stages-section" aria-labelledby="about-prepared">
      <div class="about-section-heading" data-reveal>
        <span class="about-eyebrow">Staying prepared</span>
        <h2 id="about-prepared">How LIGTAS helps residents</h2>
      </div>
      <ol class="about-stages">
        {STAGES.map((stage, index) => <li class="about-stage" key={stage.title} data-reveal>
          <span class="about-stage-number">{String(index + 1).padStart(2, '0')}</span>
          <h3>{stage.title}</h3>
          <ul>{stage.points.map((point) => <li key={point}><Icon name="check" size={14} />{point}</li>)}</ul>
        </li>)}
      </ol>
    </section>

    <section class="about-section" aria-labelledby="about-community">
      <div class="about-section-heading" data-reveal>
        <span class="about-eyebrow">Connecting the community</span>
        <h2 id="about-community">One shared picture for everyone</h2>
        <p>LIGTAS links residents with the municipal operations team and rescuers, so safety information reaches people quickly and requests for help reach the right responders.</p>
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
          <span class="about-title">{person.title}</span>
          <h3>{person.name}</h3>
          <p>{person.role}</p>
        </article>)}
      </div>
    </section>

    <section class="about-cta" data-reveal>
      <Logo />
      <div>
        <h2>Stay ready with LIGTAS</h2>
        <p>Create a free account to see the hazards and alerts for your barangay.</p>
      </div>
      <button type="button" class="primary" onClick={onGetStarted}>Get started <b>→</b></button>
    </section>
  </div>
}
