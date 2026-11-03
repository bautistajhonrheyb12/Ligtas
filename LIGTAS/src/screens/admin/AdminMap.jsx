import { useEffect, useRef } from 'preact/hooks'
import L from 'leaflet'
import {
  createLigtasMap,
  drawEvacuationCenters,
  drawMapPoints,
  drawReports,
  escapeHtml,
  fitToContent,
  mapCenter,
  removeLigtasMap,
  watchMapSize,
} from '../../lib/map.js'
import { timeAgo } from '../../lib/ui.jsx'

function drawTeams(layer, teams) {
  teams.forEach((team) => {
    const initials = (team.name || 'R').split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()
    const isStale = Date.now() - new Date(team.updated_at).getTime() > 10 * 60000
    L.marker([team.latitude, team.longitude], {
      icon: L.divIcon({ className: `team-marker${isStale ? ' is-stale' : ''}`, html: `<span>${escapeHtml(initials)}</span>`, iconSize: [34, 34] }),
      title: team.name,
      zIndexOffset: 500,
    })
      .bindPopup(`<span class="map-popup-tag map-popup-tag--safe">Rescue team</span><strong>${escapeHtml(team.name)}</strong><br /><small>Location updated ${escapeHtml(timeAgo(team.updated_at).toLowerCase())}</small>`)
      .addTo(layer)
  })
}

export function AdminOperationsMap({
  points,
  centers,
  reports = [],
  teams = [],
  addingPoint = '',
  onMapClick,
  isFullscreen,
  onToggleFullscreen,
  newPointIds = null,
}) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const layerRef = useRef(null)
  const onMapClickRef = useRef(onMapClick)
  const addingPointRef = useRef(addingPoint)
  const fittedCountRef = useRef(0)
  const userMovedRef = useRef(false)
  onMapClickRef.current = onMapClick
  addingPointRef.current = addingPoint

  useEffect(() => {
    if (!mapRef.current) return undefined
    const map = createLigtasMap(mapRef.current, mapCenter, 13)
    map.on('click', (event) => {
      if (addingPointRef.current) onMapClickRef.current?.(event.latlng.lat, event.latlng.lng)
    })
    map.on('dragstart', () => { userMovedRef.current = true })
    mapInstanceRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    const stopWatching = watchMapSize(map, mapRef.current)
    return () => {
      stopWatching()
      mapInstanceRef.current = null
      layerRef.current = null
      removeLigtasMap(map)
    }
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    drawMapPoints(layer, points, { newIds: newPointIds })
    drawEvacuationCenters(layer, centers)
    drawReports(layer, reports)
    drawTeams(layer, teams)
    const coordinates = [
      ...points,
      ...centers.filter((center) => center.latitude != null),
      ...reports.filter((report) => report.latitude != null),
    ].map((item) => [item.latitude, item.longitude])
    if (!userMovedRef.current && coordinates.length > fittedCountRef.current) {
      fitToContent(map, coordinates)
      fittedCountRef.current = coordinates.length
    }
  }, [points, centers, reports, teams])

  // Leaflet adds its own classes to this element (including the one that clips the
  // tiles), so the placing-mode class is toggled here rather than set in JSX,
  // which would overwrite them.
  useEffect(() => {
    mapRef.current?.classList.toggle('is-adding-point', Boolean(addingPoint))
  }, [addingPoint])

  const located = reports.filter((report) => report.latitude != null).length

  return <section class={`ops-map-frame admin-map-frame${isFullscreen ? ' is-fullscreen' : ''}`}>
    <div class="map-toolbar">
      <div><strong>Community operations map</strong><span>{points.length} map points · {located} located reports · {teams.length} teams sharing location</span></div>
      <button type="button" class={`map-fullscreen-btn${isFullscreen ? ' is-active' : ''}`} onClick={onToggleFullscreen} aria-label={isFullscreen ? 'Exit full screen map' : 'Open full screen map'} title={isFullscreen ? 'Exit full screen map' : 'Open full screen map'}>
        <span class="map-fullscreen-icon" aria-hidden="true">{isFullscreen ? '⤡' : '▢'}</span>
      </button>
    </div>
    <div class="real-map" ref={mapRef} />
    <div class="map-legend">
      <span><i class="legend-red" /> Danger zone / critical</span>
      <span><i class="legend-yellow" /> Closed road / urgent</span>
      <span><i class="legend-blue" /> Report</span>
      <span><i class="legend-green" /> Evac. center</span>
      <span><i class="legend-team" /> Rescue team</span>
    </div>
  </section>
}
