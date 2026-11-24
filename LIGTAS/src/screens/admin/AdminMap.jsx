import { useEffect, useRef } from 'preact/hooks'
import L from 'leaflet'
import {
  createLigtasMap,
  drawEvacuationCenters,
  drawMapPoints,
  drawReports,
  escapeHtml,
  refitArea,
  removeLigtasMap,
  watchMapSize,
} from '../../lib/map.js'
import { MapFullscreenButton, timeAgo, useFullscreenMap } from '../../lib/ui.jsx'

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
  onMapClickRef.current = onMapClick
  addingPointRef.current = addingPoint

  useEffect(() => {
    if (!mapRef.current) return undefined
    // Opens on the whole town, where every point, center and report is.
    const map = createLigtasMap(mapRef.current)
    map.on('click', (event) => {
      if (addingPointRef.current) onMapClickRef.current?.(event.latlng.lat, event.latlng.lng)
    })
    mapInstanceRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    // Full screen and window changes: the whole town is fitted to the new size.
    const stopWatching = watchMapSize(map, mapRef.current, (wholeTown) => refitArea(map, undefined, wholeTown))
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
  }, [points, centers, reports, teams])

  // Leaflet adds its own classes to this element (including the one that clips the
  // tiles), so the placing-mode class is toggled here rather than set in JSX,
  // which would overwrite them.
  useEffect(() => {
    mapRef.current?.classList.toggle('is-adding-point', Boolean(addingPoint))
  }, [addingPoint])

  const located = reports.filter((report) => report.latitude != null).length
  useFullscreenMap(isFullscreen, onToggleFullscreen)

  return <section class={`ops-map-frame admin-map-frame${isFullscreen ? ' is-fullscreen' : ''}`}>
    <div class="map-toolbar">
      <div><strong>Community operations map</strong><span>{points.length} map points · {located} located reports · {teams.length} teams sharing location</span></div>
      <MapFullscreenButton isFullscreen={isFullscreen} onToggle={onToggleFullscreen} />
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
