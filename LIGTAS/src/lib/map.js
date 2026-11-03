import L from 'leaflet'
import { santaMariaBoundary } from './santaMaria.js'

export const mapCenter = [14.842, 120.985]
export const mapTileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const mapAttribution = '&copy; OpenStreetMap contributors'

// Every map shows only Santa Maria, Bulacan: panning stops a little past the
// municipal border, tiles outside it are never downloaded, and the area beyond
// the border is faded out.
const areaBounds = L.latLngBounds(santaMariaBoundary)
const viewBounds = areaBounds.pad(0.08)
const worldRing = [[-89, -179], [-89, 179], [89, 179], [89, -179]]

// The furthest people can zoom out is the zoom that shows the whole municipality.
function limitZoomToArea(map) {
  const size = map.getSize()
  if (!size.x || !size.y) return
  map.setMinZoom(Math.max(10, map.getBoundsZoom(viewBounds, false)))
}

export function createLigtasMap(container, center, zoom) {
  const map = L.map(container, {
    zoomControl: false,
    zoomAnimation: false,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    dragging: true,
    touchZoom: true,
    boxZoom: true,
    maxBounds: viewBounds,
    maxBoundsViscosity: 1,
    // Quarter steps let the zoomed-out view fit the municipality snugly on any screen.
    zoomSnap: 0.25,
  }).setView(center, zoom)

  L.tileLayer(mapTileUrl, { attribution: mapAttribution, bounds: viewBounds }).addTo(map)
  L.control.zoom({ position: 'bottomright' }).addTo(map)
  // Between the tiles and the markers, and never catches clicks.
  const maskPane = map.createPane('areaMask')
  maskPane.style.zIndex = '250'
  maskPane.style.pointerEvents = 'none'
  L.polygon([worldRing, santaMariaBoundary], { pane: 'areaMask', interactive: false, stroke: false, fillColor: '#eef2ef', fillOpacity: 0.86 }).addTo(map)
  L.polygon(santaMariaBoundary, { pane: 'areaMask', interactive: false, fill: false, color: '#27745b', weight: 2.5, opacity: 0.85, dashArray: '7 6' }).addTo(map)
  // Sits below the vector overlay pane so pulse rings render behind hazard markers.
  map.createPane('hazardPulse').style.zIndex = '350'
  limitZoomToArea(map)
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
    limitZoomToArea(map)
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
        html: '<span>⌂</span>',
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

// Incident pins for staff maps; only reports with GPS coordinates are drawn.
export function drawReports(layer, reports, { onSelect } = {}) {
  reports.filter((report) => report.latitude != null).forEach((report) => {
    const [stroke, fill] = reportMarkerColors[report.priority] ?? reportMarkerColors.Normal
    if (report.priority === 'Critical' && report.status !== 'Resolved') addHazardPulse(layer, report.latitude, report.longitude, 'high')
    const marker = L.marker([report.latitude, report.longitude], {
      icon: L.divIcon({
        className: `report-marker${report.status === 'Resolved' ? ' is-resolved' : ''}`,
        html: `<span style="--stroke:${stroke};--fill:${fill}"><b>${report.report_type === 'SOS' ? 'SOS' : '!'}</b></span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -30],
      }),
      title: `${report.report_type} · ${report.location}`,
    })
      .bindPopup(hazardPopup(report.report_type, report.notes, report.location, report.priority === 'Normal' ? 'safe' : 'high', `${report.priority} · ${report.status}`), { maxWidth: 260 })
      .addTo(layer)
    if (onSelect) marker.on('click', () => onSelect(report))
  })
}

export function fitToContent(map, latLngs, fallbackZoom = 13) {
  if (latLngs.length > 1) map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40], maxZoom: 15 })
  else if (latLngs.length === 1) map.setView(latLngs[0], 15)
  else map.setView(mapCenter, fallbackZoom)
}
