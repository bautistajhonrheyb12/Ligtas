import { useEffect, useState } from 'preact/hooks'
import {
  clearSecurityFlags,
  deactivateRescuer,
  endUserSessions,
  deleteAlert,
  deleteMapPoint,
  endAlert,
  getAlerts,
  getCheckins,
  getEvacuationCenters,
  getIncidentReports,
  getMapPoints,
  getMyProfile,
  getReportEvents,
  getRequestCountry,
  getRescuerLocations,
  getSecurityFlags,
  getStaffProfiles,
  subscribeToTable,
  updateIncidentReport,
} from '../lib/supabase.js'
import {
  CountUp,
  Icon,
  LoadingCards,
  Logo,
  ToastStack,
  capacityLevel,
  playAlertChime,
  reportTypeStyle,
  timeAgo,
  toAlertView,
  useToasts,
} from '../lib/ui.jsx'
import { markTampered, useReportIntegrity } from '../lib/integrity.js'
import { isInsideSantaMaria } from '../lib/santaMaria.js'
import { AdminOperationsMap } from './admin/AdminMap.jsx'
import { CenterForm, PointForm } from './admin/AdminForms.jsx'
import { ActivityFeed, AlertForm, AlertList, CentersPanel, TeamsPanel } from './admin/AdminPanels.jsx'
import { AnalyticsPanel } from './admin/AnalyticsPanel.jsx'
import { ReportsPanel } from './admin/ReportsPanel.jsx'
import { SecurityPanel } from './admin/SecurityPanel.jsx'

const POINT_TYPES = ['Evac. center', 'Danger zone', 'Closed road', 'Other info']
// Team locations older than this are treated as not in the field.
const TEAM_LIVE_MS = 30 * 60000
// Check-ins older than this no longer describe the current situation.
const CHECKIN_WINDOW_MS = 3 * 86400000
const PAGE_TITLES = {
  dashboard: 'Admin dashboard',
  alerts: 'Alert center',
  map: 'Operations map',
  reports: 'Incident reports',
  centers: 'Evacuation centers',
  teams: 'Response teams',
  analytics: 'Analytics',
  security: 'Security',
}

export function AdminDashboard({ onSignOut }) {
  const [toasts, pushToast, dismissToast] = useToasts()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isAdminNavOpen, setIsAdminNavOpen] = useState(() => window.matchMedia('(min-width: 901px)').matches)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeIsError, setNoticeIsError] = useState(false)
  const showNotice = (message, isError = false) => { setNotice(message); setNoticeIsError(isError) }

  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [reportFilter, setReportFilter] = useState('All')
  const [updatingReportId, setUpdatingReportId] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [alertsError, setAlertsError] = useState('')
  const [isAlertFormOpen, setIsAlertFormOpen] = useState(false)
  const [points, setPoints] = useState([])
  const [newPointIds, setNewPointIds] = useState(null)
  const [centers, setCenters] = useState([])
  const [centersLoading, setCentersLoading] = useState(true)
  const [staff, setStaff] = useState([])
  const [locations, setLocations] = useState([])
  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [checkins, setCheckins] = useState([])
  const [myName, setMyName] = useState('')
  const [security, setSecurity] = useState({ flags: [], people: [] })
  const [securityLoading, setSecurityLoading] = useState(true)
  const [securityError, setSecurityError] = useState('')
  const [networkCountry, setNetworkCountry] = useState(null)
  const integrity = useReportIntegrity(reports)

  const [addingPoint, setAddingPoint] = useState('')
  const [pendingPoint, setPendingPoint] = useState(null)
  const [centerForm, setCenterForm] = useState(null)
  const [confirmDeletePointId, setConfirmDeletePointId] = useState(null)

  const loadReports = () => getIncidentReports()
    .then(setReports)
    .catch((error) => showNotice(error.message, true))
    .finally(() => setReportsLoading(false))
  const loadAlerts = () => getAlerts()
    .then((data) => { setAlerts(data.map(toAlertView)); setAlertsError('') })
    .catch((error) => setAlertsError(error.message))
    .finally(() => setAlertsLoading(false))
  const loadPoints = () => getMapPoints().then(setPoints).catch((error) => showNotice(error.message, true))
  const loadCenters = () => getEvacuationCenters()
    .then(setCenters)
    .catch((error) => showNotice(error.message, true))
    .finally(() => setCentersLoading(false))
  const loadStaff = () => getStaffProfiles().then(setStaff).catch(() => {})
  const loadLocations = () => getRescuerLocations().then(setLocations).catch(() => {})
  const loadEvents = () => getReportEvents(200)
    .then(setEvents)
    .catch(() => {})
    .finally(() => setEventsLoading(false))
  const loadCheckins = () => getCheckins().then(setCheckins).catch(() => {})
  const loadSecurity = () => getSecurityFlags()
    .then((data) => { setSecurity(data); setSecurityError('') })
    .catch((error) => setSecurityError(error.message))
    .finally(() => setSecurityLoading(false))

  useEffect(() => {
    getMyProfile().then((profile) => setMyName(profile.display_name ?? '')).catch(() => {})
    loadReports()
    loadAlerts()
    loadPoints()
    loadCenters()
    loadStaff()
    loadLocations()
    loadEvents()
    loadCheckins()
    loadSecurity()
    getRequestCountry().then(setNetworkCountry).catch(() => {})

    const unsubscribers = [
      subscribeToTable('incident_reports', (change) => {
        if (change.eventType === 'INSERT') {
          const isSos = change.new.report_type === 'SOS'
          pushToast(isSos ? `SOS received: ${change.new.location}` : `New ${change.new.report_type.toLowerCase()} report needs review`, isSos ? 'urgent' : 'info')
          playAlertChime(isSos)
        }
        loadReports()
      }),
      subscribeToTable('report_events', loadEvents),
      subscribeToTable('safety_checkins', loadCheckins),
      subscribeToTable('alerts', loadAlerts),
      subscribeToTable('map_points', loadPoints),
      subscribeToTable('evacuation_centers', loadCenters),
      subscribeToTable('rescuer_locations', loadLocations),
      subscribeToTable('security_flags', loadSecurity),
    ]
    const closeOnEscape = (event) => { if (event.key === 'Escape') setIsAdminNavOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const updateReport = async (id, changes) => {
    setUpdatingReportId(id)
    setNotice('')
    try {
      const updated = await updateIncidentReport(id, changes)
      setReports((current) => current.map((report) => report.id === id ? { ...report, ...updated } : report))
      showNotice(changes.assigned_to !== undefined ? 'Team assignment updated.' : changes.priority ? `Priority set to ${changes.priority}.` : 'Report status updated.')
    } catch (error) {
      showNotice(error.message, true)
    } finally {
      setUpdatingReportId(null)
    }
  }

  const handleMapClick = (lat, lng) => {
    if (!isInsideSantaMaria(lat, lng)) {
      showNotice('That spot is outside Santa Maria. Tap a place inside the dashed border.', true)
      return
    }
    const position = { latitude: lat, longitude: lng }
    if (addingPoint === 'Evac. center') setCenterForm({ center: null, position })
    else setPendingPoint({ pointType: addingPoint, position })
    setAddingPoint('')
  }

  const removePoint = async (point) => {
    if (confirmDeletePointId !== point.id) {
      setConfirmDeletePointId(point.id)
      setTimeout(() => setConfirmDeletePointId(null), 4000)
      return
    }
    setConfirmDeletePointId(null)
    try {
      await deleteMapPoint(point.id)
      setPoints((current) => current.filter((item) => item.id !== point.id))
      showNotice(`${point.name} was removed from the map.`)
    } catch (error) {
      showNotice(error.message, true)
    }
  }

  const handleEndAlert = async (alert) => {
    try {
      await endAlert(alert.id)
      setAlerts((current) => current.filter((item) => item.id !== alert.id))
      showNotice(`"${alert.title}" has ended and is no longer shown to anyone.`)
    } catch (error) {
      showNotice(error.message, true)
    }
  }

  const handleDeleteAlert = async (alert) => {
    try {
      await deleteAlert(alert.id)
      setAlerts((current) => current.filter((item) => item.id !== alert.id))
      showNotice(`"${alert.title}" was deleted.`)
    } catch (error) {
      showNotice(error.message, true)
    }
  }

  const handleClearFlags = async (userId) => {
    try {
      await clearSecurityFlags(userId)
      showNotice('Flags cleared for this account.')
      loadSecurity()
    } catch (error) {
      showNotice(error.message, true)
    }
  }

  const handleEndSessions = async (person) => {
    try {
      const ended = await endUserSessions(person.id)
      showNotice(ended
        ? `${person.display_name || 'The rescuer'} was signed out on every device. They need to sign in again.`
        : `${person.display_name || 'The rescuer'} had no active sessions.`)
    } catch (error) {
      showNotice(error.message, true)
    }
  }

  const handleDeactivate = async (person) => {
    try {
      await deactivateRescuer(person.id)
      showNotice(`${person.display_name || 'The rescuer'} can no longer sign in as a rescuer. Their open calls are back in the queue.`)
      loadStaff()
      loadReports()
      loadLocations()
    } catch (error) {
      showNotice(error.message, true)
    }
  }

  const selectAdminTab = (tab) => {
    setActiveTab(tab)
    setNotice('')
    setAddingPoint('')
    if (window.matchMedia('(max-width: 900px)').matches) setIsAdminNavOpen(false)
  }

  const pendingReports = reports.filter((report) => report.status === 'Pending')
  const sosReports = reports.filter((report) => report.report_type === 'SOS' && report.status === 'Verified' && !report.assigned_to)
  const activeReports = reports.filter((report) => report.status === 'Verified' || report.status === 'Pending')
  const mapReports = markTampered(activeReports, integrity)
  const teams = locations.filter((location) => Date.now() - new Date(location.updated_at).getTime() < TEAM_LIVE_MS).map((location) => ({
    ...location,
    id: location.rescuer_id,
    name: staff.find((person) => person.id === location.rescuer_id)?.display_name || 'Rescue team',
  }))
  const openCenters = centers.filter((center) => center.is_open)
  const recentCheckins = checkins.filter((checkin) => Date.now() - new Date(checkin.updated_at).getTime() < CHECKIN_WINDOW_MS)
  const needHelp = recentCheckins.filter((checkin) => checkin.status === 'Need help').length

  const flaggedAccounts = new Set(security.flags.filter((flag) => !flag.cleared_at).map((flag) => flag.user_id)).size

  const adminNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '▦' },
    { id: 'reports', label: 'Reports', icon: '▤', count: pendingReports.length },
    { id: 'alerts', label: 'Alerts', icon: '!', count: alerts.filter((alert) => alert.accent === 'red').length },
    { id: 'map', label: 'Map', icon: '⌖' },
    { id: 'centers', label: 'Centers', icon: '⌂' },
    { id: 'teams', label: 'Teams', icon: '◎' },
    { id: 'analytics', label: 'Analytics', icon: '▥' },
    { id: 'security', label: 'Security', icon: '⛨', count: flaggedAccounts },
  ]

  const noticeBanner = notice && <p class={`admin-notice${noticeIsError ? ' is-error' : ''}`} role={noticeIsError ? 'alert' : 'status'}>{notice}</p>

  return <main class={`rescuer-ui admin-ui${isAdminNavOpen ? ' admin-nav-open' : ''}`}>
    <header class="ops-header">
      <button
        type="button"
        class="admin-nav-toggle"
        onClick={() => setIsAdminNavOpen((open) => !open)}
        aria-label={isAdminNavOpen ? 'Hide admin navigation' : 'Show admin navigation'}
        aria-expanded={isAdminNavOpen}
        aria-controls="admin-navigation"
      >
        <span />
        <span />
        <span />
      </button>
      <a class="ops-brand" href="#admin-home" aria-label="LIGTAS admin dashboard"><Logo small /><span>LIGTAS <i>/</i> ADMIN</span></a>
      <div class="ops-user"><span class="ops-user-name">{myName || 'Santa Maria operations'}</span><button type="button" class="ops-signout" onClick={onSignOut}>Sign out</button></div>
    </header>

    {isAdminNavOpen && <button type="button" class="admin-nav-backdrop" aria-label="Close admin navigation" onClick={() => setIsAdminNavOpen(false)} />}
    <aside class="admin-sidebar" id="admin-navigation" aria-label="Admin navigation" aria-hidden={!isAdminNavOpen}>
      <div class="admin-sidebar-brand">
        <div><strong>LIGTAS</strong><span>Community operations</span></div>
      </div>
      <nav>
        {adminNavItems.map((item) => <button
          type="button"
          key={item.id}
          class={activeTab === item.id ? 'active' : ''}
          aria-current={activeTab === item.id ? 'page' : undefined}
          tabIndex={isAdminNavOpen ? 0 : -1}
          onClick={() => selectAdminTab(item.id)}
        >
          <span class="admin-sidebar-icon" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
          {item.count > 0 && <span class="admin-sidebar-count">{item.count}</span>}
        </button>)}
      </nav>
      <div class="admin-sidebar-location" aria-label="Service area">
        <span class="admin-sidebar-location-icon" aria-hidden="true">⌖</span>
        <div><small>Service area</small><strong>Santa Maria, Bulacan</strong></div>
      </div>
    </aside>

    <section class="ops-heading admin-page-heading" id="admin-home">
      <div><span class="ops-eyebrow">Community operations</span><h1>{PAGE_TITLES[activeTab]}</h1><p>Santa Maria, Bulacan · Community safety overview</p></div>
      <div class="admin-heading-actions">
        <span class="ops-updated"><i /> Live</span>
        {activeTab === 'dashboard' && <button type="button" class="admin-send-alert" onClick={() => { selectAdminTab('alerts'); setIsAlertFormOpen(true) }}><span>＋</span> Send alert</button>}
      </div>
    </section>

    {activeTab === 'dashboard' && <>
      {noticeBanner}
      {sosReports.length > 0 && <button class="ops-alert-banner admin-dashboard-alert admin-sos-banner" type="button" onClick={() => { setReportFilter('SOS'); selectAdminTab('reports') }}>
        <span class="ops-alert-icon">!</span>
        <span class="ops-alert-copy"><strong>{sosReports.length} SOS {sosReports.length === 1 ? 'call has' : 'calls have'} no team yet</strong><small>{sosReports[0].location} · {timeAgo(sosReports[0].created_at)} · Assign a rescue team now</small></span>
        <span class="ops-alert-meta"><b>Critical</b><small>Open reports</small></span>
      </button>}
      <section class="ops-stats admin-stats" aria-label="Community operations overview">
        <article class="ops-stat ops-stat--blue"><span class="ops-stat-icon">⌂</span><div><strong><CountUp value={openCenters.length} /></strong><span>Open evac. centers</span></div></article>
        <article class="ops-stat ops-stat--red"><span class="ops-stat-icon">!</span><div><strong><CountUp value={activeReports.length} /></strong><span>Active reports</span></div></article>
        <article class="ops-stat ops-stat--orange"><span class="ops-stat-icon">◎</span><div><strong><CountUp value={teams.length} /></strong><span>Teams in the field</span></div></article>
        <article class="ops-stat ops-stat--green"><span class="ops-stat-icon">✓</span><div><strong><CountUp value={recentCheckins.length - needHelp} /></strong><span>{needHelp ? `Marked safe · ${needHelp} need help` : 'Marked safe (3 days)'}</span></div></article>
      </section>
      <div class="ops-content admin-overview-content">
        <div class="admin-overview-map">
          <AdminOperationsMap points={points} centers={centers} reports={mapReports} teams={teams} isFullscreen={isMapFullscreen} onToggleFullscreen={() => setIsMapFullscreen((value) => !value)} />
        </div>
        <div class="admin-dashboard-side">
          <section class="admin-recent-alerts admin-review-panel">
            <div class="admin-section-heading"><h2>Needs review <span class="admin-count-chip">{pendingReports.length}</span></h2><button type="button" onClick={() => { setReportFilter('Pending'); selectAdminTab('reports') }}>Review all <span>›</span></button></div>
            {reportsLoading && <LoadingCards label="Loading incident reports…" count={2} />}
            {!reportsLoading && pendingReports.slice(0, 3).map((report) => {
              const type = reportTypeStyle(report.report_type)
              return <article class={`admin-review-item rx-tone--${type.tone}`} key={report.id}>
                <span class="admin-review-icon"><Icon name={type.icon} size={18} /></span>
                <div><strong>{report.report_type}{report.priority !== 'Normal' && <span class={`admin-priority admin-priority--${report.priority.toLowerCase()}`}>{report.priority}</span>}</strong><small>{report.location}</small></div>
                <div class="admin-review-actions">
                  <button type="button" class="approve-button" disabled={updatingReportId === report.id} onClick={() => updateReport(report.id, { status: 'Verified' })} aria-label={`Approve ${report.report_type} report`}><Icon name="check" size={16} /></button>
                  <button type="button" class="reject-button" disabled={updatingReportId === report.id} onClick={() => updateReport(report.id, { status: 'Rejected' })} aria-label={`Reject ${report.report_type} report`}><Icon name="plus" size={16} /></button>
                </div>
              </article>
            })}
            {!reportsLoading && pendingReports.length === 0 && <p class="admin-empty-state admin-review-empty"><Icon name="check" size={16} /> All reports have been reviewed.</p>}
          </section>
          <section class="admin-recent-alerts admin-capacity-panel">
            <div class="admin-section-heading"><h2>Shelter capacity</h2><button type="button" onClick={() => selectAdminTab('centers')}>Manage <span>›</span></button></div>
            {centersLoading && <LoadingCards label="Loading evacuation centers…" count={2} />}
            {openCenters.slice(0, 4).map((center) => {
              const capacity = capacityLevel(center.occupants, center.capacity)
              return <div class="admin-capacity-row" key={center.id}>
                <div><strong>{center.name}</strong><span>{Math.round(center.occupants / center.capacity * 100)}%</span></div>
                <div class="admin-center-capacity"><div><i data-level={capacity.level} style={{ width: `${center.occupants / center.capacity * 100}%` }} /></div></div>
              </div>
            })}
            {!centersLoading && openCenters.length === 0 && <p class="admin-empty-state">No open evacuation centers.</p>}
          </section>
          <section class="admin-recent-alerts admin-activity-panel">
            <div class="admin-section-heading"><h2>Recent activity</h2><Icon name="history" size={16} /></div>
            <ActivityFeed events={events} reports={reports} staff={staff} loading={eventsLoading} limit={6} />
          </section>
        </div>
      </div>
    </>}

    {activeTab !== 'dashboard' && <div class="ops-content admin-content">
      {activeTab === 'alerts' && <section class="ops-alerts-panel admin-alerts-panel">
        {noticeBanner}
        {alertsError && !isAlertFormOpen && <p class="admin-notice" role="alert">{alertsError}</p>}
        {isAlertFormOpen
          ? <AlertForm onCancel={() => setIsAlertFormOpen(false)} onPublished={() => { setIsAlertFormOpen(false); showNotice('Alert published to the selected audience.'); loadAlerts() }} />
          : <>
            <div class="queue-heading"><div><span class="ops-eyebrow">Situation updates</span><h2>Active alerts</h2></div><button type="button" class="add-alert-button" onClick={() => { setIsAlertFormOpen(true); setNotice('') }}>＋ Create alert</button></div>
            <AlertList alerts={alerts} loading={alertsLoading} error={alertsError} onEnd={handleEndAlert} onDelete={handleDeleteAlert} />
          </>}
      </section>}

      {activeTab === 'map' && <div class="admin-map-layout">
        <AdminOperationsMap
          points={points}
          centers={centers}
          reports={mapReports}
          teams={teams}
          addingPoint={addingPoint}
          onMapClick={handleMapClick}
          newPointIds={newPointIds}
          isFullscreen={isMapFullscreen}
          onToggleFullscreen={() => setIsMapFullscreen((value) => !value)}
        />
        <section class="admin-map-tools">
          <div class="queue-heading"><div><span class="ops-eyebrow">Map tools</span><h2>Add a point</h2></div></div>
          <p>Choose a point type, then tap the map to place it. Points appear on every citizen and rescuer map right away.</p>
          {noticeBanner}
          <div class="admin-point-options">
            {POINT_TYPES.map((type) => <button type="button" class={addingPoint === type ? 'active' : ''} onClick={() => setAddingPoint(addingPoint === type ? '' : type)} key={type}>{type}</button>)}
          </div>
          {addingPoint && <p class="admin-map-hint">Tap the map to add a {addingPoint.toLowerCase()}.</p>}
          <div class="admin-recent-points">
            <h3>Map points <span>{points.length}</span></h3>
            {points.map((point) => <div key={point.id}>
              <i class={`admin-point-dot admin-point-dot--${point.point_type.toLowerCase().replace(/[^a-z]+/g, '-')}`} />
              <span>{point.name}</span>
              <small>{point.point_type}</small>
              <button type="button" class={`admin-point-delete${confirmDeletePointId === point.id ? ' is-confirming' : ''}`} onClick={() => removePoint(point)} aria-label={confirmDeletePointId === point.id ? `Confirm removing ${point.name}` : `Remove ${point.name}`}>
                {confirmDeletePointId === point.id ? 'Remove?' : <Icon name="trash" size={14} />}
              </button>
            </div>)}
            {points.length === 0 && <p class="admin-empty-state">No map points yet.</p>}
          </div>
        </section>
      </div>}

      {activeTab === 'reports' && <>
        {noticeBanner}
        <ReportsPanel key={reportFilter} reports={reports} integrity={integrity} loading={reportsLoading} staff={staff} updatingReportId={updatingReportId} onUpdate={updateReport} initialFilter={reportFilter} />
      </>}

      {activeTab === 'centers' && <>
        {noticeBanner}
        <CentersPanel centers={centers} loading={centersLoading} onAdd={() => setCenterForm({ center: null, position: null })} onEdit={(center) => setCenterForm({ center, position: null })} onNotice={(message, isError) => { showNotice(message, isError); loadCenters() }} onChanged={loadCenters} />
      </>}

      {activeTab === 'teams' && <div class="admin-teams-layout">
        <div>
          {noticeBanner}
          <TeamsPanel staff={staff} locations={locations} reports={reports} onCreated={loadStaff} onNotice={showNotice} onDeactivate={handleDeactivate} onEndSessions={handleEndSessions} />
        </div>
        <section class="admin-recent-alerts admin-activity-panel">
          <div class="admin-section-heading"><h2>Activity log</h2><Icon name="history" size={16} /></div>
          <ActivityFeed events={events} reports={reports} staff={staff} loading={eventsLoading} limit={25} />
        </section>
      </div>}

      {activeTab === 'analytics' && <AnalyticsPanel reports={reports} events={events} checkins={checkins} />}

      {activeTab === 'security' && <>
        {noticeBanner}
        <SecurityPanel flags={security.flags} people={security.people} loading={securityLoading} error={securityError} country={networkCountry} onClear={handleClearFlags} />
      </>}
    </div>}

    {pendingPoint && <PointForm
      pointType={pendingPoint.pointType}
      position={pendingPoint.position}
      onClose={() => setPendingPoint(null)}
      onSaved={(point) => {
        setPendingPoint(null)
        setNewPointIds(new Set([point.id]))
        setPoints((current) => [point, ...current.filter((item) => item.id !== point.id)])
        showNotice(`${point.name} added to the map.`)
      }}
    />}
    {centerForm && <CenterForm
      center={centerForm.center}
      initialPosition={centerForm.position}
      onClose={() => setCenterForm(null)}
      onSaved={(center) => {
        setCenterForm(null)
        setCenters((current) => [...current.filter((item) => item.id !== center.id), center].sort((a, b) => a.name.localeCompare(b.name)))
        showNotice(`${center.name} saved.`)
      }}
    />}
    <ToastStack toasts={toasts} onDismiss={dismissToast} />
  </main>
}
