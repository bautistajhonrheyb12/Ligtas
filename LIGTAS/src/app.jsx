import { useEffect, useState } from 'preact/hooks'
import './app.css'

const slides = [
  {
    eyebrow: 'Built for preparedness',
    title: 'Safer communities,\nsmarter response.',
    copy: 'Real-time disaster mapping, alerts, and coordination — all in one place.',
    type: 'welcome',
  },
  {
    eyebrow: 'Know what is happening',
    title: 'Real-time hazard\nmapping.',
    copy: 'View live hazard zones, weather updates, and risk levels in your area.',
    type: 'map',
  },
  {
    eyebrow: 'Stay one step ahead',
    title: 'Alerts that\nreach you.',
    copy: 'Receive verified weather and flood warnings when they matter most.',
    type: 'alerts',
  },
]

function Logo({ small = false }) {
  return <div class={`logo-slot ${small ? 'logo-small' : ''}`}>
    <img src="/LigtasLogo.png" alt="LIGTAS logo" onError={(event) => { event.currentTarget.style.display = 'none' }} />
  </div>
}

function Pin({ x, y, label }) {
  return <div class="pin" style={{ left: `${x}%`, top: `${y}%` }}><span>{label}</span></div>
}

function MapPhoto() {
  return <div class="map-photo-slot">
    <img src="/Map-index.png" alt="LIGTAS hazard map" onError={(event) => { event.currentTarget.style.display = 'none' }} />
  </div>
}

const roles = [
  { id: 'citizen', name: 'Citizen', description: 'Stay informed, report incidents, and receive important alerts.', icon: 'citizen' },
  { id: 'rescuer', name: 'Rescuer', description: 'Coordinate operations, manage reports, and assist communities.', icon: 'rescue' },
  { id: 'admin', name: 'Admin', description: 'Manage system settings, users, and platform data.', icon: 'admin' },
]

function RoleIcon({ type }) {
  return <span class="role-icon-placeholder"><span>Icon</span><img src={`/${type}-icon.png`} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} /></span>
}

function IconPlaceholder({ name, label = 'Icon' }) {
  return <span class="asset-icon-placeholder"><span>{label}</span><img src={`/${name}.png`} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} /></span>
}

function AuthScreen({ role, mode, onChooseRole, onBack, onClose, onModeChange }) {
  const selectedRole = roles.find(item => item.id === role)
  if (!selectedRole) return <section class="auth-screen" aria-label="Choose account type">
    <div class="auth-top"><button class="back-button" onClick={onClose}>← Back</button><Logo small /></div>
    <div class="auth-intro"><Logo /><h2>LIGTAS</h2><span>Log in to continue</span><p>Choose an account type to access the tools made for your role in the community.</p></div>
    <div class="role-list">{roles.map(item => <button class="role-card" onClick={() => onChooseRole(item.id)} key={item.id}><i><RoleIcon type={item.icon} /></i><span><b>{item.name}</b><small>{item.description}</small></span><em>›</em></button>)}</div>
  </section>

  return <section class="auth-screen form-screen" aria-label={`${mode} as ${selectedRole.name}`}>
    <div class="auth-top"><button class="back-button" onClick={onBack}>← Account type</button><Logo small /></div>
    <div class="form-wrap"><div class="role-badge"><i><RoleIcon type={selectedRole.icon} /></i>{selectedRole.name}{selectedRole.id === 'admin' && <span>Superadmin</span>}</div><h2>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h2><p>{mode === 'login' ? `Log in as a ${selectedRole.name.toLowerCase()} to continue.` : `Sign up as a ${selectedRole.name.toLowerCase()} to get started.`}</p><div class="mode-switch"><button class={mode === 'login' ? 'selected' : ''} onClick={() => onModeChange('login')}>Log in</button><button class={mode === 'signup' ? 'selected' : ''} onClick={() => onModeChange('signup')}>Sign up</button></div><form onSubmit={(event) => event.preventDefault()}><label>Email address<input type="email" placeholder="you@example.com" required /></label><label>Password<input type="password" placeholder="••••••••" required /></label>{mode === 'signup' && <label>Confirm password<input type="password" placeholder="••••••••" required /></label>}<button class="submit-auth" type="submit">{mode === 'login' ? 'Log in' : 'Create account'} <b>→</b></button></form></div>
  </section>
}

function Illustration({ type }) {
  if (type === 'map') return <div class="map-visual" aria-hidden="true">
    <MapPhoto />
    <div class="flood-card"><strong>Flood Warning</strong><span>Brgy. Santa Maria · Tungkong Mangga Rd, Bulacan</span></div>
  </div>
  if (type === 'alerts') return <div class="alert-visual" aria-hidden="true">
    <div class="bell"><svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>
    <div class="alert-panel">

      <div class="alert-row"><i>☁</i><div><b>Heavy Rainfall</b><span>Santa Maria, Bulacan<br/>Today, 8:30 PM</span></div></div>
      <hr />
      <div class="alert-row"><i>⌂</i><div><b>Flood Warning</b><span>Santa Maria, Bulacan<br/>Today, 8:30 PM</span></div></div>
    </div>
  </div>
  return <div class="island-visual" aria-hidden="true">
    <div class="cloud cloud-one" /><div class="cloud cloud-two" />
    <div class="island"><span class="tree t1"/><span class="tree t2"/><span class="tree t3"/><span class="tree t4"/><span class="house h1"/><span class="house h2"/><Pin x={35} y={42} label=""/><Pin x={67} y={66} label=""/><Pin x={75} y={35} label=""/></div>
  </div>
}

export function App() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [authRole, setAuthRole] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [menuOpen, setMenuOpen] = useState(false)
  const slide = slides[active]

  useEffect(() => {
    if (paused) return undefined
    const timer = setInterval(() => setActive(current => (current + 1) % slides.length), 4000)
    return () => clearInterval(timer)
  }, [paused])

  const advance = () => setActive(current => (current + 1) % slides.length)

  const openAuth = () => { setMenuOpen(false); setAuthRole(null); setAuthMode('login'); setShowAuth(true) }
  if (showAuth) return <main class="site auth-site"><AuthScreen role={authRole} mode={authMode} onChooseRole={setAuthRole} onModeChange={setAuthMode} onBack={() => setAuthRole(null)} onClose={() => setShowAuth(false)} /></main>

  return <main class={`site stage-${slide.type}`}>
    <nav class="topbar">
      <a class="brand" href="#top" aria-label="LIGTAS home"><Logo small /><span>LIGTAS</span></a>
      <div class="nav-links"><a href="#how-it-works">How it works</a><a href="#features">Features</a><button class="nav-cta" onClick={openAuth}>Log in</button></div>
      <button class="menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu" aria-expanded={menuOpen}><span/><span/></button>
    </nav>
    {menuOpen && <div class="mobile-nav"><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a><a href="#features" onClick={() => setMenuOpen(false)}>Features</a><button onClick={openAuth}>Log in <b>→</b></button></div>}

    <section class="hero" id="top" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div class="hero-copy">
        <div class="kicker"><span class="pulse" /> {slide.eyebrow}</div>
        {active === 0 && <Logo />}
        <h1>{slide.title.split('\n').map((line, i) => <span key={line}>{line}{i === 0 && <br />}</span>)}</h1>
        <p>{slide.copy}</p>
        <div class="hero-actions"><button class="primary" onClick={openAuth}>Get started <b>→</b></button><button class="ghost" onClick={() => setPaused(!paused)}>{paused ? 'Play slideshow' : 'Pause slideshow'}</button></div>
        <div class="progress" aria-label={`Slide ${active + 1} of ${slides.length}`}>{slides.map((_, index) => <button class={index === active ? 'active' : ''} onClick={() => setActive(index)} aria-label={`Go to slide ${index + 1}`} />)}</div>
      </div>
      <div class="hero-art"><div class="glow" /><Illustration type={slide.type} /><div class="artifact artifact-one"/><div class="artifact artifact-two"/></div>
    </section>

    <section class="trust" id="features"><span>Designed for local communities</span><div/><span>Localized intelligence for every response</span></section>
    <section class="how-it-works" id="how-it-works">
      <div class="section-heading"><span>How it works</span><h2>Preparedness starts<br />with one clear view.</h2><p>LIGTAS brings important local information together, so every community member can act with confidence.</p></div>
      <div class="steps">
        <article class="step-card"><b>01</b><div class="step-symbol"><IconPlaceholder name="verified-alert-icon" /></div><h3>Receive verified alerts</h3><p>Get timely updates on heavy rainfall, flooding, earthquakes, and other hazards near you.</p></article>
        <article class="step-card"><b>02</b><div class="step-symbol"><IconPlaceholder name="hazard-map-icon" /></div><h3>See the situation clearly</h3><p>Use localized hazard maps and live reports to understand risks in your barangay.</p></article>
        <article class="step-card"><b>03</b><div class="step-symbol"><IconPlaceholder name="community-response-icon" /></div><h3>Respond together</h3><p>Report incidents, find safety information, and help responders coordinate faster.</p></article>
      </div>
    </section>
    <section class="feature-strip" id="about"><div><b>01</b><h2>Live mapping</h2><p>See locations and hazards with clarity.</p></div><div><b>02</b><h2>Verified alerts</h2><p>Stay informed with timely updates.</p></div><div><b>03</b><h2>Better coordination</h2><p>Help communities respond together.</p></div></section>
  </main>
}
