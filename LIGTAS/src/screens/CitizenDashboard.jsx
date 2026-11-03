import { useEffect, useRef, useState } from 'preact/hooks'
import {
  currentUserId,
  getAlerts,
  getEvacuationCenters,
  getMapPoints,
  getMyCheckin,
  getMyProfile,
  getMyReports,
  saveCheckin,
  submitIncidentReport,
  subscribeToTable,
  updateMyProfile,
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
  useTabIndicator,
  useToasts,
} from '../lib/ui.jsx'
import { CitizenMap } from './citizen/CitizenMap.jsx'
import { MyReports } from './citizen/MyReports.jsx'
import { PreparePanel } from './citizen/PreparePanel.jsx'
import { ReportDialog } from './citizen/ReportDialog.jsx'
import { SosDialog } from './citizen/SosDialog.jsx'

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

  // Followed continuously so the person always sees themselves on the map.
  const livePosition = useLivePosition()
  const userPosition = livePosition.position
  const [wantsMyLocation, setWantsMyLocation] = useState(false)
  const isLocating = wantsMyLocation && !userPosition
  const isOutsideArea = Boolean(userPosition) && !isInsideSantaMaria(userPosition.latitude, userPosition.longitude)
  const [focusTarget, setFocusTarget] = useState(null)
  const [dialog, setDialog] = useState(null)

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
      available: Math.max(center.capacity - center.occupants, 0),
    }))
    .sort((a, b) => (userPosition ? (a.distance ?? Infinity) - (b.distance ?? Infinity) : b.available - a.available))
    .slice(0, 3)

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
    } catch (error) {
      pushToast(error.message, 'urgent')
    } finally {
      setIsSavingCheckin(false)
    }
  }

  const saveProfile = async (details) => {
    await updateMyProfile(details)
    setProfile((current) => ({
      ...current,
      display_name: details.displayName.trim() || null,
      barangay: details.barangay.trim() || null,
      phone: details.phone || null,
    }))
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
          {isMapFullscreen ? '⤡' : '▢'}
        </button>
        <button type="button" class="ops-signout" onClick={onSignOut}>{t('signOut')}</button>
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

          {urgentAlert && <button class="alert-banner citizen-sheet-alert" type="button" onClick={() => selectTab('alerts')}>
            <div class="alert-icon">!</div>
            <div><strong>{urgentAlert.title}</strong><span>{urgentAlert.location} · {timeAgo(urgentAlert.createdAt)}</span></div>
          </button>}

          <div class="citizen-stats-row" aria-label="Community safety overview">
            <div class="citizen-sheet-stat stat-blue"><strong><CountUp value={stats.openCenters} /></strong><span>{t('statOpenCenters')}</span></div>
            <div class="citizen-sheet-stat stat-green"><strong><CountUp value={stats.slots} /></strong><span>{t('statSlots')}</span></div>
            <div class="citizen-sheet-stat stat-orange"><strong><CountUp value={stats.sheltered} /></strong><span>{t('statSheltered')}</span></div>
            <div class="citizen-sheet-stat stat-red"><strong><CountUp value={stats.danger} /></strong><span>{t('statDanger')}</span></div>
          </div>

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
                    <div><strong>{center.name}</strong><span>{center.location}{center.distance != null ? ` · ${t('away', { distance: formatDistance(center.distance) })}` : ''}</span></div>
                    <span class={`capacity-chip capacity-chip--${level.level}`}>{t(capacityKeys[level.level])}</span>
                  </div>
                  <div class="evac-progress"><div class="bar" data-level={level.level} style={{ width: `${center.occupants / center.capacity * 100}%` }}></div><div class="counts">{t('capacity', { occupants: center.occupants, capacity: center.capacity })}</div></div>
                  <div class="evac-actions">
                    <a class="evac-navigate" href={directionsUrl(center)} target="_blank" rel="noreferrer"><Icon name="navigate" size={16} /> {t('navigate')}</a>
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
          <p class="section-hint">{profile?.barangay ? t('alertsForArea', { barangay: profile.barangay }) : t('setBarangayHint')}</p>
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

        {activeTab === 'prepare' && <PreparePanel t={t} lang={lang} setLang={setLang} profile={profile} onSaveProfile={saveProfile} />}
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

    {dialog === 'report' && <ReportDialog t={t} ownerId={myId} hasPhone={Boolean(profile?.phone)} onAddPhone={() => { setDialog(null); selectTab('prepare') }} onClose={() => setDialog(null)} onDone={(result) => {
      setDialog(null)
      setQueuedReports(getQueuedReports(myId))
      pushToast(result === 'queued' ? t('reportQueued') : t('reportSent'), result === 'queued' ? 'info' : 'success')
      if (result === 'sent') loadMyReports()
    }} />}
    {dialog === 'sos' && <SosDialog t={t} onClose={() => setDialog(null)} onSent={() => {
      setCheckin({ status: 'Need help', updated_at: new Date().toISOString() })
      loadMyReports()
    }} />}
    <ToastStack toasts={toasts} onDismiss={dismissToast} />
  </main>
}
