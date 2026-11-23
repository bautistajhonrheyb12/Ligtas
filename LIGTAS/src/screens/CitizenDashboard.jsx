import { useEffect, useRef, useState } from 'preact/hooks'
import {
  currentUserId,
  getAlerts,
  getEvacuationCenters,
  getMapPoints,
  getMyCheckin,
  getMyFamily,
  getMyPriorityMembers,
  getMyProfile,
  getMyReports,
  saveCheckin,
  submitIncidentReport,
  subscribeToTable,
  withdrawIncidentReport,
} from '../lib/supabase.js'
import { useLanguage } from '../lib/i18n.js'
import { flushQueuedReports, getQueuedReports } from '../lib/offlineQueue.js'
import { isInsideSantaMaria } from '../lib/santaMaria.js'
import {
  CountUp,
  Icon,
  LoadingCards,
  Logo,
  OfflineBanner,
  ToastStack,
  alertSymbol,
  capacityLevel,
  directionsUrl,
  distanceKm,
  formatDistance,
  playAlertChime,
  timeAgo,
  toAlertView,
  useLivePosition,
  useOnlineStatus,
  useRefreshOnReturn,
  useTabIndicator,
  useToasts,
} from '../lib/ui.jsx'
import { NavigationView } from '../components/NavigationView.jsx'
import { pickNearestSafeCenter, travelTimesToCenters } from '../lib/evacuation.js'
import { hazardZones } from '../lib/hazards.js'
import { formatMeters, formatMinutes } from '../lib/navigation.js'
import { CitizenMap } from './citizen/CitizenMap.jsx'
import { MyReports } from './citizen/MyReports.jsx'
import { PreparePanel } from './citizen/PreparePanel.jsx'
import { PriorityQuestion } from './citizen/Priority.jsx'
import { useSosLiveShare } from '../lib/useSosLiveShare.js'
import { ConfirmAction } from '../components/ConfirmDialog.jsx'
import { TermsGate } from '../components/TermsGate.jsx'
import { LEGAL_VERSION, needsTermsAcceptance } from '../lib/legal.js'
import { ReportDialog } from './citizen/ReportDialog.jsx'
import { reportLimitReached } from '../lib/limits.js'
import { SosDialog } from './citizen/SosDialog.jsx'
import { NotificationPrompt } from '../components/PhoneSetup.jsx'
import { FamilyStatus } from './citizen/Family.jsx'
import { Tour } from '../components/Tour.jsx'
import { ProfileButton, ProfilePage } from '../components/Profile.jsx'
import { TOURS, markTourDone, tourDone } from '../lib/tours.js'
import { syncPush } from '../lib/push.js'

const capacityKeys = { open: 'capOpen', busy: 'capBusy', critical: 'capCritical' }
const severityKeys = { High: 'sevHigh', Moderate: 'sevModerate', Low: 'sevLow' }
const statusKeys = { Pending: 'statusPending', Verified: 'statusVerified', Resolved: 'statusResolved', Rejected: 'statusRejected', Cancelled: 'statusCancelled' }

function alertMatchesArea(alert, barangay) {
  if (!alert.barangays?.length) return true
  return Boolean(barangay) && alert.barangays.some((item) => item.trim().toLowerCase() === barangay.trim().toLowerCase())
}

export function CitizenDashboard({ onSignOut }) {
  const { lang, setLang, t } = useLanguage()
  // Realtime callbacks are created once; read translations through a ref so they follow language changes.
  const tRef = useRef(t)
  tRef.current = t
  const tr = (...args) => tRef.current(...args)
  const isOnline = useOnlineStatus()
  const [toasts, pushToast, dismissToast] = useToasts()
  const [activeTab, setActiveTab] = useState('home')
  const [isSheetExpanded, setIsSheetExpanded] = useState(false)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)
  const citizenNavRef = useTabIndicator(activeTab)
  const sheetTouchStartRef = useRef(null)
  const sheetWasDraggedRef = useRef(false)

  const [profile, setProfile] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [alertsError, setAlertsError] = useState('')
  const [alertFilter, setAlertFilter] = useState('all')
  const [centers, setCenters] = useState([])
  const [centersLoading, setCentersLoading] = useState(true)
  const [points, setPoints] = useState([])
  const [myReports, setMyReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [reportsError, setReportsError] = useState('')
  const [myId, setMyId] = useState(null)
  const myIdRef = useRef(null)
  const [queuedReports, setQueuedReports] = useState([])
  const [checkin, setCheckin] = useState(null)
  const [isSavingCheckin, setIsSavingCheckin] = useState(false)
  // People in the household who need priority rescue, with their review status.
  const [priorityMembers, setPriorityMembers] = useState([])
  const priorityMembersRef = useRef([])

  // Followed continuously so the person always sees themselves on the map.
  const livePosition = useLivePosition()
  const userPosition = livePosition.position
  const [wantsMyLocation, setWantsMyLocation] = useState(false)
  const isLocating = wantsMyLocation && !userPosition
  const isOutsideArea = Boolean(userPosition) && !isInsideSantaMaria(userPosition.latitude, userPosition.longitude)
  // After an SOS, the phone keeps sharing where the person is with rescuers.
  const sosLive = useSosLiveShare({ reports: myReports, position: userPosition, isOnline })
  // Keeps this phone's notifications (if turned on) linked to this sign-in and language.
  useEffect(() => { syncPush(lang) }, [lang])
  const [focusTarget, setFocusTarget] = useState(null)
  const [dialog, setDialog] = useState(null)
  // The profile page and the part of it shown first ('main', 'personal'...).
  const [profileView, setProfileView] = useState(null)
  // The evacuation center being navigated to, if any.
  const [navTarget, setNavTarget] = useState(null)
  // Travel time by road to each open center (null: no safe road route),
  // worked out from where the person is, avoiding reported hazards.
  const [travelTimes, setTravelTimes] = useState(null)
  const [isFindingSafeCenter, setIsFindingSafeCenter] = useState(false)
  const travelOriginRef = useRef(null)

  // The guided tour: shown once, the first time someone reaches this screen
  // (after the terms and the priority question), and again from Prepare.
  const [isTourOpen, setIsTourOpen] = useState(false)
  const isReadyForTour = Boolean(profile) && !needsTermsAcceptance(profile) && profile.priority_answered_at !== null
  useEffect(() => {
    if (!isReadyForTour || dialog || navTarget || profileView || isTourOpen || tourDone('citizen')) return undefined
    const timer = setTimeout(() => setIsTourOpen(true), 900)
    return () => clearTimeout(timer)
  }, [isReadyForTour, dialog, navTarget, profileView])
  const tourPrepare = {
    map: () => { setIsMapFullscreen(false); setActiveTab('home'); setIsSheetExpanded(false) },
    home: () => { setIsMapFullscreen(false); setActiveTab('home'); setIsSheetExpanded(true) },
  }

  const loadAlerts = () => getAlerts()
    .then((data) => { setAlerts(data.map(toAlertView)); setAlertsError('') })
    .catch((error) => setAlertsError(error.message))
    .finally(() => setAlertsLoading(false))
  const loadCenters = () => getEvacuationCenters()
    .then(setCenters)
    .catch(() => {})
    .finally(() => setCentersLoading(false))
  const loadPoints = () => getMapPoints().then(setPoints).catch(() => {})
  const loadMyReports = () => getMyReports()
    .then((data) => { setMyReports(data); setReportsError('') })
    .catch((error) => setReportsError(error.message))
    .finally(() => setReportsLoading(false))
  const loadPriority = () => getMyPriorityMembers()
    .then((data) => { priorityMembersRef.current = data; setPriorityMembers(data) })
    .catch(() => {})
  const updateProfile = (changes) => setProfile((current) => current && { ...current, ...changes })
  // Family safety: undefined while loading, null when not in a family.
  const [family, setFamily] = useState(undefined)
  const loadFamily = () => getMyFamily().then(setFamily).catch(() => {})
  // Catches up on anything missed while the phone had LIGTAS in the background.
  useRefreshOnReturn(() => {
    loadAlerts()
    loadCenters()
    loadPoints()
    loadMyReports()
    loadPriority()
    loadFamily()
    getMyCheckin().then(setCheckin).catch(() => {})
  })
  // Family members' safety changes on their phones, so it is checked every
  // minute while LIGTAS is open (notifications cover the time it is closed).
  useEffect(() => {
    loadFamily()
    const timer = setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine) loadFamily() }, 60000)
    return () => clearInterval(timer)
  }, [])
  const openFamily = () => {
    selectTab('prepare')
    setTimeout(() => document.getElementById('my-family')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 350)
  }

  const flushQueue = async () => {
    const owner = myIdRef.current
    if (!owner) return
    const { sent, failed } = await flushQueuedReports(submitIncidentReport, owner)
    setQueuedReports(getQueuedReports(owner))
    if (sent > 0) {
      pushToast(tr('queuedSent', { count: sent }), 'success')
      loadMyReports()
    }
    failed.forEach(({ message }) => pushToast(tr('queuedFailed', { message }), 'urgent'))
  }

  useEffect(() => {
    currentUserId()
      .then((id) => {
        myIdRef.current = id
        setMyId(id)
        setQueuedReports(getQueuedReports(id))
        flushQueue()
      })
      .catch(() => setQueuedReports(getQueuedReports(null)))
    getMyProfile().then(setProfile).catch(() => {})
    loadPriority()
    getMyCheckin().then(setCheckin).catch(() => {})
    loadAlerts()
    loadCenters()
    loadPoints()
    loadMyReports()

    const unsubscribers = [
      subscribeToTable('alerts', (change) => {
        if (change.eventType === 'INSERT') {
          const urgent = change.new.severity === 'High'
          pushToast(tr('newAlertToast', { title: change.new.title }), urgent ? 'urgent' : 'info')
          playAlertChime(urgent)
        }
        loadAlerts()
      }),
      subscribeToTable('evacuation_centers', loadCenters),
      subscribeToTable('map_points', loadPoints),
      subscribeToTable('incident_reports', (change) => {
        if (change.eventType === 'UPDATE' && change.old?.status !== change.new.status && change.new.status && change.new.status !== 'Cancelled') {
          pushToast(tr('reportUpdatedToast', { type: tr('types')[change.new.report_type] ?? change.new.report_type, status: tr(statusKeys[change.new.status]) }), 'info')
        }
        loadMyReports()
      }),
      // An admin verified or rejected a proof.
      subscribeToTable('priority_members', (change) => {
        const before = priorityMembersRef.current.find((member) => member.id === change.new?.id)
        if (change.eventType === 'UPDATE' && before && before.status !== change.new.status) {
          if (change.new.status === 'verified') pushToast(tr('priorityVerifiedToast', { name: change.new.full_name }), 'success')
          if (change.new.status === 'rejected') pushToast(tr('priorityRejectedToast', { name: change.new.full_name, reason: change.new.review_note ?? '' }), 'urgent')
        }
        loadPriority()
      }),
    ]
    window.addEventListener('online', flushQueue)
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      window.removeEventListener('online', flushQueue)
    }
  }, [])

  const areaAlerts = alerts.filter((alert) => alertMatchesArea(alert, profile?.barangay))
  const warningAlerts = areaAlerts.filter((alert) => alert.severity !== 'Low Severity')
  const visibleAlerts = alertFilter === 'warnings' ? warningAlerts : areaAlerts
  const urgentAlert = areaAlerts.find((alert) => alert.accent === 'red')

  const openCenters = centers.filter((center) => center.is_open)
  const stats = {
    openCenters: openCenters.length,
    slots: openCenters.reduce((sum, center) => sum + Math.max(center.capacity - center.occupants, 0), 0),
    sheltered: centers.reduce((sum, center) => sum + center.occupants, 0),
    danger: points.filter((point) => point.point_type === 'Danger zone').length,
  }
  const nearestCenters = openCenters
    .map((center) => ({
      ...center,
      distance: userPosition && center.latitude != null ? distanceKm(userPosition, center) : null,
      road: travelTimes?.has(center.id) ? travelTimes.get(center.id) : undefined,
      available: Math.max(center.capacity - center.occupants, 0),
    }))
    // By travel time on the road when known, then by straight-line distance.
    .sort((a, b) => (a.road !== undefined || b.road !== undefined
      ? (a.road?.timeS ?? Infinity) - (b.road?.timeS ?? Infinity)
      : userPosition ? (a.distance ?? Infinity) - (b.distance ?? Infinity) : b.available - a.available))
    .slice(0, 3)

  // Road travel times, recalculated when the person moves 300 m or more, or
  // when centers or hazards change.
  const loadTravelTimes = async () => {
    const origin = [userPosition.latitude, userPosition.longitude]
    travelOriginRef.current = origin
    const times = await travelTimesToCenters({ origin, centers, zones: hazardZones({ points }) })
    setTravelTimes(times)
    return times
  }
  useEffect(() => {
    if (!userPosition || isOutsideArea || !isOnline) return
    const last = travelOriginRef.current
    if (last && distanceKm({ latitude: last[0], longitude: last[1] }, userPosition) < 0.3) return
    loadTravelTimes().catch(() => {})
  }, [userPosition, isOutsideArea, isOnline])
  useEffect(() => {
    if (travelOriginRef.current && userPosition && isOnline) loadTravelTimes().catch(() => {})
  }, [centers, points])

  // "Evacuate now": the open center with space that is soonest to reach by a
  // safe road route.
  const goToNearestSafeCenter = async () => {
    if (!userPosition) {
      pushToast(t('evacuateNeedsLocation'), 'info')
      locateMe()
      return
    }
    setIsFindingSafeCenter(true)
    try {
      const times = await loadTravelTimes()
      const center = pickNearestSafeCenter(centers, times)
      if (!center) {
        pushToast(t('evacuateNone'), 'urgent')
        return
      }
      const travel = times.get(center.id)
      setNavTarget({ ...center, notice: t('evacuateChosen', { name: center.name, time: formatMinutes(travel.timeS) }) })
    } catch (error) {
      pushToast(error.message, 'urgent')
    } finally {
      setIsFindingSafeCenter(false)
    }
  }

  // One-tap hazard report from the navigation screen, at the person's position.
  const quickReport = async (type, position) => {
    const where = `GPS ${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}${position.roadName ? ` (${position.roadName})` : ''}`
    await submitIncidentReport({
      reportType: type,
      location: where,
      notes: `${type} reported while navigating${position.roadName ? ` on ${position.roadName}` : ''}.`,
      latitude: position.latitude,
      longitude: position.longitude,
      locationSource: 'gps',
    })
    loadMyReports()
  }

  // Centers the map on the person, waiting for the first location fix if needed.
  const locateMe = () => {
    if (livePosition.error) livePosition.retry()
    setWantsMyLocation(true)
  }

  useEffect(() => {
    if (!wantsMyLocation) return
    if (userPosition) {
      setWantsMyLocation(false)
      if (isOutsideArea) pushToast(t('outsideArea'), 'info')
      else setFocusTarget({ ...userPosition })
    } else if (livePosition.error) {
      setWantsMyLocation(false)
      pushToast(livePosition.error, 'urgent')
    }
  }, [wantsMyLocation, userPosition, livePosition.error])

  // The map only covers Santa Maria, so say why the "You" dot is missing.
  const toldOutsideRef = useRef(false)
  useEffect(() => {
    if (!isOutsideArea || toldOutsideRef.current) return
    toldOutsideRef.current = true
    pushToast(t('outsideArea'), 'info')
  }, [isOutsideArea])

  const markSafe = async () => {
    setIsSavingCheckin(true)
    try {
      await saveCheckin({ status: 'Safe', latitude: userPosition?.latitude ?? null, longitude: userPosition?.longitude ?? null })
      setCheckin({ status: 'Safe', updated_at: new Date().toISOString() })
      pushToast(t('safeSaved'), 'success')
      loadFamily()
    } catch (error) {
      pushToast(error.message, 'urgent')
    } finally {
      setIsSavingCheckin(false)
    }
  }

  const withdrawReport = async (report) => {
    try {
      await withdrawIncidentReport(report.id)
      setMyReports((current) => current.map((item) => item.id === report.id ? { ...item, status: 'Cancelled' } : item))
      pushToast(t('withdrawn'), 'success')
    } catch (error) {
      pushToast(error.message, 'urgent')
      loadMyReports()
    }
  }

  const selectTab = (tab) => {
    setActiveTab(tab)
    setIsSheetExpanded(tab !== 'home')
  }

  const peekText = { home: t('peekHome'), alerts: t('peekAlerts'), reports: t('peekReports'), prepare: t('peekPrepare') }[activeTab]
  const tabs = [
    { id: 'home', icon: 'map', label: t('tabHome') },
    { id: 'alerts', icon: 'bell', label: t('tabAlerts'), count: warningAlerts.length },
    { id: 'reports', icon: 'list', label: t('tabReports'), count: queuedReports.length },
    { id: 'prepare', icon: 'bag', label: t('tabPrepare') },
  ]

  return <main class="citizen-ui">
    <header class={`ops-header citizen-header${isMapFullscreen ? ' is-map-fullscreen' : ''}`}>
      <a class="ops-brand" href="#citizen-home" aria-label="LIGTAS citizen dashboard"><Logo small /><span>LIGTAS <i>/ CITIZEN</i></span></a>
      <div class="citizen-header-actions">
        <button type="button" class="lang-toggle" onClick={() => setLang(lang === 'en' ? 'tl' : 'en')} aria-label={t('langToggleLabel')}><Icon name="globe" size={16} /><span>{t('langToggle')}</span></button>
        <button
          type="button"
          class="citizen-map-fullscreen"
          onClick={() => setIsMapFullscreen((value) => !value)}
          aria-label={isMapFullscreen ? t('fullscreenExit') : t('fullscreenOpen')}
          title={isMapFullscreen ? t('fullscreenExit') : t('fullscreenOpen')}
        >
          <Icon name={isMapFullscreen ? 'collapse' : 'expand'} size={18} />
        </button>
        <ProfileButton role="citizen" lang={lang} name={profile?.display_name} photoPath={profile?.avatar_path} onClick={() => setProfileView('main')} />
      </div>
    </header>
    <div class="map-section">
      <div class={`map-frame${isMapFullscreen ? ' is-fullscreen' : ''}`}>
        <CitizenMap points={points} centers={centers} userPosition={isOutsideArea ? null : userPosition} focusTarget={focusTarget} locationError={livePosition.error} isLocating={isLocating} onLocate={locateMe} t={t} />
      </div>
    </div>

    <section class={`citizen-sheet${isSheetExpanded ? ' is-expanded' : ''}${isMapFullscreen ? ' is-map-fullscreen' : ''}`} aria-label="Citizen information and actions">
      <button
        type="button"
        class="citizen-sheet-handle"
        aria-label={isSheetExpanded ? t('collapsePanel') : t('expandPanel')}
        aria-expanded={isSheetExpanded}
        onPointerDown={(event) => {
          sheetTouchStartRef.current = event.clientY
          sheetWasDraggedRef.current = false
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerUp={(event) => {
          if (sheetTouchStartRef.current === null) return
          const distance = event.clientY - sheetTouchStartRef.current
          if (Math.abs(distance) > 36) {
            setIsSheetExpanded(distance < 0)
            sheetWasDraggedRef.current = true
          }
          sheetTouchStartRef.current = null
        }}
        onPointerCancel={() => { sheetTouchStartRef.current = null }}
        onClick={() => {
          if (sheetWasDraggedRef.current) {
            sheetWasDraggedRef.current = false
            return
          }
          setIsSheetExpanded((expanded) => !expanded)
        }}
      >
        <span />
      </button>
      <div class="citizen-sheet-peek">
        <span>{peekText}</span>
        <button type="button" onClick={() => setDialog('report')}>{t('reportIncident')}</button>
      </div>

      <div class="citizen-sheet-scroll">
        <OfflineBanner isOnline={isOnline} label={t('offline')} />

        {activeTab === 'home' && <>
          {sosLive.sharing && <div class="sos-live-banner" role="status">
            <span class="sos-live-dot" aria-hidden="true" />
            <span><strong>{t('sosLiveSharing')}</strong><small>{t('sosLiveDetail', { time: timeAgo(sosLive.savedAt).toLowerCase() })}</small></span>
            <ConfirmAction class="sos-live-stop" onConfirm={sosLive.stop} ask={{
              title: t('sosLiveStopTitle'),
              message: t('sosLiveStopText'),
              confirmLabel: t('sosLiveStopButton'),
              cancelLabel: t('cancel'),
              tone: 'warning',
              icon: 'locate',
            }}>{t('sosLiveStop')}</ConfirmAction>
          </div>}
          <div class="safety-actions">
            <button type="button" class="sos-trigger" onClick={() => setDialog('sos')}>
              <span class="sos-trigger-icon"><Icon name="sos" size={26} /></span>
              <span><strong>{t('sosButton')}</strong><small>{t('sosHint')}</small></span>
            </button>
            <button type="button" class={`safe-trigger${checkin?.status === 'Safe' ? ' is-marked' : ''}`} onClick={markSafe} disabled={isSavingCheckin}>
              <span class="safe-trigger-icon">{isSavingCheckin ? <span class="btn-spinner" aria-hidden="true" /> : <Icon name={checkin?.status === 'Safe' ? 'check' : 'heart'} size={22} />}</span>
              <span><strong>{t('safeButton')}</strong><small>{checkin?.status === 'Safe' ? t('safeMarked', { time: timeAgo(checkin.updated_at).toLowerCase() }) : t('safeHint')}</small></span>
            </button>
          </div>
          <FamilyStatus t={t} family={family} onManage={openFamily} />
          <NotificationPrompt role="citizen" lang={lang} />

          {urgentAlert && <button class="alert-banner citizen-sheet-alert" type="button" onClick={() => selectTab('alerts')}>
            <div class="alert-icon">{alertSymbol(urgentAlert)}</div>
            <div><strong>{urgentAlert.title}</strong><span>{urgentAlert.location} · {timeAgo(urgentAlert.createdAt)}</span></div>
          </button>}

          {priorityMembers.some((member) => member.status === 'rejected') && <button class="priority-attention" type="button" onClick={() => selectTab('prepare')}>
            <Icon name="alert" size={18} />
            <span><strong>{t('priorityAttention')}</strong><small>{t('priorityAttentionHint')}</small></span>
          </button>}

          <div class="citizen-stats-row" aria-label="Community safety overview">
            <div class="citizen-sheet-stat stat-blue"><strong><CountUp value={stats.openCenters} /></strong><span>{t('statOpenCenters')}</span></div>
            <div class="citizen-sheet-stat stat-green"><strong><CountUp value={stats.slots} /></strong><span>{t('statSlots')}</span></div>
            <div class="citizen-sheet-stat stat-orange"><strong><CountUp value={stats.sheltered} /></strong><span>{t('statSheltered')}</span></div>
            <div class="citizen-sheet-stat stat-red"><strong><CountUp value={stats.danger} /></strong><span>{t('statDanger')}</span></div>
          </div>

          <button type="button" class="evacuate-now" onClick={goToNearestSafeCenter} disabled={isFindingSafeCenter}>
            {isFindingSafeCenter ? <span class="btn-spinner" aria-hidden="true" /> : <Icon name="navigate" size={20} />}
            <span><strong>{isFindingSafeCenter ? t('evacuateFinding') : t('evacuateNow')}</strong><small>{t('evacuateHint')}</small></span>
          </button>

          <div class="citizen-sheet-section">
            <div class="citizen-sheet-section-heading">
              <span>{t('nearestTitle')}</span>
              <button type="button" class="locate-chip" onClick={locateMe} disabled={isLocating}>
                {isLocating ? <span class="btn-spinner" aria-hidden="true" /> : <Icon name="locate" size={14} />}
                {isLocating ? t('locating') : t('useMyLocation')}
              </button>
            </div>
            {!userPosition && openCenters.length > 0 && <p class="section-hint">{t('sortedBySpace')}</p>}
            {centersLoading && <LoadingCards label={t('loadingCenters')} count={2} />}
            {!centersLoading && nearestCenters.length === 0 && <p class="admin-empty-state">{t('noCenters')}</p>}
            <div class="nearest-list">
              {nearestCenters.map((center) => {
                const level = capacityLevel(center.occupants, center.capacity)
                return <article class="citizen-evac-card" key={center.id}>
                  <div class="citizen-evac-heading">
                    <div><strong>{center.name}</strong><span>{center.location}{center.road ? ` · ${t('byRoad', { time: formatMinutes(center.road.timeS), distance: formatMeters(center.road.distanceM) })}` : center.road === null ? ` · ${t('noSafeRoad')}` : center.distance != null ? ` · ${t('away', { distance: formatDistance(center.distance) })}` : ''}</span></div>
                    <span class={`capacity-chip capacity-chip--${level.level}`}>{t(capacityKeys[level.level])}</span>
                  </div>
                  <div class="evac-progress"><div class="bar" data-level={level.level} style={{ width: `${center.occupants / center.capacity * 100}%` }}></div><div class="counts">{t('capacity', { occupants: center.occupants, capacity: center.capacity })}</div></div>
                  <div class="evac-actions">
                    {center.latitude != null
                      ? <button type="button" class="evac-navigate" onClick={() => setNavTarget(center)}><Icon name="navigate" size={16} /> {t('navigate')}</button>
                      : <a class="evac-navigate" href={directionsUrl(center)} target="_blank" rel="noreferrer"><Icon name="navigate" size={16} /> {t('navigate')}</a>}
                    {center.latitude != null && <button type="button" class="evac-show" onClick={() => { setFocusTarget({ latitude: center.latitude, longitude: center.longitude }); setIsSheetExpanded(false) }}><Icon name="pin" size={16} /> {t('showOnMap')}</button>}
                  </div>
                </article>
              })}
            </div>
          </div>

          <aside class="incident-report-card panel-box">
            <div class="panel-header"><span>{t('reportCardTitle')}</span></div>
            <p class="incident-report-prompt">{t('reportCardText')}</p>
            <button type="button" class="secondary-action incident-report-trigger" onClick={() => setDialog('report')}>
              <Icon name="camera" size={18} /> {t('reportCardButton')}
            </button>
          </aside>
        </>}

        {activeTab === 'alerts' && <div class="alerts-panel">
          <div class="alerts-header-row"><h2>{t('alertsTitle')}</h2><span class="severity-button">{areaAlerts.length}</span></div>
          <div class="citizen-alert-filter" role="tablist" aria-label="Alert filter">
            <button type="button" role="tab" aria-selected={alertFilter === 'all'} class={alertFilter === 'all' ? 'is-active' : ''} onClick={() => setAlertFilter('all')}>{t('filterAll')} <b>{areaAlerts.length}</b></button>
            <button type="button" role="tab" aria-selected={alertFilter === 'warnings'} class={alertFilter === 'warnings' ? 'is-active' : ''} onClick={() => setAlertFilter('warnings')}>{t('filterWarnings')} <b>{warningAlerts.length}</b></button>
          </div>
          <p class="section-hint">{profile?.barangay
            ? t('alertsForArea', { barangay: profile.barangay })
            : <>{t('setBarangayHint')} <button type="button" class="inline-link" onClick={() => setProfileView('personal')}>{t('setBarangay')}</button></>}</p>
          {alertsError && <p class="admin-notice" role="alert">{alertsError}</p>}
          {alertsLoading && <LoadingCards label={t('loadingAlerts')} />}
          <div class="alerts-list">
            {!alertsLoading && visibleAlerts.map((item) => <div class={`alert-item alert-item--${item.accent}`} key={item.id}>
              <div class="alert-item__icon">{alertSymbol(item)}</div>
              <div class="alert-item__content">
                <div class="alert-item__topline"><h3>{item.title}</h3><span class="alert-tag">{t(severityKeys[item.severity.replace(' Severity', '')])}</span></div>
                <p>{item.description}</p>
                <small>{item.location}{item.expiresAt ? ` · ${t('expires', { time: new Date(item.expiresAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) })}` : ''}</small>
              </div>
              <div class="alert-item__time">{timeAgo(item.createdAt)}</div>
            </div>)}
            {!alertsLoading && !alertsError && visibleAlerts.length === 0 && <p class="admin-empty-state">{alertFilter === 'warnings' ? t('noWarnings') : t('noAlerts')}</p>}
          </div>
        </div>}

        {activeTab === 'reports' && <MyReports t={t} reports={myReports} queued={queuedReports} loading={reportsLoading} error={reportsError} onWithdraw={withdrawReport} />}

        {activeTab === 'prepare' && <PreparePanel
          t={t}
          family={{ family, onChanged: loadFamily, onToast: pushToast }}
          profile={profile}
          priority={{
            members: priorityMembers,
            onReload: loadPriority,
            onConsented: () => updateProfile({ priority_consent_at: new Date().toISOString() }),
            onWithdrawn: () => { updateProfile({ priority_consent_at: null }); loadPriority() },
            onToast: pushToast,
          }}
        />}
      </div>
      <nav class="footer-controls citizen-tabs" aria-label="Citizen sections" ref={citizenNavRef}>
        <span class="tab-pill" aria-hidden="true" />
        {tabs.map((tab) => <button type="button" key={tab.id} class={activeTab === tab.id ? 'active' : ''} aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => selectTab(tab.id)}>
          <span class="tab-icon"><Icon name={tab.icon} size={18} /></span>
          {tab.label}
          {tab.count > 0 && <b class="tab-badge">{tab.count}</b>}
        </button>)}
      </nav>
    </section>

    {needsTermsAcceptance(profile) && <TermsGate
      lang={lang}
      onToggleLang={() => setLang(lang === 'en' ? 'tl' : 'en')}
      isUpdate={Boolean(profile.terms_version)}
      onSos={() => setDialog('sos')}
      onAccepted={() => updateProfile({ terms_version: LEGAL_VERSION })}
      onSignOut={onSignOut}
    />}
    {!needsTermsAcceptance(profile) && profile?.priority_answered_at === null && <PriorityQuestion
      t={t}
      lang={lang}
      setLang={setLang}
      profile={profile}
      members={priorityMembers}
      onReload={loadPriority}
      onConsented={() => updateProfile({ priority_consent_at: new Date().toISOString() })}
      onAnswered={() => { updateProfile({ priority_answered_at: new Date().toISOString() }); loadPriority() }}
      onSos={() => setDialog('sos')}
      onSignOut={onSignOut}
      onToast={pushToast}
    />}
    {dialog === 'report' && <ReportDialog t={t} ownerId={myId} limit={reportLimitReached(myReports, queuedReports)} onSos={() => setDialog('sos')} hasPhone={Boolean(profile?.phone)} onAddPhone={() => { setDialog(null); setProfileView('personal') }} onClose={() => setDialog(null)} onDone={(result) => {
      setDialog(null)
      setQueuedReports(getQueuedReports(myId))
      pushToast(result === 'queued' ? t('reportQueued') : t('reportSent'), result === 'queued' ? 'info' : 'success')
      if (result === 'sent') loadMyReports()
    }} />}
    {navTarget && <NavigationView
      destination={{ latitude: navTarget.latitude, longitude: navTarget.longitude, name: navTarget.name, location: navTarget.location }}
      points={points}
      initialPosition={userPosition}
      lang={lang}
      notice={navTarget.notice ?? ''}
      onQuickReport={quickReport}
      onClose={() => setNavTarget(null)}
    />}
    {dialog === 'sos' && <SosDialog t={t} livePosition={userPosition} onClose={() => setDialog(null)} onSent={() => {
      setCheckin({ status: 'Need help', updated_at: new Date().toISOString() })
      loadMyReports()
      loadFamily()
    }} />}
    {profileView && <ProfilePage
      role="citizen"
      lang={lang}
      setLang={setLang}
      profile={profile}
      initialView={profileView}
      onProfileSaved={updateProfile}
      onClose={() => setProfileView(null)}
      onSignOut={onSignOut}
      onStartTour={() => setIsTourOpen(true)}
    />}
    {isTourOpen && <Tour
      steps={TOURS.citizen}
      lang={lang}
      prepare={tourPrepare}
      onClose={() => {
        markTourDone('citizen')
        setIsTourOpen(false)
      }}
    />}
    <ToastStack toasts={toasts} onDismiss={dismissToast} />
  </main>
}
