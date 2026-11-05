import { useEffect, useRef, useState } from 'preact/hooks'
import L from 'leaflet'
import {
  claimIncidentReport,
  currentUserId,
  getAlerts,
  getEvacuationCenters,
  getMapPoints,
  getReportPhotoUrl,
  getRescuerIncidentReports,
  getStaffProfiles,
  publishAlert,
  releaseIncidentReport,
  resolveIncidentReport,
  shareRescuerLocation,
  stopSharingRescuerLocation,
  subscribeToTable,
  updateIncidentReport,
} from '../lib/supabase.js'
import {
  createLigtasMap,
  drawEvacuationCenters,
  drawMapPoints,
  drawReports,
  drawUserPosition,
  fitToContent,
  mapCenter,
  removeLigtasMap,
  watchMapSize,
} from '../lib/map.js'
import {
  CountUp,
  Icon,
  LoadingCards,
  Logo,
  OfflineBanner,
  ToastStack,
  directionsUrl,
  distanceKm,
  formatDistance,
  playAlertChime,
  reportTypeStyle,
  timeAgo,
  toAlertView,
  useLivePosition,
  useOnlineStatus,
  useTabIndicator,
  useToasts,
} from '../lib/ui.jsx'
import { markTampered, useReportIntegrity } from '../lib/integrity.js'

const priorityRank = { Critical: 0, Urgent: 1, Normal: 2 }
const nextStage = { Assigned: 'En route', 'En route': 'On scene' }

// Most urgent first; within the same priority, the call waiting longest comes first.
function byUrgency(a, b) {
  return (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2)
    || Number(b.vulnerable_people) - Number(a.vulnerable_people)
    || new Date(a.created_at) - new Date(b.created_at)
}

function RescuerSituationMap({ reports, points, centers, myPosition, isFullscreen, onToggleFullscreen }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const layerRef = useRef(null)
  const userLayerRef = useRef(null)
  const fittedCountRef = useRef(0)
  const userMovedRef = useRef(false)

  useEffect(() => {
    if (!mapRef.current) return undefined
    const map = createLigtasMap(mapRef.current, mapCenter, 13)
    mapInstanceRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    // Kept apart so frequent location updates don't redraw every marker.
    userLayerRef.current = L.layerGroup().addTo(map)
    // Keep auto-framing new data until the person pans the map themselves.
    map.on('dragstart', () => { userMovedRef.current = true })
    const stopWatching = watchMapSize(map, mapRef.current)
    return () => {
      stopWatching()
      layerRef.current = null
      userLayerRef.current = null
      mapInstanceRef.current = null
      removeLigtasMap(map)
    }
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    drawMapPoints(layer, points)
    drawEvacuationCenters(layer, centers)
    drawReports(layer, reports)
    const located = reports.filter((report) => report.latitude != null).map((report) => [report.latitude, report.longitude])
    const frame = located.length ? located : points.map((point) => [point.latitude, point.longitude])
    if (!userMovedRef.current && frame.length > fittedCountRef.current) {
      fitToContent(map, frame)
      fittedCountRef.current = frame.length
    }
  }, [reports, points, centers])

  useEffect(() => {
    const layer = userLayerRef.current
    if (!layer) return
    layer.clearLayers()
    drawUserPosition(layer, myPosition)
  }, [myPosition])

  const unlocated = reports.filter((report) => report.latitude == null).length

  return <section class={`ops-map-frame${isFullscreen ? ' is-fullscreen' : ''}`}>
    <div class="map-toolbar">
      <div><strong>Field map</strong><span>{reports.length} open calls{unlocated ? ` · ${unlocated} without GPS (see Calls)` : ''}</span></div>
      <button type="button" class="map-fullscreen-btn" onClick={onToggleFullscreen} aria-label={isFullscreen ? 'Exit full screen map' : 'Open full screen map'}>
        {isFullscreen ? '⤡' : '▢'}
      </button>
    </div>
    <div class="real-map" ref={mapRef} />
    <div class="map-legend">
      <span><i class="legend-red" /> Critical call</span>
      <span><i class="legend-yellow" /> Urgent call</span>
      <span><i class="legend-blue" /> Call / you</span>
      <span><i class="legend-green" /> Evac. center</span>
    </div>
  </section>
}

function CallPhoto({ path }) {
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)
  if (url) return <a class="rx-call-photo" href={url} target="_blank" rel="noreferrer"><img src={url} alt="Photo attached to the report" /></a>
  return <button type="button" class="rx-chip-button" disabled={failed} onClick={() => getReportPhotoUrl(path).then(setUrl).catch(() => setFailed(true))}>
    <Icon name="camera" size={15} /> {failed ? 'Photo unavailable' : 'View photo'}
  </button>
}

// Keeps the screen on while location is shared, so the phone does not lock
// mid-response and stop sending updates. Browsers drop the lock when the tab
// is hidden, so it is requested again when the app comes back.
function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined
    let lock = null
    let cancelled = false
    const request = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock.request('screen')
        .then((sentinel) => { if (cancelled) sentinel.release(); else lock = sentinel })
        .catch(() => {})
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', request)
      lock?.release().catch(() => {})
    }
  }, [active])
}

export function RescuerDashboard({ onSignOut }) {
  const isOnline = useOnlineStatus()
  const [toasts, pushToast, dismissToast] = useToasts()
  const [activeTab, setActiveTab] = useState('calls')
  const [queueView, setQueueView] = useState('open')
  const [myId, setMyId] = useState(null)
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [reportsError, setReportsError] = useState('')
  const [staff, setStaff] = useState([])
  const [points, setPoints] = useState([])
  const [centers, setCenters] = useState([])
  const [updatingReportId, setUpdatingReportId] = useState(null)
  const [resolvingReport, setResolvingReport] = useState(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [confirmReleaseId, setConfirmReleaseId] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [alertsError, setAlertsError] = useState('')
  const [alertFilter, setAlertFilter] = useState('all')
  const [isAlertFormOpen, setIsAlertFormOpen] = useState(false)
  const [isAlertSaving, setIsAlertSaving] = useState(false)
  const [newAlertSeverity, setNewAlertSeverity] = useState('High')
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSharingLocation, setIsSharingLocation] = useState(false)
  const [sharedPosition, setSharedPosition] = useState(null)
  // Shown on the map at all times; uploading it to operations is separate (on duty).
  const livePosition = useLivePosition()
  const myPosition = (isSharingLocation && sharedPosition) || livePosition.position
  const integrity = useReportIntegrity(reports)
  const watchIdRef = useRef(null)
  const lastSharedRef = useRef(0)
  const rescuerNavRef = useTabIndicator(activeTab)
  useWakeLock(isSharingLocation)

  const loadReports = () => getRescuerIncidentReports()
    .then((data) => { setReports(data); setReportsError(''); setLastUpdated(new Date()) })
    .catch((error) => setReportsError(error.message))
    .finally(() => setReportsLoading(false))
  const loadAlerts = () => getAlerts()
    .then((data) => { setAlerts(data.map(toAlertView)); setAlertsError('') })
    .catch((error) => setAlertsError(error.message))
    .finally(() => setAlertsLoading(false))

  useEffect(() => {
    currentUserId().then(setMyId).catch(() => {})
    getStaffProfiles().then(setStaff).catch(() => {})
    getMapPoints().then(setPoints).catch(() => {})
    getEvacuationCenters().then(setCenters).catch(() => {})
    loadReports()
    loadAlerts()

    const unsubscribers = [
      subscribeToTable('incident_reports', (change) => {
        const isNewCall = change.new?.status === 'Verified' && change.old?.status !== 'Verified' && !change.new.assigned_to
        if (isNewCall) {
          const critical = change.new.priority === 'Critical'
          pushToast(`${critical ? 'Critical' : 'New'} call: ${change.new.report_type} · ${change.new.location}`, critical ? 'urgent' : 'info')
          playAlertChime(critical)
        }
        loadReports()
      }),
      subscribeToTable('alerts', (change) => {
        if (change.eventType === 'INSERT' && change.new.severity === 'High') {
          pushToast(`Alert: ${change.new.title}`, 'urgent')
          playAlertChime(true)
        }
        loadAlerts()
      }),
      subscribeToTable('map_points', () => getMapPoints().then(setPoints).catch(() => {})),
      subscribeToTable('evacuation_centers', () => getEvacuationCenters().then(setCenters).catch(() => {})),
    ]
    // Safety net in case the realtime connection drops in the field.
    const timer = setInterval(loadReports, 60000)
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      clearInterval(timer)
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  const toggleLocationSharing = async () => {
    if (isSharingLocation) {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
      setIsSharingLocation(false)
      stopSharingRescuerLocation().catch(() => {})
      pushToast('Location sharing stopped.', 'info')
      return
    }
    if (!navigator.geolocation) {
      pushToast('This device cannot share its location.', 'urgent')
      return
    }
    setIsSharingLocation(true)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const coords = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }
        setSharedPosition(coords)
        // Upload at most every 20 seconds to save battery and data.
        if (Date.now() - lastSharedRef.current > 20000) {
          lastSharedRef.current = Date.now()
          shareRescuerLocation(coords).catch((error) => pushToast(error.message, 'urgent'))
        }
      },
      () => {
        pushToast('Could not get your location. Check location permission.', 'urgent')
        setIsSharingLocation(false)
      },
      { enableHighAccuracy: true, maximumAge: 15000 },
    )
  }

  // Stop sharing first so operations never sees a team that has signed off.
  const signOut = async () => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    watchIdRef.current = null
    if (isSharingLocation) await stopSharingRescuerLocation().catch(() => {})
    onSignOut()
  }

  const refresh = async () => {
    setIsRefreshing(true)
    await Promise.all([loadReports(), loadAlerts()])
    setIsRefreshing(false)
  }

  const applyUpdate = async (reportId, action) => {
    setUpdatingReportId(reportId)
    setReportsError('')
    try {
      const updated = await action()
      setReports((current) => current.map((report) => report.id === reportId ? { ...report, ...updated } : report))
      return true
    } catch (error) {
      setReportsError(error.message)
      return false
    } finally {
      setUpdatingReportId(null)
    }
  }

  const claim = (report) => applyUpdate(report.id, () => claimIncidentReport(report.id)).then((ok) => {
    if (ok) {
      setQueueView('mine')
      pushToast(`You took the ${report.report_type} call.`, 'success')
    }
  })
  const release = async (report) => {
    if (confirmReleaseId !== report.id) {
      setConfirmReleaseId(report.id)
      setTimeout(() => setConfirmReleaseId((current) => current === report.id ? null : current), 4000)
      return
    }
    setConfirmReleaseId(null)
    const ok = await applyUpdate(report.id, async () => {
      await releaseIncidentReport(report.id)
      return { assigned_to: null, response_stage: null, assigned_at: null }
    })
    if (ok) {
      setQueueView('open')
      pushToast(`The ${report.report_type} call is back in the open queue.`, 'info')
    }
  }
  const advance = (report) => applyUpdate(report.id, () => updateIncidentReport(report.id, { response_stage: nextStage[report.response_stage] }))
  const submitResolution = async (event) => {
    event.preventDefault()
    const report = resolvingReport
    const ok = await applyUpdate(report.id, () => resolveIncidentReport(report.id, resolutionNote))
    if (ok) {
      setResolvingReport(null)
      setResolutionNote('')
      pushToast('Call marked as resolved.', 'success')
    }
  }

  const addAlert = async (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setIsAlertSaving(true)
    setAlertsError('')
    try {
      await publishAlert({
        alertType: formData.get('type'),
        severity: formData.get('severity'),
        title: formData.get('title').trim(),
        message: formData.get('description').trim(),
        location: formData.get('location').trim(),
        targetRoles: ['citizen', 'rescuer'],
      })
      setIsAlertFormOpen(false)
      loadAlerts()
    } catch (error) {
      setAlertsError(error instanceof Error ? error.message : 'Could not publish alert.')
    } finally {
      setIsAlertSaving(false)
    }
  }

  const staffName = (id) => staff.find((person) => person.id === id)?.display_name || 'another team'
  const activeReports = reports.filter((report) => report.status === 'Verified')
  const openReports = activeReports.filter((report) => report.assigned_to !== myId).sort(byUrgency)
  const unclaimedCount = activeReports.filter((report) => !report.assigned_to).length
  const myReports = activeReports.filter((report) => myId && report.assigned_to === myId).sort(byUrgency)
  const resolvedReports = reports.filter((report) => report.status === 'Resolved')
    .sort((a, b) => new Date(b.resolved_at ?? b.created_at) - new Date(a.resolved_at ?? a.created_at))
  const visibleReports = queueView === 'mine' ? myReports : queueView === 'resolved' ? resolvedReports : openReports
  const urgentAlerts = alerts.filter((alert) => alert.accent === 'red')
  const visibleAlerts = alertFilter === 'urgent' ? alerts.filter((alert) => alert.severity !== 'Low Severity') : alerts
  const latestUrgentAlert = urgentAlerts[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const myName = staff.find((person) => person.id === myId)?.display_name

  const tabs = [
    { id: 'calls', label: 'Calls', icon: 'calls', count: unclaimedCount },
    { id: 'map', label: 'Map', icon: 'map' },
    { id: 'alerts', label: 'Alerts', icon: 'bell', count: urgentAlerts.length },
  ]

  const renderActions = (report) => {
    const isMine = myId && report.assigned_to === myId
    const isBusy = updatingReportId === report.id
    const navigate = <a class="rx-btn rx-btn--ghost" href={directionsUrl(report)} target="_blank" rel="noreferrer"><Icon name="navigate" size={18} /> Navigate</a>
    if (report.status === 'Resolved') return null
    if (report.assigned_to && !isMine) {
      return <div class="rx-call-actions rx-call-actions--single">{navigate}</div>
    }
    if (!report.assigned_to) {
      return <div class="rx-call-actions">
        {navigate}
        <button type="button" class="rx-btn rx-btn--accent" disabled={isBusy} onClick={() => claim(report)}>
          {isBusy ? <span class="btn-spinner" aria-hidden="true" /> : <Icon name="check" size={18} />} Take this call
        </button>
      </div>
    }
    const stage = report.response_stage ?? 'Assigned'
    return <div class="rx-call-actions">
      {navigate}
      {nextStage[stage]
        ? <button type="button" class="rx-btn rx-btn--stage" disabled={isBusy} onClick={() => advance(report)}>
          {isBusy ? <span class="btn-spinner" aria-hidden="true" /> : <Icon name={stage === 'Assigned' ? 'navigate' : 'pin'} size={18} />}
          {stage === 'Assigned' ? "I'm on the way" : "I'm on scene"}
        </button>
        : <button type="button" class="rx-btn rx-btn--resolve" disabled={isBusy} onClick={() => { setResolvingReport(report); setResolutionNote('') }}>
          <Icon name="check" size={18} /> Mark resolved
        </button>}
      <div class="rx-call-secondary">
        {stage !== 'On scene' && <button type="button" class="rx-link-button" onClick={() => { setResolvingReport(report); setResolutionNote('') }}>Resolve now</button>}
        <button type="button" class={`rx-link-button rx-link-button--muted${confirmReleaseId === report.id ? ' is-confirming' : ''}`} disabled={isBusy} onClick={() => release(report)}>
          {confirmReleaseId === report.id ? 'Tap again to hand back' : "Can't respond? Hand back"}
        </button>
      </div>
    </div>
  }

  return <main class="rx-app">
    <header class="rx-header">
      <a class="rx-brand" href="#rescuer-home" aria-label="LIGTAS rescuer dashboard"><Logo small /><span>LIGTAS <em>Rescue</em></span></a>
      <div class="rx-header-actions">
        <button type="button" class={`rx-duty${isSharingLocation ? ' is-sharing' : ''}`} aria-pressed={isSharingLocation} onClick={toggleLocationSharing} title={isSharingLocation ? 'Stop sharing your location' : 'Share your location with operations'}>
          <i /> {isSharingLocation ? 'Sharing location' : 'Share location'}
        </button>
        <button type="button" class="rx-icon-btn" onClick={signOut} aria-label="Sign out" title="Sign out"><Icon name="logout" /></button>
      </div>
    </header>

    <div class="rx-main" id="rescuer-home">
      <OfflineBanner isOnline={isOnline} label="You are offline. Calls shown may be out of date." />

      {activeTab === 'calls' && <section class={`rx-hero${unclaimedCount === 0 && !reportsLoading ? ' is-clear' : ''}`} aria-live="polite">
        <span class="rx-hero-greeting">{greeting}{myName ? `, ${myName}` : ', rescue team'}</span>
        <div class="rx-hero-count">
          <strong>{reportsLoading ? '–' : <CountUp value={unclaimedCount} />}</strong>
          <span>{reportsLoading ? 'Checking calls…' : unclaimedCount === 0 ? 'All clear. No calls waiting.' : unclaimedCount === 1 ? 'call needs a team' : 'calls need a team'}</span>
        </div>
        <div class="rx-hero-meta">
          <span><Icon name="user" size={14} /> {myReports.length} assigned to you</span>
          <span><Icon name="check" size={14} /> {resolvedReports.length} resolved</span>
          <span><Icon name="bell" size={14} /> {urgentAlerts.length} urgent alerts</span>
        </div>
      </section>}

      {latestUrgentAlert && activeTab === 'calls' && <button type="button" class="rx-alert-strip" onClick={() => setActiveTab('alerts')}>
        <span class="rx-alert-strip-icon"><Icon name="alert" /></span>
        <span class="rx-alert-strip-copy"><strong>{latestUrgentAlert.title}</strong><small>{latestUrgentAlert.location} · {timeAgo(latestUrgentAlert.createdAt)}</small></span>
        <Icon name="arrow" size={18} />
      </button>}

      {activeTab === 'calls' && <section class="rx-panel" aria-labelledby="rx-calls-title">
        <div class="rx-section-head">
          <div><h2 id="rx-calls-title">Response queue</h2><small>{lastUpdated ? `Live · updated ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Loading…'}</small></div>
          <button type="button" class={`rx-icon-btn${isRefreshing ? ' is-spinning' : ''}`} onClick={refresh} disabled={isRefreshing} aria-label="Refresh calls" title="Refresh"><Icon name="refresh" size={18} /></button>
        </div>
        <div class="rx-segment rx-segment--three" role="tablist" aria-label="Call status">
          {[['open', 'Open', openReports.length], ['mine', 'My calls', myReports.length], ['resolved', 'Resolved', resolvedReports.length]].map(([id, label, count]) => (
            <button type="button" role="tab" key={id} aria-selected={queueView === id} class={queueView === id ? 'is-active' : ''} onClick={() => setQueueView(id)}>{label} <b>{count}</b></button>
          ))}
        </div>
        {reportsError && <p class="admin-notice" role="alert">{reportsError}</p>}
        {reportsLoading && <LoadingCards label="Loading verified reports…" />}
        <div class="rx-call-list">
          {!reportsLoading && visibleReports.map((report) => {
            const type = reportTypeStyle(report.report_type)
            const isResolved = report.status === 'Resolved'
            const isMine = myId && report.assigned_to === myId
            const distance = myPosition && report.latitude != null ? distanceKm(myPosition, report) : null
            return <article class={`rx-call rx-tone--${type.tone}${isResolved ? ' is-resolved' : ''}${report.priority === 'Critical' && !isResolved ? ' is-critical' : ''}`} key={report.id}>
              <div class="rx-call-top">
                <span class="rx-type-icon"><Icon name={type.icon} size={22} /></span>
                <div class="rx-call-title">
                  <strong>{report.report_type}</strong>
                  <span><Icon name="clock" size={13} /> {timeAgo(report.created_at)}{distance != null && <> · <Icon name="navigate" size={12} /> {formatDistance(distance)}</>}</span>
                </div>
                {isResolved
                  ? <span class="rx-status rx-status--resolved">Resolved</span>
                  : report.priority !== 'Normal' && <span class={`rx-priority rx-priority--${report.priority.toLowerCase()}`}>{report.priority}</span>}
              </div>
              <p class="rx-call-location"><Icon name="pin" size={18} /><span>{report.location}</span></p>
              {integrity[report.id] === 'tampered' && !isResolved && <p class="integrity-warning" role="alert">
                <Icon name="alert" size={15} /><span><b>Changed outside the app.</b> This call's details don't match what the reporter sent. Confirm with operations before going.</span>
              </p>}
              {report.location_flag && !isResolved && <p class="location-warning" role="note">
                <Icon name="alert" size={15} /><span><b>Check before going:</b> {report.location_flag}. Call the reporter to confirm where they are.</span>
              </p>}
              {(report.people_affected > 0 || report.vulnerable_people) && <div class="rx-call-tags">
                {report.people_affected > 0 && <span><Icon name="users" size={14} /> {report.people_affected} {report.people_affected === 1 ? 'person' : 'people'}</span>}
                {report.vulnerable_people && <span class="is-vulnerable"><Icon name="heart" size={14} /> Children, elderly or PWD</span>}
              </div>}
              {report.notes && <p class="rx-call-notes">{report.notes}</p>}
              {(report.contact_name || report.contact_phone) && !isResolved && <div class="rx-call-contact">
                <span><Icon name="user" size={14} /> {report.contact_name || 'Reporter'}</span>
                {report.contact_phone
                  ? <a href={`tel:${report.contact_phone.replace(/[^+\d]/g, '')}`}><Icon name="phone" size={15} /> Call {report.contact_phone}</a>
                  : <small>No phone number given</small>}
              </div>}
              {report.photo_path && <CallPhoto path={report.photo_path} />}
              {report.assigned_to && !isResolved && <p class={`rx-assignment${isMine ? ' is-mine' : ''}`}>
                <Icon name="user" size={14} /> {isMine ? 'You' : staffName(report.assigned_to)} · {report.response_stage ?? 'Assigned'}{report.assigned_at ? ` · ${timeAgo(report.assigned_at)}` : ''}
              </p>}
              {isResolved && report.resolution_note && <p class="rx-resolution"><b>Resolution:</b> {report.resolution_note}</p>}
              {renderActions(report)}
            </article>
          })}
          {!reportsLoading && visibleReports.length === 0 && <div class="rx-empty">
            <span class="rx-empty-icon"><Icon name={queueView === 'resolved' ? 'calls' : 'shield'} size={28} /></span>
            <strong>{queueView === 'resolved' ? 'No resolved calls yet' : queueView === 'mine' ? 'No calls assigned to you' : 'All clear'}</strong>
            <p>{queueView === 'resolved' ? 'Calls you resolve will appear here.' : queueView === 'mine' ? 'Take a call from the Open list to start responding.' : 'There are no verified reports waiting for a response. New calls appear here automatically.'}</p>
          </div>}
        </div>
      </section>}

      {activeTab === 'map' && <section class="rx-panel rx-map">
        <RescuerSituationMap
          reports={markTampered(activeReports, integrity)}
          points={points}
          centers={centers}
          myPosition={myPosition}
          isFullscreen={isMapFullscreen}
          onToggleFullscreen={() => setIsMapFullscreen((value) => !value)}
        />
      </section>}

      {activeTab === 'alerts' && <section class="rx-panel" aria-labelledby="rx-alerts-title">
        <div class="rx-section-head">
          <div><h2 id="rx-alerts-title">Situation alerts</h2><small>{alerts.length} active updates</small></div>
          <button type="button" class="rx-btn rx-btn--accent" onClick={() => { setAlertsError(''); setIsAlertFormOpen(true) }}><Icon name="plus" size={18} /> New alert</button>
        </div>
        <div class="rx-segment" role="tablist" aria-label="Alert filter">
          <button type="button" role="tab" aria-selected={alertFilter === 'all'} class={alertFilter === 'all' ? 'is-active' : ''} onClick={() => setAlertFilter('all')}>All <b>{alerts.length}</b></button>
          <button type="button" role="tab" aria-selected={alertFilter === 'urgent'} class={alertFilter === 'urgent' ? 'is-active' : ''} onClick={() => setAlertFilter('urgent')}>Warnings <b>{alerts.filter((alert) => alert.severity !== 'Low Severity').length}</b></button>
        </div>
        {alertsError && !isAlertFormOpen && <p class="admin-notice" role="alert">{alertsError}</p>}
        {alertsLoading && <LoadingCards label="Loading alerts…" />}
        <div class="rx-alert-list">
          {!alertsLoading && visibleAlerts.map((alert) => <article class={`rx-alert rx-alert--${alert.accent}`} key={alert.id}>
            <span class="rx-alert-icon"><Icon name={alert.accent === 'blue' ? 'bell' : 'alert'} size={20} /></span>
            <div>
              <div class="rx-alert-title"><h3>{alert.title}</h3><span>{alert.severity.replace(' Severity', '')}</span></div>
              <p>{alert.description}</p>
              <small><Icon name="pin" size={13} /> {alert.location} · {timeAgo(alert.createdAt)}</small>
            </div>
          </article>)}
          {!alertsLoading && !alertsError && visibleAlerts.length === 0 && <div class="rx-empty">
            <span class="rx-empty-icon"><Icon name="bell" size={28} /></span>
            <strong>No alerts right now</strong>
            <p>Published alerts for your area will show up here.</p>
          </div>}
        </div>
      </section>}
    </div>

    {resolvingReport && <div class="alert-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget && !updatingReportId) setResolvingReport(null) }}>
      <section class="alert-modal rx-resolve-dialog" role="dialog" aria-modal="true" aria-labelledby="resolve-title">
        <div class="alert-modal-heading"><div><span class="ops-eyebrow">{resolvingReport.report_type} · {resolvingReport.location}</span><h2 id="resolve-title">Resolve this call</h2></div><button type="button" class="alert-modal-close" aria-label="Close" onClick={() => setResolvingReport(null)}>×</button></div>
        <form class="alert-form" onSubmit={submitResolution}>
          <label>What was done? (optional)<textarea rows="3" maxLength="500" value={resolutionNote} onInput={(event) => setResolutionNote(event.currentTarget.value)} placeholder="e.g. 2 residents evacuated to Catmon ES, road cleared" autoFocus /></label>
          <div class="rx-quick-notes">
            {['Residents evacuated', 'Road cleared', 'Patient brought to hospital', 'No action needed'].map((text) => <button type="button" key={text} onClick={() => setResolutionNote((current) => current ? `${current}. ${text}` : text)}>{text}</button>)}
          </div>
          {reportsError && <p class="form-error" role="alert">{reportsError}</p>}
          <div class="alert-form-actions"><button type="button" class="alert-cancel-button" onClick={() => setResolvingReport(null)}>Cancel</button><button type="submit" class="add-alert-button" disabled={Boolean(updatingReportId)}>{updatingReportId && <span class="btn-spinner" aria-hidden="true" />}Mark resolved</button></div>
        </form>
      </section>
    </div>}

    {isAlertFormOpen && <div class="alert-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setIsAlertFormOpen(false) }}>
      <section class="alert-modal" role="dialog" aria-modal="true" aria-labelledby="alert-form-title">
        <div class="alert-modal-heading"><div><span class="ops-eyebrow">Situation update</span><h2 id="alert-form-title">New alert</h2></div><button type="button" class="alert-modal-close" aria-label="Close alert form" onClick={() => setIsAlertFormOpen(false)}>×</button></div>
        <form class="alert-form" onSubmit={addAlert}>
          <label>Alert type<select name="type" required defaultValue="Flood"><option>Flood</option><option>Severe weather</option><option>Landslide</option><option>Road closure</option><option>Other</option></select></label>
          <label>Alert title<input name="title" required minLength="2" maxLength="80" placeholder="e.g. Road access blocked" /></label>
          <label>Severity<select name="severity" required value={newAlertSeverity} onChange={(event) => setNewAlertSeverity(event.currentTarget.value)}><option>Low</option><option>Moderate</option><option>High</option></select></label>
          <label>Location<input name="location" required minLength="2" maxLength="160" placeholder="Barangay or affected area" /></label>
          <label>Details<textarea name="description" required maxLength="1000" rows="4" placeholder="Describe the hazard and any response guidance" /></label>
          {alertsError && <p class="form-error" role="alert">{alertsError}</p>}
          <div class="alert-form-actions"><button type="button" class="alert-cancel-button" onClick={() => setIsAlertFormOpen(false)}>Cancel</button><button type="submit" class="add-alert-button" disabled={isAlertSaving}>{isAlertSaving && <span class="btn-spinner" aria-hidden="true" />}{isAlertSaving ? 'Publishing…' : 'Publish alert'}</button></div>
        </form>
      </section>
    </div>}

    <nav class="rx-tabbar" aria-label="Rescuer sections" ref={rescuerNavRef}>
      <span class="tab-pill" aria-hidden="true" />
      {tabs.map((tab) => <button type="button" key={tab.id} class={activeTab === tab.id ? 'active' : ''} aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => setActiveTab(tab.id)}>
        <span class="rx-tab-icon"><Icon name={tab.icon} size={22} /></span>
        {tab.label}
        {tab.count > 0 && <b class="rx-tab-badge">{tab.count}</b>}
      </button>)}
    </nav>
    <ToastStack toasts={toasts} onDismiss={dismissToast} />
  </main>
}
