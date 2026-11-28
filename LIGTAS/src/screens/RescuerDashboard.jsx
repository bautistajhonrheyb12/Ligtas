import { useEffect, useRef, useState } from 'preact/hooks'
import L from 'leaflet'
import {
  addFieldNote,
  claimIncidentReport,
  currentUserId,
  getAlerts,
  getEvacuationCenters,
  getFieldNotes,
  getMapPoints,
  getMyProfile,
  getRescuerActivity,
  getRescuerIncidentReports,
  getRescuerStatuses,
  getStaffProfiles,
  publishAlert,
  releaseIncidentReport,
  resolveIncidentReport,
  setMyAvailability,
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
  removeLigtasMap,
  watchMapSize,
} from '../lib/map.js'
import {
  CountUp,
  Icon,
  LoadingCards,
  Logo,
  MapFullscreenButton,
  OfflineBanner,
  ToastStack,
  directionsUrl,
  isCurrentAlert,
  playAlertChime,
  reportTypeLabel,
  timeAgo,
  toAlertView,
  alertIcon,
  alertTypeLabel,
  useFullscreenMap,
  useLivePosition,
  useAlertClock,
  useOnlineStatus,
  useRefreshOnReturn,
  useTabIndicator,
  useToasts,
  useWakeLock,
} from '../lib/ui.jsx'
import {
  DEFAULT_CALL_FILTERS,
  RESCUE_OUTCOMES,
  availabilityOf,
  buildNotifications,
  byUrgency,
  filterCalls,
  readNotices,
  readNotificationIds,
  saveNotices,
  saveNotificationIds,
} from '../lib/rescue.js'
import { markTampered, useReportIntegrity } from '../lib/integrity.js'
import { NavigationView } from '../components/NavigationView.jsx'
import { useConfirm } from '../components/ConfirmDialog.jsx'
import { placeReport } from '../lib/callLocation.js'
import { CallSheet } from './rescuer/CallSheet.jsx'
import { CallCard } from './rescuer/CallCard.jsx'
import { ActiveOps } from './rescuer/ActiveOps.jsx'
import { RescueHistory } from './rescuer/RescueHistory.jsx'
import { NotificationBell } from './rescuer/Notifications.jsx'
import { AvailabilityPicker } from './rescuer/Availability.jsx'
import { NotificationPrompt } from '../components/PhoneSetup.jsx'
import { ProfileButton, ProfilePage } from '../components/Profile.jsx'
import { AlertTypeField, alertTypeProblem } from '../components/AlertFields.jsx'
import { syncPush } from '../lib/push.js'
import { Tour } from '../components/Tour.jsx'
import { TOURS, markTourDone, tourDone } from '../lib/tours.js'

const nextStage = { Assigned: 'En route', 'En route': 'On scene' }
const URGENCY_FILTERS = [['all', 'All'], ['Critical', 'Critical'], ['Urgent', 'Urgent'], ['Normal', 'Normal']]

function RescuerSituationMap({ reports, points, centers, myPosition, isFullscreen, onToggleFullscreen, selectedId, onSelect, children }) {
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const layerRef = useRef(null)
  const userLayerRef = useRef(null)
  const fittedCountRef = useRef(0)
  const userMovedRef = useRef(false)

  useEffect(() => {
    if (!mapRef.current) return undefined
    // Zoom buttons at the top left, clear of the call details card.
    const map = createLigtasMap(mapRef.current, null, 13, { zoomPosition: 'topleft' })
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
    drawReports(layer, reports, { selectedId, onSelect: (report) => onSelectRef.current?.(report) })
    const located = reports.filter((report) => report.latitude != null).map((report) => [report.latitude, report.longitude])
    const frame = located.length ? located : points.map((point) => [point.latitude, point.longitude])
    if (!userMovedRef.current && frame.length > fittedCountRef.current) {
      fitToContent(map, frame)
      fittedCountRef.current = frame.length
    }
  }, [reports, points, centers, selectedId])

  // The selected call is brought into view where the call details do not
  // cover it: above them on phones, beside them on wider screens.
  const selected = reports.find((report) => report.id === selectedId)
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !selected || selected.latitude == null) return
    userMovedRef.current = true
    const zoom = Math.max(map.getZoom(), 16)
    const size = map.getSize()
    const offset = window.matchMedia('(min-width: 900px)').matches ? L.point(190, 0) : L.point(0, size.y * 0.27)
    const center = map.unproject(map.project([selected.latitude, selected.longitude], zoom).add(offset), zoom)
    map.flyTo(center, zoom, { duration: 0.6 })
  }, [selectedId, selected?.latitude, selected?.longitude])

  useEffect(() => {
    const layer = userLayerRef.current
    if (!layer) return
    layer.clearLayers()
    drawUserPosition(layer, myPosition)
  }, [myPosition])

  const unlocated = reports.filter((report) => report.latitude == null).length
  useFullscreenMap(isFullscreen, onToggleFullscreen)

  return <section class={`ops-map-frame${isFullscreen ? ' is-fullscreen' : ''}`}>
    <div class="map-toolbar">
      <div><strong>Field map</strong><span>{reports.length} open calls{unlocated ? ` · ${unlocated} without GPS (see Calls)` : ''} · tap a call for details</span></div>
      <MapFullscreenButton isFullscreen={isFullscreen} onToggle={onToggleFullscreen} />
    </div>
    <div class="real-map" ref={mapRef} />
    {children}
    <div class="map-legend">
      <span><i class="legend-red" /> Critical call</span>
      <span><i class="legend-yellow" /> Urgent call</span>
      <span><i class="legend-blue" /> Call / you</span>
      <span><i class="legend-priority" /> Priority household</span>
      <span><i class="legend-official" /> Official evac. center</span>
      <span><i class="legend-temporary" /> Temporary evac. site</span>
    </div>
  </section>
}

export function RescuerDashboard({ onSignOut, canStartTour = true }) {
  const isOnline = useOnlineStatus()
  const [toasts, pushToast, dismissToast] = useToasts()
  const [activeTab, setActiveTab] = useState('calls')
  const [myId, setMyId] = useState(null)
  const myIdRef = useRef(null)
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [reportsError, setReportsError] = useState('')
  const [staff, setStaff] = useState([])
  const [points, setPoints] = useState([])
  const [centers, setCenters] = useState([])
  const [updatingReportId, setUpdatingReportId] = useState(null)
  const [resolvingReport, setResolvingReport] = useState(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [resolutionOutcome, setResolutionOutcome] = useState('')
  const [resolveError, setResolveError] = useState('')
  const [confirm, confirmDialog] = useConfirm()
  // Filters for the open calls.
  const [filters, setFilters] = useState(DEFAULT_CALL_FILTERS)
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  // On phones the status, distance and sort menus fold away under "Filters".
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  // Availability of every rescuer (yours is set here, seen by operations).
  const [statuses, setStatuses] = useState([])
  const [availabilitySaving, setAvailabilitySaving] = useState('')
  const [availabilityError, setAvailabilityError] = useState('')
  // Field notes by call id (undefined: not loaded yet).
  const [notes, setNotes] = useState({})
  // Recent assignments, notes and priority changes, for notifications.
  const [activity, setActivity] = useState([])
  const [notices, setNotices] = useState([])
  const [readIds, setReadIds] = useState([])
  // Calls this person just took or returned: their own change is not news to
  // them. Marked for 20 seconds, long enough for the live update to arrive.
  const selfChangesRef = useRef(new Map())
  const markSelfChange = (id) => selfChangesRef.current.set(id, Date.now())
  const isSelfChange = (id) => Date.now() - (selfChangesRef.current.get(id) ?? 0) < 20000
  // The call being navigated to, if any.
  const [navTarget, setNavTarget] = useState(null)
  // The call picked on the field map.
  const [selectedCallId, setSelectedCallId] = useState(null)
  const showOnMap = (report) => {
    setSelectedCallId(report.id)
    setActiveTab('map')
  }
  const [allAlerts, setAlerts] = useState([])
  // Only alerts that have not ended; an alert disappears at its end time.
  const alertClock = useAlertClock(allAlerts)
  const alerts = allAlerts.filter((alert) => isCurrentAlert(alert, alertClock))
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [alertsError, setAlertsError] = useState('')
  const [alertFilter, setAlertFilter] = useState('all')
  const [isAlertFormOpen, setIsAlertFormOpen] = useState(false)
  const [isAlertSaving, setIsAlertSaving] = useState(false)
  const [newAlertSeverity, setNewAlertSeverity] = useState('High')
  const [newAlertType, setNewAlertType] = useState('Flood')
  const [newAlertTypeOther, setNewAlertTypeOther] = useState('')
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
  // Keeps this phone's notifications (if turned on) linked to this sign-in.
  useEffect(() => { syncPush('en') }, [])
  // The profile (name, password, notifications, help, sign out).
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [avatarPath, setAvatarPath] = useState(null)
  useEffect(() => {
    getMyProfile().then((profile) => {
      setProfileName(profile.display_name ?? '')
      setAvatarPath(profile.avatar_path ?? null)
    }).catch(() => {})
  }, [])
  const profileSaved = (changes) => {
    if ('display_name' in changes) setProfileName(changes.display_name ?? '')
    if ('avatar_path' in changes) setAvatarPath(changes.avatar_path)
  }
  // The guided tour: shown once, after the terms are accepted and the calls
  // have loaded, and again from the profile's How to use LIGTAS.
  const [isTourOpen, setIsTourOpen] = useState(false)
  useEffect(() => {
    if (!canStartTour || reportsLoading || navTarget || isProfileOpen || isTourOpen || tourDone('rescuer')) return undefined
    const timer = setTimeout(() => setIsTourOpen(true), 900)
    return () => clearTimeout(timer)
  }, [canStartTour, reportsLoading, navTarget, isProfileOpen])
  const tourPrepare = {
    calls: () => { setActiveTab('calls'); setSelectedCallId(null) },
    active: () => { setActiveTab('active'); setSelectedCallId(null) },
  }

  const loadReports = () => getRescuerIncidentReports()
    .then((data) => { setReports(data.map(placeReport)); setReportsError(''); setLastUpdated(new Date()) })
    .catch((error) => setReportsError(error.message))
    .finally(() => setReportsLoading(false))
  const loadAlerts = () => getAlerts()
    .then((data) => { setAlerts(data.map(toAlertView)); setAlertsError('') })
    .catch((error) => setAlertsError(error.message))
    .finally(() => setAlertsLoading(false))
  const loadStatuses = () => getRescuerStatuses().then(setStatuses).catch(() => {})
  const loadActivity = () => getRescuerActivity().then(setActivity).catch(() => {})
  const loadNotes = (ids) => {
    const wanted = [...new Set(ids)].filter(Boolean)
    if (!wanted.length) return Promise.resolve()
    return getFieldNotes(wanted)
      .then((rows) => setNotes((current) => {
        const next = { ...current }
        wanted.forEach((id) => { next[id] = [] })
        rows.forEach((row) => { next[row.report_id].push(row) })
        return next
      }))
      .catch(() => setNotes((current) => {
        const next = { ...current }
        wanted.forEach((id) => { if (next[id] === undefined) next[id] = [] })
        return next
      }))
  }
  // Catches up on anything missed while the phone had LIGTAS in the background.
  useRefreshOnReturn(() => {
    loadReports()
    loadAlerts()
    loadStatuses()
    loadActivity()
    getMapPoints().then(setPoints).catch(() => {})
    getEvacuationCenters().then(setCenters).catch(() => {})
  })

  // A change to one of your calls that the data no longer shows afterwards.
  const addNotice = (notice) => setNotices((current) => {
    const next = [notice, ...current.filter((item) => item.id !== notice.id)].slice(0, 30)
    saveNotices(myIdRef.current, next)
    return next
  })

  useEffect(() => {
    currentUserId().then((id) => {
      myIdRef.current = id
      setMyId(id)
      setReadIds(readNotificationIds(id))
      setNotices(readNotices(id))
    }).catch(() => {})
    getStaffProfiles().then(setStaff).catch(() => {})
    getMapPoints().then(setPoints).catch(() => {})
    getEvacuationCenters().then(setCenters).catch(() => {})
    loadReports()
    loadAlerts()
    loadStatuses()
    loadActivity()

    const unsubscribers = [
      subscribeToTable('incident_reports', (change) => {
        const me = myIdRef.current
        const isNewCall = change.new?.status === 'Verified' && change.old?.status !== 'Verified' && !change.new.assigned_to
        if (isNewCall) {
          const critical = change.new.priority === 'Critical'
          pushToast(`${critical ? 'Critical' : 'New'} call: ${reportTypeLabel(change.new)} · ${change.new.location}`, critical ? 'urgent' : 'info')
          playAlertChime(critical)
        }
        if (me && change.new?.assigned_to === me && change.old?.assigned_to !== me && !isSelfChange(change.new.id)) {
          pushToast(`Assigned to you: ${reportTypeLabel(change.new)} · ${change.new.location}`, 'urgent')
          playAlertChime(true)
        }
        if (me && change.old?.assigned_to === me && change.new?.assigned_to !== me && change.new?.status === 'Verified' && !isSelfChange(change.new.id)) {
          addNotice({
            id: `moved:${change.new.id}:${Date.now()}`,
            kind: 'update',
            title: `Taken off your call: ${reportTypeLabel(change.new)}`,
            detail: `${change.new.location} · ${change.new.assigned_to ? 'given to another team' : 'back in the open queue'} by operations`,
            at: new Date().toISOString(),
            callId: change.new.id,
          })
          pushToast(`Operations moved the ${reportTypeLabel(change.new)} call off your list.`, 'info')
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
      subscribeToTable('rescuer_status', loadStatuses),
      // Field notes and assignments (rescuers can read the activity of the calls they see).
      subscribeToTable('report_events', (change) => {
        loadActivity()
        if (change.new?.action === 'Field note' && change.new.report_id) loadNotes([change.new.report_id])
      }),
    ]
    // Safety net in case the realtime connection drops in the field.
    const timer = setInterval(() => { loadReports(); loadActivity() }, 60000)
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
    await Promise.all([loadReports(), loadAlerts(), loadStatuses(), loadActivity()])
    setIsRefreshing(false)
  }

  const staffName = (id) => staff.find((person) => person.id === id)?.display_name || 'another team'
  const activeReports = reports.filter((report) => report.status === 'Verified')
  const openReports = activeReports.filter((report) => report.assigned_to !== myId)
  const unclaimedCount = activeReports.filter((report) => !report.assigned_to).length
  const myReports = activeReports.filter((report) => myId && report.assigned_to === myId).sort(byUrgency)
  const resolvedReports = reports.filter((report) => report.status === 'Resolved')
  const visibleCalls = filterCalls(openReports, filters, { myPosition })
  const filtersChanged = JSON.stringify({ ...filters, sort: 'urgency' }) !== JSON.stringify(DEFAULT_CALL_FILTERS)
  const moreFiltersSet = ['team', 'within', 'sort'].filter((key) => filters[key] !== DEFAULT_CALL_FILTERS[key]).length
  // Only open calls with a position can be shown on the field map.
  const selectedCall = activeReports.find((report) => report.id === selectedCallId && report.latitude != null) ?? null
  const urgentAlerts = alerts.filter((alert) => alert.accent === 'red')
  const visibleAlerts = alertFilter === 'urgent' ? alerts.filter((alert) => alert.severity !== 'Low Severity') : alerts
  const latestUrgentAlert = urgentAlerts[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const myName = staff.find((person) => person.id === myId)?.display_name
  const myStatus = availabilityOf(statuses, myId)

  // Field notes for your active calls, kept current.
  const myCallIds = myReports.map((report) => report.id).join(',')
  useEffect(() => {
    if (myCallIds) loadNotes(myCallIds.split(','))
  }, [myCallIds])

  // ---------- Availability ----------
  const changeAvailability = async (availability, { quiet = false } = {}) => {
    setAvailabilitySaving(availability)
    setAvailabilityError('')
    try {
      const saved = await setMyAvailability(availability)
      setStatuses((current) => [...current.filter((status) => status.rescuer_id !== saved.rescuer_id), saved])
      if (!quiet) pushToast(`Operations now sees you as ${availability.toLowerCase()}.`, 'success')
    } catch (error) {
      if (!quiet) setAvailabilityError(error.message)
    } finally {
      setAvailabilitySaving('')
    }
  }
  // Taking a call makes you Responding; finishing your last one makes you
  // Available again (unless you set yourself Unavailable meanwhile).
  const respondingNow = () => { if (myStatus?.availability !== 'Responding') changeAvailability('Responding', { quiet: true }) }
  const maybeAvailable = (finishedId) => {
    const others = myReports.filter((report) => report.id !== finishedId)
    if (!others.length && myStatus?.availability === 'Responding') changeAvailability('Available', { quiet: true })
  }

  // ---------- Notifications ----------
  const notifications = buildNotifications({ calls: reports, alerts, events: activity, notices, myId, staffName, typeLabel: reportTypeLabel })
  const markRead = (ids) => setReadIds((current) => {
    const next = [...new Set([...current, ...ids])]
    saveNotificationIds(myIdRef.current, next)
    return next
  })
  const openNotification = (item) => {
    markRead([item.id])
    if (item.kind === 'alert') {
      setActiveTab('alerts')
      return
    }
    const call = reports.find((report) => report.id === item.callId)
    if (!call || call.status !== 'Verified') {
      pushToast('That call is no longer open.', 'info')
      return
    }
    const tab = call.assigned_to === myId ? 'active' : 'calls'
    if (tab === 'calls') setFilters({ ...DEFAULT_CALL_FILTERS, team: 'all' })
    setActiveTab(tab)
    setTimeout(() => document.querySelector(`[data-call-id="${call.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120)
  }

  // ---------- Call actions ----------
  const applyUpdate = async (reportId, action) => {
    setUpdatingReportId(reportId)
    setReportsError('')
    try {
      const updated = await action()
      setReports((current) => current.map((report) => report.id === reportId ? placeReport({ ...report, ...updated }) : report))
      return true
    } catch (error) {
      setReportsError(error.message)
      return false
    } finally {
      setUpdatingReportId(null)
    }
  }

  const claim = async (report) => {
    markSelfChange(report.id)
    setUpdatingReportId(report.id)
    try {
      const updated = await claimIncidentReport(report.id)
      setReports((current) => current.map((item) => item.id === report.id ? placeReport({ ...item, ...updated }) : item))
      markRead([`call:${report.id}`])
      pushToast(`You took the ${reportTypeLabel(report)} call. It is in Active.`, 'success')
      respondingNow()
      setActiveTab('active')
    } catch (error) {
      selfChangesRef.current.delete(report.id)
      // Usually another team was faster: say so (a toast, so the refreshed
      // queue below does not wipe it), then show the queue as it is now.
      pushToast(error.message, 'urgent')
      loadReports()
    } finally {
      setUpdatingReportId(null)
    }
  }
  const release = async (report) => {
    const sure = await confirm({
      title: `Return this ${report.report_type === 'SOS' ? 'SOS' : reportTypeLabel(report).toLowerCase()} call?`,
      message: 'It goes back to the open queue so another team can take it. Do this only if you cannot respond.',
      confirmLabel: 'Return the call',
      tone: 'warning',
      icon: 'refresh',
    })
    if (!sure) return
    markSelfChange(report.id)
    const ok = await applyUpdate(report.id, async () => {
      await releaseIncidentReport(report.id)
      return { assigned_to: null, response_stage: null, assigned_at: null }
    })
    if (ok) {
      pushToast(`The ${reportTypeLabel(report)} call is back in the open queue.`, 'info')
      maybeAvailable(report.id)
    }
  }
  // Navigating to your own call keeps its stage up to date for operations:
  // starting marks it "En route", and arrival offers "On scene".
  const isMyCall = (report) => report && myId && report.assigned_to === myId && report.status === 'Verified'
  const startedNavigation = (report) => {
    if (isMyCall(report) && report.response_stage === 'Assigned') {
      applyUpdate(report.id, () => updateIncidentReport(report.id, { response_stage: 'En route' }))
        .then((ok) => ok && pushToast('Marked en route.', 'success'))
    }
  }
  const markOnScene = async (report) => {
    const ok = await applyUpdate(report.id, () => updateIncidentReport(report.id, { response_stage: 'On scene' }))
    if (!ok) throw new Error('Could not mark the call on scene. Try again from Active.')
    pushToast('Marked on scene.', 'success')
  }
  // The call being navigated to, with its latest stage.
  const navReport = navTarget && (reports.find((report) => report.id === navTarget.id) ?? navTarget)
  const advance = (report) => applyUpdate(report.id, () => updateIncidentReport(report.id, { response_stage: nextStage[report.response_stage ?? 'Assigned'] }))
    .then((ok) => ok && pushToast(`Marked ${nextStage[report.response_stage ?? 'Assigned'].toLowerCase()}.`, 'success'))
  const openResolve = (report) => {
    setResolvingReport(report)
    setResolutionNote('')
    setResolutionOutcome('')
    setResolveError('')
  }
  const submitResolution = async (event) => {
    event.preventDefault()
    const report = resolvingReport
    if (!resolutionOutcome) {
      setResolveError('Choose what came of this call.')
      return
    }
    setResolveError('')
    const ok = await applyUpdate(report.id, () => resolveIncidentReport(report.id, resolutionNote, resolutionOutcome))
    if (ok) {
      setResolvingReport(null)
      setResolutionNote('')
      setResolutionOutcome('')
      pushToast('Call marked as resolved. It is in History.', 'success')
      maybeAvailable(report.id)
    }
  }
  const saveFieldNote = async (reportId, note) => {
    await addFieldNote(reportId, note)
    await loadNotes([reportId])
  }

  const addAlert = async (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const typeProblem = alertTypeProblem(newAlertType, newAlertTypeOther)
    if (typeProblem) {
      setAlertsError(typeProblem)
      return
    }
    setIsAlertSaving(true)
    setAlertsError('')
    try {
      await publishAlert({
        alertType: newAlertType,
        alertTypeOther: newAlertType === 'Other' ? newAlertTypeOther.trim() : null,
        severity: formData.get('severity'),
        title: formData.get('title').trim(),
        message: formData.get('description').trim(),
        location: formData.get('location').trim(),
        targetRoles: ['citizen', 'rescuer'],
      })
      setIsAlertFormOpen(false)
      setNewAlertType('Flood')
      setNewAlertTypeOther('')
      loadAlerts()
    } catch (error) {
      setAlertsError(error instanceof Error ? error.message : 'Could not publish alert.')
    } finally {
      setIsAlertSaving(false)
    }
  }

  const tabs = [
    { id: 'calls', label: 'Calls', icon: 'calls', count: unclaimedCount },
    { id: 'active', label: 'Active', icon: 'navigate', count: myReports.length, tone: 'info' },
    { id: 'map', label: 'Map', icon: 'map' },
    { id: 'history', label: 'History', icon: 'history' },
    { id: 'alerts', label: 'Alerts', icon: 'bell', count: urgentAlerts.length },
  ]

  const renderActions = (report) => {
    const isMine = myId && report.assigned_to === myId
    const isBusy = updatingReportId === report.id
    // In-app road navigation when the call has GPS; Google Maps by address otherwise.
    const navigate = report.latitude != null
      ? <button type="button" class="rx-btn rx-btn--ghost" onClick={() => setNavTarget(report)}><Icon name="navigate" size={18} /> Navigate</button>
      : <a class="rx-btn rx-btn--ghost" href={directionsUrl(report)} target="_blank" rel="noreferrer"><Icon name="navigate" size={18} /> Navigate</a>
    if (report.status === 'Resolved') return null
    if (report.assigned_to && !isMine) {
      return <div class="rx-call-actions rx-call-actions--single">{navigate}</div>
    }
    if (!report.assigned_to) {
      return <div class="rx-call-actions">
        {navigate}
        <button type="button" class="rx-btn rx-btn--accent" disabled={isBusy} onClick={() => claim(report)}>
          {isBusy ? <span class="btn-spinner" aria-hidden="true" /> : <Icon name="check" size={18} />} Accept this call
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
        : <button type="button" class="rx-btn rx-btn--resolve" disabled={isBusy} onClick={() => openResolve(report)}>
          <Icon name="check" size={18} /> Mark resolved
        </button>}
      <div class="rx-call-secondary">
        {stage !== 'On scene' && <button type="button" class="rx-link-button" onClick={() => openResolve(report)}>Resolve now</button>}
        <button type="button" class="rx-link-button rx-link-button--muted" disabled={isBusy} onClick={() => release(report)}>
          Unable to respond? Return the call
        </button>
      </div>
    </div>
  }

  const liveLine = <small>{lastUpdated ? `Live · updated ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Loading…'}</small>
  const refreshButton = <button type="button" class={`rx-icon-btn${isRefreshing ? ' is-spinning' : ''}`} onClick={refresh} disabled={isRefreshing} aria-label="Refresh calls" title="Refresh"><Icon name="refresh" size={18} /></button>

  return <main class="rx-app">
    <header class="rx-header">
      <a class="rx-brand" href="#rescuer-home" aria-label="LIGTAS rescuer dashboard"><Logo small /><span>LIGTAS <em>Rescue</em></span></a>
      <div class="rx-header-actions">
        <button type="button" class={`rx-duty${isSharingLocation ? ' is-sharing' : ''}`} aria-pressed={isSharingLocation} onClick={toggleLocationSharing} title={isSharingLocation ? 'Stop sharing your location' : 'Share your location with operations'}>
          <i /> <span class="rx-duty-long">{isSharingLocation ? 'Sharing location' : 'Share location'}</span><span class="rx-duty-short">{isSharingLocation ? 'Sharing' : 'Location'}</span>
        </button>
        <NotificationBell items={notifications} readIds={readIds} onOpen={openNotification} onMarkAllRead={() => markRead(notifications.map((item) => item.id))} />
        <ProfileButton role="rescuer" name={profileName || myName} photoPath={avatarPath} onClick={() => setIsProfileOpen(true)} />
      </div>
    </header>
    {isProfileOpen && <ProfilePage
      role="rescuer"
      onProfileSaved={profileSaved}
      onClose={() => setIsProfileOpen(false)}
      onSignOut={signOut}
      onStartTour={() => setIsTourOpen(true)}
    />}

    <div class="rx-main" id="rescuer-home">
      <OfflineBanner isOnline={isOnline} label="You are offline. Calls shown may be out of date." />
      {activeTab === 'calls' && <NotificationPrompt role="rescuer" />}

      {activeTab === 'calls' && <section class={`rx-hero${unclaimedCount === 0 && !reportsLoading ? ' is-clear' : ''}`} aria-live="polite">
        <span class="rx-hero-greeting">{greeting}{(profileName || myName) ? `, ${profileName || myName}` : ', rescue team'}</span>
        <div class="rx-hero-count">
          <strong>{reportsLoading ? '–' : <CountUp value={unclaimedCount} />}</strong>
          <span>{reportsLoading ? 'Checking calls…' : unclaimedCount === 0 ? 'All clear. No calls waiting.' : unclaimedCount === 1 ? 'call needs a team' : 'calls need a team'}</span>
        </div>
        <div class="rx-hero-meta">
          <button type="button" onClick={() => setActiveTab('active')}><Icon name="navigate" size={14} /> {myReports.length} active for you</button>
          <button type="button" onClick={() => setActiveTab('history')}><Icon name="check" size={14} /> {resolvedReports.filter((report) => report.assigned_to === myId).length} resolved by you</button>
          <button type="button" onClick={() => setActiveTab('alerts')}><Icon name="bell" size={14} /> {urgentAlerts.length} urgent {urgentAlerts.length === 1 ? 'alert' : 'alerts'}</button>
        </div>
      </section>}

      {activeTab === 'calls' && <AvailabilityPicker status={myStatus} saving={availabilitySaving} error={availabilityError} onChange={(value) => changeAvailability(value)} />}

      {latestUrgentAlert && activeTab === 'calls' && <button type="button" class="rx-alert-strip" onClick={() => setActiveTab('alerts')}>
        <span class="rx-alert-strip-icon"><Icon name="alert" /></span>
        <span class="rx-alert-strip-copy"><strong>{latestUrgentAlert.title}</strong><small>{latestUrgentAlert.location} · {timeAgo(latestUrgentAlert.createdAt)}</small></span>
        <Icon name="arrow" size={18} />
      </button>}

      {activeTab === 'calls' && <section class="rx-panel" aria-labelledby="rx-calls-title">
        <div class="rx-section-head">
          <div><h2 id="rx-calls-title">Incoming calls</h2>{liveLine}</div>
          {refreshButton}
        </div>
        <div class="rx-filters">
          <div class="rx-chip-row" role="group" aria-label="Urgency">
            {URGENCY_FILTERS.map(([value, label]) => <button type="button" key={value} class={`rx-filter-chip${value !== 'all' ? ` is-${value.toLowerCase()}` : ''}${filters.urgency === value ? ' is-active' : ''}`} aria-pressed={filters.urgency === value} onClick={() => setFilter('urgency', value)}>
              {label} <b>{(value === 'all' ? openReports : openReports.filter((report) => report.priority === value)).filter((report) => filters.team === 'all' || (filters.team === 'waiting' ? !report.assigned_to : report.assigned_to)).length}</b>
            </button>)}
            <button type="button" class={`rx-filter-chip is-household${filters.vulnerable ? ' is-active' : ''}`} aria-pressed={filters.vulnerable} onClick={() => setFilter('vulnerable', !filters.vulnerable)}><Icon name="heart" size={13} /> Priority households</button>
          </div>
          <div class="rx-filter-row">
            <label class="rx-search"><Icon name="search" size={15} /><input type="search" value={filters.search} placeholder="Search place, type or details" aria-label="Search calls" onInput={(event) => setFilter('search', event.currentTarget.value)} /></label>
            <button type="button" class={`rx-filter-toggle${moreFiltersSet ? ' is-set' : ''}`} aria-expanded={showMoreFilters} aria-controls="rx-more-filters" onClick={() => setShowMoreFilters((open) => !open)}>
              <Icon name="list" size={15} /> Filters{moreFiltersSet ? <b>{moreFiltersSet}</b> : null}
            </button>
          </div>
          <div id="rx-more-filters" class={`rx-filter-row rx-filter-more${showMoreFilters ? ' is-open' : ''}`}>
            <select value={filters.team} aria-label="Status" onChange={(event) => setFilter('team', event.currentTarget.value)}>
              <option value="waiting">Waiting for a team</option>
              <option value="taken">Taken by other teams</option>
              <option value="all">All open calls</option>
            </select>
            <select value={filters.within} aria-label="Distance" disabled={!myPosition} title={myPosition ? undefined : 'Turn on location to filter by distance'} onChange={(event) => setFilter('within', event.currentTarget.value)}>
              <option value="any">{myPosition ? 'Any distance' : 'Distance: needs location'}</option>
              <option value="1">Within 1 km</option>
              <option value="3">Within 3 km</option>
              <option value="5">Within 5 km</option>
            </select>
            <select value={filters.sort} aria-label="Sort" onChange={(event) => setFilter('sort', event.currentTarget.value)}>
              <option value="urgency">Most urgent first</option>
              <option value="nearest" disabled={!myPosition}>Nearest first</option>
            </select>
          </div>
        </div>
        {reportsError && <p class="admin-notice" role="alert">{reportsError}</p>}
        {reportsLoading && <LoadingCards label="Loading verified reports…" />}
        {!reportsLoading && <p class="rx-list-count" role="status">
          {visibleCalls.length} of {openReports.length} open {openReports.length === 1 ? 'call' : 'calls'}
          {filtersChanged && <button type="button" class="rx-link-button" onClick={() => setFilters(DEFAULT_CALL_FILTERS)}>Clear filters</button>}
        </p>}
        <div class="rx-call-list">
          {!reportsLoading && visibleCalls.map((report) => <CallCard
            key={report.id}
            report={report}
            myId={myId}
            myPosition={myPosition}
            isTampered={integrity[report.id] === 'tampered'}
            staffName={staffName}
            onShowOnMap={showOnMap}
            actions={renderActions(report)}
          />)}
          {!reportsLoading && visibleCalls.length === 0 && <div class="rx-empty">
            <span class="rx-empty-icon"><Icon name="shield" size={28} /></span>
            <strong>{openReports.length ? 'No calls match these filters' : 'All clear'}</strong>
            <p>{openReports.length ? 'Clear the filters to see every open call.' : 'There are no verified reports waiting for a response. New calls appear here automatically, with a sound.'}</p>
          </div>}
        </div>
      </section>}

      {activeTab === 'active' && <section class="rx-panel" aria-labelledby="rx-active-title">
        <div class="rx-section-head">
          <div><h2 id="rx-active-title">Active operations</h2>{liveLine}</div>
          {refreshButton}
        </div>
        {reportsError && <p class="admin-notice" role="alert">{reportsError}</p>}
        {reportsLoading && <LoadingCards label="Loading your operations…" />}
        <ActiveOps
          calls={myReports}
          loading={reportsLoading}
          myId={myId}
          myPosition={myPosition}
          integrity={integrity}
          staffName={staffName}
          notesFor={(id) => notes[id]}
          renderActions={renderActions}
          onAddNote={saveFieldNote}
          onShowOnMap={showOnMap}
          onGoToCalls={() => setActiveTab('calls')}
        />
      </section>}

      {activeTab === 'history' && <section class="rx-panel" aria-labelledby="rx-history-title">
        <div class="rx-section-head">
          <div><h2 id="rx-history-title">Rescue history</h2><small>Finished operations, newest first</small></div>
          {refreshButton}
        </div>
        {reportsError && <p class="admin-notice" role="alert">{reportsError}</p>}
        {reportsLoading
          ? <LoadingCards label="Loading finished operations…" />
          : <RescueHistory calls={resolvedReports} myId={myId} staffName={staffName} notesFor={(id) => notes[id]} onLoadNotes={(id) => { if (notes[id] === undefined) loadNotes([id]) }} />}
      </section>}

      {activeTab === 'map' && <section class="rx-panel rx-map">
        <RescuerSituationMap
          reports={markTampered(activeReports, integrity)}
          points={points}
          centers={centers}
          myPosition={myPosition}
          isFullscreen={isMapFullscreen}
          onToggleFullscreen={() => setIsMapFullscreen((value) => !value)}
          selectedId={selectedCall?.id}
          onSelect={(report) => setSelectedCallId(report.id)}
        >
          {selectedCall && <CallSheet
            key={selectedCall.id}
            report={selectedCall}
            myPosition={myPosition}
            points={points}
            reports={reports}
            centers={centers}
            isTampered={integrity[selectedCall.id] === 'tampered'}
            actions={renderActions(selectedCall)}
            onClose={() => setSelectedCallId(null)}
          />}
        </RescuerSituationMap>
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
            <span class="rx-alert-icon"><Icon name={alertIcon(alert)} size={20} /></span>
            <div>
              <span class="alert-item-type">{alertTypeLabel(alert)}</span>
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
        <div class="alert-modal-heading"><div><span class="ops-eyebrow">{reportTypeLabel(resolvingReport)} · {resolvingReport.location}</span><h2 id="resolve-title">Resolve this call</h2></div><button type="button" class="alert-modal-close" aria-label="Close" onClick={() => setResolvingReport(null)}>×</button></div>
        <form class="alert-form" onSubmit={submitResolution}>
          <fieldset class="rx-outcomes">
            <legend>What came of it?</legend>
            <div>
              {RESCUE_OUTCOMES.map((outcome) => <label key={outcome} class={resolutionOutcome === outcome ? 'is-active' : ''}>
                <input type="radio" name="outcome" value={outcome} checked={resolutionOutcome === outcome} onChange={() => { setResolutionOutcome(outcome); setResolveError('') }} />
                <span class="rx-outcome-dot" aria-hidden="true" />
                <span>{outcome}</span>
              </label>)}
            </div>
          </fieldset>
          <label>Remarks (optional)<textarea rows="3" maxLength="500" value={resolutionNote} onInput={(event) => setResolutionNote(event.currentTarget.value)} placeholder="e.g. 2 residents evacuated to Catmon ES, road cleared" /></label>
          <div class="rx-quick-notes">
            {['Residents evacuated', 'Road cleared', 'Patient brought to hospital', 'No action needed'].map((text) => <button type="button" key={text} onClick={() => setResolutionNote((current) => current ? `${current}. ${text}` : text)}>{text}</button>)}
          </div>
          {(resolveError || reportsError) && <p class="form-error" role="alert">{resolveError || reportsError}</p>}
          <div class="alert-form-actions"><button type="button" class="alert-cancel-button" onClick={() => setResolvingReport(null)}>Cancel</button><button type="submit" class="add-alert-button" disabled={Boolean(updatingReportId)}>{updatingReportId && <span class="btn-spinner" aria-hidden="true" />}Mark resolved</button></div>
        </form>
      </section>
    </div>}

    {isAlertFormOpen && <div class="alert-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setIsAlertFormOpen(false) }}>
      <section class="alert-modal" role="dialog" aria-modal="true" aria-labelledby="alert-form-title">
        <div class="alert-modal-heading"><div><span class="ops-eyebrow">Situation update</span><h2 id="alert-form-title">New alert</h2></div><button type="button" class="alert-modal-close" aria-label="Close alert form" onClick={() => setIsAlertFormOpen(false)}>×</button></div>
        <form class="alert-form" onSubmit={addAlert}>
          <AlertTypeField type={newAlertType} onTypeChange={(value) => { setNewAlertType(value); setAlertsError('') }} other={newAlertTypeOther} onOtherChange={(value) => { setNewAlertTypeOther(value); setAlertsError('') }} />
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
        {tab.count > 0 && <b class={`rx-tab-badge${tab.tone ? ` is-${tab.tone}` : ''}`}>{tab.count}</b>}
      </button>)}
    </nav>
    {navTarget && <NavigationView
      destination={{ latitude: navReport.latitude, longitude: navReport.longitude, name: reportTypeLabel(navReport), location: navReport.location }}
      points={points}
      reports={reports}
      initialPosition={myPosition}
      onStart={() => startedNavigation(navReport)}
      arrivalAction={isMyCall(navReport) && navReport.response_stage !== 'On scene' ? { label: 'Mark on scene', run: () => markOnScene(navReport) } : null}
      onClose={() => setNavTarget(null)}
    />}
    {confirmDialog}
    {isTourOpen && <Tour steps={TOURS.rescuer} prepare={tourPrepare} onClose={() => { markTourDone('rescuer'); setIsTourOpen(false) }} />}
    <ToastStack toasts={toasts} onDismiss={dismissToast} />
  </main>
}
