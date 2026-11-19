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
// municipal border is covered with a plain background. (Turn-by-turn
// navigation uses its own map with the surrounding roads, since a route or a
// rescuer can be outside the town.)
const areaBounds = L.latLngBounds(santaMariaBoundary)
// Just enough margin that no map image is missing along the border.
const tileBounds = areaBounds.pad(0.02)
export const OUTSIDE_COLOR = '#eef2ef'
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
function limitToArea(map) {
  const size = map.getSize()
  if (!size.x || !size.y) return null
  const view = wholeTownView(map, map.ligtasPadding)
  map.setMinZoom(view.zoom)
  map.setMaxBounds(view.screen.extend(areaBounds).pad(0.05))
  return view
}

// Shows the whole town, filling the map. Padding keeps it clear of anything
// drawn over the map, such as a header or a side panel.
export function frameArea(map, padding = {}) {
  map.ligtasPadding = padding
  const view = limitToArea(map)
  if (view) map.setView(view.center, view.zoom, { animate: false })
  // A map still hidden (no size yet) opens on the town centre; it is fitted
  // once it has a size (watchMapSize).
  else if (!map._loaded) map.setView(areaBounds.getCenter(), 13, { animate: false })
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
    // Small steps let the whole town fill the map snugly on any screen.
    zoomSnap: 0.1,
  })
  if (center) map.setView(center, zoom)
  else frameArea(map)

  L.tileLayer(mapTileUrl, { attribution: mapAttribution, bounds: tileBounds }).addTo(map)
  L.control.zoom({ position: zoomPosition }).addTo(map)
  // Between the tiles and the markers, and never catches clicks.
  const maskPane = map.createPane('areaMask')
  maskPane.style.zIndex = '250'
  maskPane.style.pointerEvents = 'none'
  // Everything outside the border is covered completely, with no border line:
  // the town's own edge is the edge of the map.
  L.polygon([worldRing, santaMariaBoundary], { pane: 'areaMask', interactive: false, stroke: false, fillColor: OUTSIDE_COLOR, fillOpacity: 1 }).addTo(map)
  // Sits below the vector overlay pane so pulse rings render behind hazard markers.
  map.createPane('hazardPulse').style.zIndex = '350'
  if (center) limitToArea(map)
  return map
}

export function removeLigtasMap(map) {
  map.stop()
  map.remove()
}

// Keeps Leaflet in sync when its container changes size (sidebar toggles, fullscreen).
export function watchMapSize(map, container) {
  const observer = new ResizeObserver(() => {
    map.invalidateSize()
    limitToArea(map)
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

export function drawUserPosition(layer, position) {
  if (!position) return
  if (position.accuracy) {
    L.circle([position.latitude, position.longitude], {
      radius: position.accuracy,
      color: '#2f78b7',
      weight: 1,
      fillColor: '#2f78b7',
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(layer)
  }
  L.marker([position.latitude, position.longitude], {
    icon: L.divIcon({ className: 'user-marker', html: '<span></span>', iconSize: [22, 22] }),
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
