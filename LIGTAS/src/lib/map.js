import L from 'leaflet'
import { santaMariaBoundary } from './santaMaria.js'
import { iconHtml } from './icons.jsx'
import { reportTypeStyle } from './ui.jsx'

export const mapCenter = [14.842, 120.985]
export const mapTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const mapAttribution = '&copy; OpenStreetMap contributors'

// Every map is Santa Maria, Bulacan and nothing else: it opens with the whole
// town filling the map, cannot be zoomed out past it or dragged away from it,
// map images are loaded only around the town, and everything outside the
// municipal border (lib/santaMaria.js) is covered with a plain background,
// with one thin line marking the edge. (Turn-by-turn
// navigation uses its own map with the surrounding roads, since a route or a
// rescuer can be outside the town.)
const areaBounds = L.latLngBounds(santaMariaBoundary)
// Just enough margin that no map image is missing along the border.
const tileBounds = areaBounds.pad(0.02)
export const OUTSIDE_COLOR = '#eef2ef'
// The town's edge: one thin LIGTAS-green line, soft enough not to compete
// with the markers.
const EDGE_COLOR = '#27745b'
// Closest zoom: single houses (the most the map images offer).
const MAX_ZOOM = 19
// Space left around the town, in pixels.
export const AREA_EDGE = 8
const worldRing = [[-89, -179], [-89, 179], [89, 179], [89, -179]]

// The view that shows the whole town as large as it fits, leaving room for
// anything drawn over the map (a header, a side panel, a bottom panel).
function wholeTownView(map, padding = {}) {
  const options = { paddingTopLeft: [AREA_EDGE, AREA_EDGE], paddingBottomRight: [AREA_EDGE, AREA_EDGE], ...padding }
  // The old limit must not hold the calculation back.
  map.setMinZoom(0)
  const { center, zoom } = map._getBoundsCenterZoom(areaBounds, options)
  const middle = map.project(center, zoom)
  const half = map.getSize().divideBy(2)
  const screen = L.latLngBounds(map.unproject(middle.subtract(half), zoom), map.unproject(middle.add(half), zoom))
  return { center, zoom, screen }
}

// People cannot zoom out past the whole town, or drag it out of view. The
// small allowance lets a selected call be shown beside a panel near the border.
function applyLimits(map, view) {
  map.setMinZoom(view.zoom)
  map.setMaxBounds(view.screen.extend(areaBounds).pad(0.05))
}

function limitToArea(map) {
  const size = map.getSize()
  if (!size.x || !size.y) return null
  const view = wholeTownView(map, map.ligtasPadding)
  applyLimits(map, view)
  return view
}

// Updates the room kept for things drawn over the map (and with it how far
// out people can zoom) without moving the map.
export function setAreaPadding(map, padding = {}) {
  map.ligtasPadding = padding
  limitToArea(map)
}

// True while the map shows the whole town (zoomed out as far as it goes).
export function showsWholeTown(map) {
  return Boolean(map._loaded) && map.getZoom() <= map.getMinZoom() + 0.01
}

// After the map's space changes (a resize, full screen): shows the whole town
// again if it was showing it, otherwise keeps the view someone zoomed into.
export function refitArea(map, padding = map.ligtasPadding ?? {}, wholeTown = showsWholeTown(map)) {
  if (wholeTown) frameArea(map, padding)
  else setAreaPadding(map, padding)
}

// Shows the whole town, filling the map. Padding keeps it clear of anything
// drawn over the map, such as a header or a side panel.
export function frameArea(map, padding = {}) {
  map.ligtasPadding = padding
  const size = map.getSize()
  if (!size.x || !size.y) {
    // A map still hidden (no size yet) opens on the town centre; it is fitted
    // once it has a size (watchMapSize).
    if (!map._loaded) map.setView(areaBounds.getCenter(), 13, { animate: false })
    return
  }
  // The old limits come off first. Leaflet slides the map back inside new
  // limits with a short animation, which could finish after the view below
  // is set and undo it (leaving the town off-centre).
  map.setMaxBounds(null)
  const view = wholeTownView(map, padding)
  map.setView(view.center, view.zoom, { animate: false })
  applyLimits(map, view)
}

// Without a centre, the map opens on the whole municipality. A map can put its
// zoom buttons in another corner, and show the map credit itself instead of
// Leaflet's corner box (the citizen map shows it in its map key).
export function createLigtasMap(container, center = null, zoom = 13, { zoomPosition = 'bottomright', attribution = true } = {}) {
  const map = L.map(container, {
    zoomControl: false,
    attributionControl: attribution,
    zoomAnimation: false,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    dragging: true,
    touchZoom: true,
    boxZoom: true,
    maxBoundsViscosity: 1,
    // Small steps let the whole town fill the map snugly on any screen. The
    // farthest-out zoom is set by limitToArea: the whole town, no further.
    zoomSnap: 0.1,
    maxZoom: MAX_ZOOM,
  })
  if (center) map.setView(center, zoom)
  else frameArea(map)

  L.tileLayer(mapTileUrl, { attribution: mapAttribution, bounds: tileBounds, maxZoom: MAX_ZOOM }).addTo(map)
  L.control.zoom({ position: zoomPosition }).addTo(map)
  // Between the tiles and the markers, and never catches clicks.
  const maskPane = map.createPane('areaMask')
  maskPane.style.zIndex = '250'
  maskPane.style.pointerEvents = 'none'
  // Everything outside the border is covered completely. The cover's own
  // outline, in the same plain colour, also hides the border line and the
  // neighbouring towns' edges that the map images draw along the boundary.
  L.polygon([worldRing, santaMariaBoundary], { pane: 'areaMask', interactive: false, color: OUTSIDE_COLOR, weight: 6, opacity: 1, fillColor: OUTSIDE_COLOR, fillOpacity: 1 }).addTo(map)
  // Then one clean, thin line marks the town's edge.
  L.polygon(santaMariaBoundary, { pane: 'areaMask', interactive: false, fill: false, color: EDGE_COLOR, weight: 1.5, opacity: 0.55 }).addTo(map)
  // Sits below the vector overlay pane so pulse rings render behind hazard markers.
  map.createPane('hazardPulse').style.zIndex = '350'
  if (center) limitToArea(map)
  return map
}

export function removeLigtasMap(map) {
  map.stop()
  map.remove()
}

// Keeps Leaflet in sync when its container changes size (sidebar toggles,
// fullscreen, a phone's address bar). onResize can then frame the town again;
// it is told whether the whole town was showing before the size changed (the
// zoom limits move with the size, so that cannot be asked afterwards).
export function watchMapSize(map, container, onResize = null) {
  const observer = new ResizeObserver(() => {
    const wholeTown = showsWholeTown(map)
    map.invalidateSize()
    limitToArea(map)
    onResize?.(wholeTown)
  })
  observer.observe(container)
  return () => observer.disconnect()
}

export function addHazardPulse(target, lat, lng, tone) {
  return L.marker([lat, lng], {
    pane: 'hazardPulse',
    interactive: false,
    keyboard: false,
    icon: L.divIcon({ className: `hazard-pulse hazard-pulse--${tone}`, html: '<span></span><span></span>', iconSize: [64, 64] }),
  }).addTo(target)
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}

// Popup text comes from users and staff, so every field is escaped.
export function hazardPopup(title, description, area, tone, label) {
  return `<span class="map-popup-tag map-popup-tag--${tone}">${escapeHtml(label)}</span><strong>${escapeHtml(title)}</strong>${description ? `<br />${escapeHtml(description)}` : ''}${area ? `<br /><small>${escapeHtml(area)}</small>` : ''}`
}

export const pointStyles = {
  'Danger zone': { stroke: '#d95452', fill: '#f4837f', tone: 'high' },
  'Closed road': { stroke: '#dc8c24', fill: '#f3bd61', tone: 'medium' },
  'Other info': { stroke: '#3d86c0', fill: '#8cc2e8', tone: 'info' },
}

export function drawMapPoints(layer, points, { newIds = null } = {}) {
  points.forEach((point) => {
    const style = pointStyles[point.point_type] ?? pointStyles['Other info']
    if (point.point_type === 'Danger zone' || (point.point_type === 'Closed road' && point.severity === 'High')) {
      addHazardPulse(layer, point.latitude, point.longitude, style.tone)
    }
    L.circleMarker([point.latitude, point.longitude], {
      radius: 10,
      color: style.stroke,
      fillColor: style.fill,
      fillOpacity: 0.9,
      weight: 2,
      className: newIds?.has(point.id) ? 'map-point is-new' : 'map-point',
    })
      .bindPopup(hazardPopup(point.name, point.description, `${point.severity} risk`, style.tone === 'info' ? 'safe' : style.tone, point.point_type), { maxWidth: 240 })
      .addTo(layer)
  })
}

export function drawEvacuationCenters(layer, centers, { onSelect } = {}) {
  centers.filter((center) => center.latitude != null).forEach((center) => {
    const available = Math.max(center.capacity - center.occupants, 0)
    const marker = L.marker([center.latitude, center.longitude], {
      icon: L.divIcon({
        className: `center-marker${center.is_open ? '' : ' is-closed'}`,
        html: `<span>${iconHtml('home', 15)}</span>`,
        iconSize: [30, 30],
      }),
      title: center.name,
    })
      .bindPopup(`<span class="map-popup-tag map-popup-tag--safe">${center.is_open ? 'Evacuation center' : 'Closed'}</span><strong>${escapeHtml(center.name)}</strong><br />${escapeHtml(center.location)}<br /><small>${available} of ${center.capacity} spaces available</small>`, { maxWidth: 240 })
      .addTo(layer)
    if (onSelect) marker.on('click', () => onSelect(center))
  })
}

// A phone's GPS is usually right to within tens of metres. Without a GPS fix
// (indoors, location set to battery saving, or a computer) it can be off by
// hundreds of metres or kilometres; a circle that size covers much of the
// town and looks like a loading ring. So the circle is only drawn for a fix
// close enough to help, and a rough one shows as a hollow marker instead.
export const PRECISE_FIX_M = 150
export const isRoughFix = (accuracy) => Number(accuracy) > PRECISE_FIX_M

// How far to zoom in on a position, by how sure it is.
export function zoomForAccuracy(accuracy) {
  if (!accuracy || accuracy <= PRECISE_FIX_M) return 16
  if (accuracy <= 600) return 15
  if (accuracy <= 2000) return 14
  return 13
}

export function drawUserPosition(layer, position) {
  if (!position) return
  const rough = isRoughFix(position.accuracy)
  if (position.accuracy && !rough) {
    L.circle([position.latitude, position.longitude], {
      radius: position.accuracy,
      color: '#2f78b7',
      weight: 1,
      opacity: 0.5,
      fillColor: '#2f78b7',
      fillOpacity: 0.06,
      interactive: false,
    }).addTo(layer)
  }
  L.marker([position.latitude, position.longitude], {
    icon: L.divIcon({ className: rough ? 'user-marker is-approximate' : 'user-marker', html: '<span></span>', iconSize: [22, 22] }),
    interactive: false,
    keyboard: false,
  }).addTo(layer)
}

const reportMarkerColors = {
  Critical: ['#b93a37', '#e2615d'],
  Urgent: ['#c26a1a', '#efa04e'],
  Normal: ['#2f78b7', '#7fb6e2'],
}

// Incident pins for staff maps; only reports with a position are drawn.
// Reports placed with lib/callLocation.js carry `accuracy` (drawn as a search
// circle) and `isLive` (a ring that pulses while the person shares their live
// location). With `onSelect`, tapping a pin selects the call instead of
// opening a popup; `selectedId` highlights it.
export function drawReports(layer, reports, { onSelect, selectedId } = {}) {
  reports.filter((report) => report.latitude != null).forEach((report) => {
    const [stroke, fill] = reportMarkerColors[report.priority] ?? reportMarkerColors.Normal
    const isOpen = report.status !== 'Resolved'
    if (report.priority === 'Critical' && isOpen) addHazardPulse(layer, report.latitude, report.longitude, 'high')
    if (isOpen && report.accuracy >= 10) {
      L.circle([report.latitude, report.longitude], {
        radius: Math.min(report.accuracy, 2000),
        color: stroke,
        weight: 1.5,
        opacity: 0.75,
        dashArray: report.isLive ? null : '4 5',
        fillColor: stroke,
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(layer)
    }
    const classes = ['report-marker', isOpen ? '' : 'is-resolved', report.isLive && isOpen ? 'is-live' : '', report.id === selectedId ? 'is-selected' : ''].filter(Boolean).join(' ')
    const marker = L.marker([report.latitude, report.longitude], {
      icon: L.divIcon({
        className: classes,
        html: `${report.isLive && isOpen ? '<i class="report-live-ring"></i>' : ''}<span style="--stroke:${stroke};--fill:${fill}"><b>${report.report_type === 'SOS' ? 'SOS' : iconHtml(reportTypeStyle(report.report_type).icon, 15)}</b></span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -30],
      }),
      title: `${report.report_type} · ${report.location}`,
      zIndexOffset: report.id === selectedId ? 1000 : report.report_type === 'SOS' ? 500 : 0,
    })
    if (onSelect) marker.on('click', () => onSelect(report))
    else marker.bindPopup(hazardPopup(report.report_type, report.notes, report.location, report.priority === 'Normal' ? 'safe' : 'high', `${report.priority} · ${report.status}`), { maxWidth: 260 })
    marker.addTo(layer)
  })
}

export function fitToContent(map, latLngs, fallbackZoom = 13) {
  if (latLngs.length > 1) map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40], maxZoom: 15 })
  else if (latLngs.length === 1) map.setView(latLngs[0], 15)
  else map.setView(mapCenter, fallbackZoom)
}
