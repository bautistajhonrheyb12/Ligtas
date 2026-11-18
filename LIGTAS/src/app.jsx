import { useEffect, useRef, useState } from 'preact/hooks'
import {
  clearCachedData,
  getMyTermsVersion,
  getProfileRole,
  getTwoStepStatus,
  isGoogleSession,
  isSessionEnded,
  SESSION_ENDED_EVENT,
  supabase,
  takeGoogleSignIn,
} from './lib/supabase.js'
import { rescueHotline } from './lib/hotlines.js'
import { Icon, Logo } from './lib/ui.jsx'
import { LEGAL_VERSION, privacyUrl, termsUrl } from './lib/legal.js'
import { TermsGate } from './components/TermsGate.jsx'
import { InstallButton } from './components/PhoneSetup.jsx'
import { slides, Illustration } from './screens/landing.jsx'
import { AboutPage } from './screens/AboutPage.jsx'
import { AuthScreen } from './screens/AuthScreen.jsx'
import { ResetPasswordScreen } from './screens/ResetPasswordScreen.jsx'
import { TwoStepScreen } from './screens/TwoStepScreen.jsx'
// Loaded here, before the app styles, so the app's map overrides keep winning.
import 'leaflet/dist/leaflet.css'
import './app.css'
import './motion.css'
import './polish.css'
import './rescuer.css'
import './citizen.css'
import './admin.css'
import './about.css'
import './navigation.css'
import './priority.css'
import './legal.css'
import './enhance.css'

// Each dashboard (and the map library) downloads only when that role signs in,
// which keeps the first page light on slow mobile connections.
const dashboardLoaders = {
  citizen: () => import('./screens/CitizenDashboard.jsx').then((module) => module.CitizenDashboard),
  rescuer: () => import('./screens/RescuerDashboard.jsx').then((module) => module.RescuerDashboard),
  admin: () => import('./screens/AdminDashboard.jsx').then((module) => module.AdminDashboard),
}

function useDashboard(role) {
  const [loaded, setLoaded] = useState({ role: null, component: null, error: '' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!role) return undefined
    let isMounted = true
    dashboardLoaders[role]()
      .then((component) => { if (isMounted) setLoaded({ role, component, error: '' }) })
      .catch(() => { if (isMounted) setLoaded({ role, component: null, error: 'Could not load this screen. Check your connection and try again.' }) })
    return () => { isMounted = false }
  }, [role, attempt])

  const isCurrent = loaded.role === role
  return {
    Dashboard: isCurrent ? loaded.component : null,
    error: isCurrent ? loaded.error : '',
    retry: () => setAttempt((count) => count + 1),
  }
}

// The admin sign-in is not offered on the public login page; staff open the
// app at this address instead. The database, not this link, is what actually
// restricts admin access.
const isStaffAddress = () => window.location.hash === '#staff'
const isAboutAddress = () => window.location.hash === '#about-us'
// The Terms of Use and Privacy Policy open from anywhere, signed in or not.
const legalAt = () => ({ '#terms': 'terms', '#privacy': 'privacy' })[window.location.hash] ?? null

const wasGoogleSignIn = takeGoogleSignIn()

// When Google sign-in is cancelled or an email link has expired, Supabase sends
// the person back with the reason in the address. Read it before anything else
// changes the URL.
const returnError = (() => {
  const params = new URLSearchParams(`${window.location.search.slice(1)}&${window.location.hash.slice(1)}`)
  const reason = params.get('error_description') ?? params.get('error')
  if (!reason) return ''
  window.history.replaceState(null, '', window.location.pathname)
  if (!wasGoogleSignIn) return `That link didn't work: ${reason}. Request a new one and try again.`
  return params.get('error') === 'access_denied' ? 'Google sign-in was cancelled.' : `Google sign-in didn't finish: ${reason}`
})()

export function App() {
  const [active, setActive] = useState(0)
  const [isStaffAccess, setIsStaffAccess] = useState(isStaffAddress)
  const [showAuth, setShowAuth] = useState(() => isStaffAddress() || Boolean(returnError))
  const [authRole, setAuthRole] = useState(returnError && wasGoogleSignIn ? 'citizen' : null)
  const [authMode, setAuthMode] = useState('login')
  const [menuOpen, setMenuOpen] = useState(false)
  const [showAbout, setShowAbout] = useState(isAboutAddress)
  const [legalDoc, setLegalDoc] = useState(legalAt)
  const openedLegalInAppRef = useRef(false)
  // Staff accept the terms over their dashboard: 'accepted', 'needed' or 'update'.
  const [staffTerms, setStaffTerms] = useState('accepted')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState(null)
  const [authMessage, setAuthMessage] = useState(returnError)
  // True until the saved session is checked, so signed-in people never see the landing page flash.
  const [isRestoring, setIsRestoring] = useState(Boolean(supabase))
  // Reset links land here with type=recovery in the address; Supabase removes it once read.
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(() => /type=recovery/.test(window.location.hash))
  // 'enroll' or 'challenge' while an admin still has to pass two-step sign-in.
  const [twoStep, setTwoStep] = useState(null)
  const slide = slides[active]
  const dashboard = useDashboard(isAuthenticated ? userRole : null)
  // The Terms and Privacy pages (long, in two languages) download only when opened.
  const [legalPage, setLegalPage] = useState({ Page: null, error: '' })
  useEffect(() => {
    if (!legalDoc || legalPage.Page) return
    import('./screens/LegalPage.jsx')
      .then((module) => setLegalPage({ Page: module.LegalPage, error: '' }))
      .catch(() => setLegalPage({ Page: null, error: 'Could not load this page. Check your connection and try again.' }))
  }, [legalDoc])

  // Admins only reach their dashboard after the authenticator code step.
  const completeSignIn = async (role) => {
    if (role === 'admin') {
      const status = await getTwoStepStatus()
      if (status !== 'verified') {
        setTwoStep(status)
        return
      }
    }
    setTwoStep(null)
    setUserRole(role)
    setIsAuthenticated(true)
  }

  const handleLogin = async (roleId, email, password, mode, details = {}) => {
    if (!supabase) {
      throw new Error('Supabase is not configured. Add the project URL and publishable key to LIGTAS/.env.local, then restart the app.')
    }

    let user
    if (mode === 'signup') {
      if (roleId !== 'citizen') {
        throw new Error('Only citizen accounts can be created through sign-up.')
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { display_name: details.displayName, barangay: details.barangay, phone: details.phone, terms_version: details.termsVersion },
        },
      })
      if (error) throw error
      if (!data.session) return { confirmationRequired: true }
      user = data.user
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      user = data.user
    }

    let actualRole
    try {
      actualRole = await getProfileRole(user.id)
    } catch (profileError) {
      await supabase.auth.signOut({ scope: 'local' })
      throw profileError
    }

    if (actualRole !== roleId) {
      await supabase.auth.signOut({ scope: 'local' })
      throw new Error(actualRole === 'admin'
        ? 'This account cannot sign in here. Use the staff sign-in link.'
        : `This account is registered as ${actualRole}. Choose that role to sign in.`)
    }

    try {
      await completeSignIn(actualRole)
    } catch (twoStepError) {
      await supabase.auth.signOut({ scope: 'local' })
      throw twoStepError
    }

    setAuthMessage('')
    setShowAuth(false)
    return { confirmationRequired: false }
  }

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) {
      setAuthMessage(`Could not sign out: ${error.message}`)
      return
    }
    clearCachedData()
    setIsAuthenticated(false)
    setUserRole(null)
    setAuthMessage('')
  }

  useEffect(() => {
    if (!supabase) return undefined

    let isMounted = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!isMounted) return
      if (event === 'PASSWORD_RECOVERY') setIsRecoveringPassword(true)
      if (event === 'SIGNED_OUT') {
        clearCachedData()
        setIsAuthenticated(false)
        setUserRole(null)
        setIsRecoveringPassword(false)
        setTwoStep(null)
      }
    })

    const openStaffSignIn = () => {
      if (!isStaffAddress()) return
      setIsStaffAccess(true)
      setAuthRole(null)
      setShowAuth(true)
    }
    window.addEventListener('hashchange', openStaffSignIn)

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!isMounted) return
      if (error) {
        setAuthMessage(`Could not restore your session: ${error.message}`)
        return
      }
      if (!data.session) return

      try {
        const role = await getProfileRole(data.session.user.id)
        // Rescuer and admin accounts must use their email and password, even
        // when Google is linked to the same email address.
        if (role !== 'citizen' && isGoogleSession(data.session)) {
          await supabase.auth.signOut({ scope: 'local' })
          if (isMounted) {
            setAuthMessage('Google sign-in is for citizen accounts only. Sign in with your email and password instead.')
            setShowAuth(true)
          }
          return
        }
        if (isMounted) {
          await completeSignIn(role)
          // Someone already signed in who opens the staff link goes straight to their screen.
          setShowAuth(false)
        }
      } catch (profileError) {
        await supabase.auth.signOut({ scope: 'local' })
        if (isMounted) setAuthMessage(profileError.message)
      }
    }).catch((sessionError) => {
      if (isMounted) setAuthMessage(`Could not restore your session: ${sessionError.message}`)
    }).finally(() => {
      if (isMounted) setIsRestoring(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
      window.removeEventListener('hashchange', openStaffSignIn)
    }
  }, [])

  // Every screen checks that its sign-in session still exists: every minute,
  // when the phone is opened again, and when the connection returns. A session
  // ended elsewhere (an admin, or a security setting) then goes back to the
  // sign-in screen at once, instead of the database quietly refusing reports.
  useEffect(() => {
    if (!isAuthenticated || !userRole) return undefined
    let isEnding = false
    const endHere = async () => {
      if (isEnding) return
      isEnding = true
      await supabase.auth.signOut({ scope: 'local' })
      setAuthMessage(userRole === 'citizen'
        ? `You were signed out on this phone, so please sign in again. Any report you were sending is saved and will be sent after you sign in. In an emergency, call ${rescueHotline.name} at ${rescueHotline.display}.`
        : 'You were signed out because this session was ended on another device or by an admin.')
      setAuthRole(userRole === 'admin' ? null : userRole)
      setAuthMode('login')
      setShowAuth(true)
    }
    const check = async () => {
      if (document.visibilityState === 'hidden' || !navigator.onLine) return
      if (await isSessionEnded()) endHere()
    }
    const timer = setInterval(check, 60000)
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', check)
    window.addEventListener(SESSION_ENDED_EVENT, endHere)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', check)
      window.removeEventListener(SESSION_ENDED_EVENT, endHere)
    }
  }, [isAuthenticated, userRole])

  // Rescuers and admins who have not accepted the current terms see the
  // acceptance screen over their dashboard (citizens get it in theirs, with SOS).
  useEffect(() => {
    if (!isAuthenticated || (userRole !== 'admin' && userRole !== 'rescuer')) {
      setStaffTerms('accepted')
      return
    }
    getMyTermsVersion()
      .then((version) => setStaffTerms(version === undefined || version === LEGAL_VERSION ? 'accepted' : version ? 'update' : 'needed'))
      .catch(() => {})
  }, [isAuthenticated, userRole])

  // Restarts on every slide change so the progress bar fill stays in sync with the timer.
  useEffect(() => {
    const timer = setTimeout(() => setActive(current => (current + 1) % slides.length), 4000)
    return () => clearTimeout(timer)
  }, [active])

  // The About page lives at #about-us, so links and the browser's Back button work.
  useEffect(() => {
    const followAddress = () => {
      setShowAbout(isAboutAddress())
      setLegalDoc(legalAt())
      if (legalAt()) openedLegalInAppRef.current = true
      setMenuOpen(false)
    }
    window.addEventListener('hashchange', followAddress)
    return () => window.removeEventListener('hashchange', followAddress)
  }, [])

  useEffect(() => {
    // Coming back from the About page to a section link (like #how-it-works)
    // scrolls to that section once the landing page is showing again.
    const target = !showAbout && window.location.hash.length > 1 && document.getElementById(window.location.hash.slice(1))
    if (target) target.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [showAuth, isAuthenticated, showAbout, legalDoc])

  useEffect(() => {
    // Waits for the loading screen to finish, so the sections exist to be watched.
    if (isRestoring || showAuth || isAuthenticated || !('IntersectionObserver' in window)) return undefined
    document.documentElement.classList.add('reveal-ready')
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-revealed')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' })
    document.querySelectorAll('[data-reveal]').forEach((item) => observer.observe(item))
    return () => observer.disconnect()
  }, [isRestoring, showAuth, isAuthenticated, showAbout])

  const openAuth = () => { setMenuOpen(false); setAuthRole(null); setAuthMode('login'); setShowAuth(true) }
  // Back to where the person was: the previous page if they came from within
  // LIGTAS, otherwise (a link opened in a new tab) the app's start.
  const leaveLegal = () => {
    if (openedLegalInAppRef.current) {
      window.history.back()
      return
    }
    window.history.replaceState(null, '', window.location.pathname)
    setLegalDoc(null)
  }
  if (isRecoveringPassword) return <main class="site auth-site"><ResetPasswordScreen onDone={() => setIsRecoveringPassword(false)} onCancel={() => { setIsRecoveringPassword(false); handleSignOut() }} /></main>
  if (twoStep) return <main class="site auth-site"><TwoStepScreen mode={twoStep} onVerified={() => completeSignIn('admin')} onCancel={() => { setTwoStep(null); handleSignOut() }} /></main>
  if (legalDoc) {
    if (legalPage.Page) return <main class="site legal-site"><legalPage.Page doc={legalDoc} onBack={leaveLegal} /></main>
    return <main class="app-splash" aria-busy={!legalPage.error} aria-label="Loading LIGTAS">
      <Logo />
      {legalPage.error
        ? <><p class="app-splash-error" role="alert">{legalPage.error}</p><button type="button" class="primary" onClick={leaveLegal}>Back</button></>
        : <span class="btn-spinner" aria-hidden="true" />}
    </main>
  }
  if (isRestoring) return <main class="app-splash" aria-busy="true" aria-label="Loading LIGTAS"><Logo /><span class="btn-spinner" aria-hidden="true" /></main>
  if (showAuth) return <main class="site auth-site"><AuthScreen showAdmin={isStaffAccess} role={authRole} mode={authMode} onChooseRole={(role) => { setAuthMessage(''); setAuthRole(role) }} onModeChange={setAuthMode} onBack={() => setAuthRole(null)} onClose={() => setShowAuth(false)} onLogin={handleLogin} authMessage={authMessage} /></main>
  if (isAuthenticated && userRole) {
    if (dashboard.Dashboard) return <>
      <dashboard.Dashboard onSignOut={handleSignOut} canStartTour={staffTerms === 'accepted'} />
      {staffTerms !== 'accepted' && <TermsGate isStaff isUpdate={staffTerms === 'update'} onAccepted={() => setStaffTerms('accepted')} onSignOut={handleSignOut} />}
    </>
    return <main class="app-splash" aria-busy={!dashboard.error} aria-label="Loading LIGTAS">
      <Logo />
      {dashboard.error
        ? <><p class="app-splash-error" role="alert">{dashboard.error}</p><button type="button" class="primary" onClick={dashboard.retry}>Try again</button></>
        : <span class="btn-spinner" aria-hidden="true" />}
    </main>
  }

  const topbar = <>
    <nav class="topbar">
      <a class="brand" href="#top" aria-label="LIGTAS home"><Logo small /><span>LIGTAS</span></a>
      <div class="nav-links">
        <a href="#how-it-works">How it works</a>
        <a href="#features">Features</a>
        <a href="#about-us" aria-current={showAbout ? 'page' : undefined}>About us</a>
        <a href={termsUrl}>Terms &amp; Privacy</a>
        <InstallButton class="nav-install" />
        <button class="nav-cta" onClick={openAuth}>Log in</button>
      </div>
      <button class="menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu" aria-expanded={menuOpen}><span/><span/></button>
    </nav>
    {menuOpen && <div class="mobile-nav"><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a><a href="#features" onClick={() => setMenuOpen(false)}>Features</a><a href="#about-us" onClick={() => setMenuOpen(false)}>About us</a><a href={termsUrl} onClick={() => setMenuOpen(false)}>Terms of Use</a><a href={privacyUrl} onClick={() => setMenuOpen(false)}>Privacy Policy</a><InstallButton class="mobile-install" /><button onClick={openAuth}>Log in <b>→</b></button></div>}
  </>
  const footer = <footer class="site-footer">
    <span>© {new Date().getFullYear()} LIGTAS · Santa Maria, Bulacan</span>
    <nav aria-label="Footer"><a href="#top">Home</a><a href="#about-us">About us</a><a href={termsUrl}>Terms of Use</a><a href={privacyUrl}>Privacy Policy</a></nav>
  </footer>

  if (showAbout) return <main class="site about-site">
    {topbar}
    <AboutPage onGetStarted={openAuth} />
    {footer}
  </main>

  return <main class={`site stage-${slide.type}`}>
    {topbar}

    <section class="hero" id="top">
      <div class="hero-copy">
        <div class="kicker"><span class="pulse" /> <span class="kicker-text" key={`kicker-${active}`}>{slide.eyebrow}</span></div>
        <Logo />
        <h1 class="hero-title" key={`title-${active}`}>{slide.title.split('\n').map((line, i) => <span key={line}>{line}{i === 0 && <br />}</span>)}</h1>
        <p class="hero-lede" key={`copy-${active}`}>{slide.copy}</p>
        <div class="hero-actions"><button class="primary" onClick={openAuth}>Get started <b>→</b></button><InstallButton class="hero-install" /></div>
        <div class="progress" aria-label={`Slide ${active + 1} of ${slides.length}`}>{slides.map((_, index) => <button key={index} class={index === active ? 'active' : ''} onClick={() => setActive(index)} aria-label={`Go to slide ${index + 1}`} />)}</div>
      </div>
      <div class="hero-art">
        <div class="glow" />
        <div class="hero-sonar" aria-hidden="true"><span /><span /><span /></div>
        <div class="hero-scene" key={slide.type}><Illustration type={slide.type} /></div>
        <div class="artifact artifact-one"/><div class="artifact artifact-two"/>
      </div>
    </section>

    <section class="trust" id="features" data-reveal><span>Designed for local communities</span><div/><span>Localized information for every response</span></section>
    <section class="how-it-works" id="how-it-works">
      <div class="section-heading" data-reveal><span>How it works</span><h2>Preparedness starts<br />with one clear view.</h2><p>LIGTAS brings important local information together, so every community member can act with confidence.</p></div>
      <div class="steps">
        <article class="step-card" data-reveal><b>01</b><div class="step-symbol"><Icon name="bell" size={30} /></div><h3>Receive verified alerts</h3><p>Get timely updates on heavy rainfall, flooding, earthquakes, and other hazards near you.</p></article>
        <article class="step-card" data-reveal><b>02</b><div class="step-symbol"><Icon name="map" size={30} /></div><h3>See the situation clearly</h3><p>Use localized hazard maps and live reports to understand risks in your barangay.</p></article>
        <article class="step-card" data-reveal><b>03</b><div class="step-symbol"><Icon name="users" size={30} /></div><h3>Respond together</h3><p>Report incidents, find safety information, and help responders coordinate faster.</p></article>
      </div>
    </section>
    <section class="feature-strip" id="about" data-reveal><div><b>01</b><h2>Live mapping</h2><p>See locations and hazards with clarity.</p></div><div><b>02</b><h2>Verified alerts</h2><p>Stay informed with timely updates.</p></div><div><b>03</b><h2>Better coordination</h2><p>Help communities respond together.</p></div></section>
    {footer}
  </main>
}
