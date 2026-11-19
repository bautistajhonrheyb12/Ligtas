import { useEffect, useRef } from 'preact/hooks'
import L from 'leaflet'
import { Icon } from '../../lib/ui.jsx'
import {
  AREA_EDGE,
  createLigtasMap,
  drawEvacuationCenters,
  drawMapPoints,
  drawUserPosition,
  frameArea,
  removeLigtasMap,
  watchMapSize,
} from '../../lib/map.js'

// Room for the header and the information panel drawn over the map, so the
// municipality is framed in the part of the map people can actually see.
function overlayPadding(container) {
  const box = container.getBoundingClientRect()
  const header = document.querySelector('.citizen-ui > .citizen-header')?.getBoundingClientRect()
  const sheet = document.querySelector('.citizen-ui .citizen-sheet')?.getBoundingClientRect()
  const legend = container.parentElement?.querySelector('.map-legend')?.getBoundingClientRect()
  let top = AREA_EDGE
  let right = AREA_EDGE
  let bottom = AREA_EDGE
  if (header?.height) top = Math.max(top, header.bottom - box.top + AREA_EDGE)
  if (sheet?.width && sheet.height) {
    // A side panel on wide screens, a bottom sheet on phones.
    if (sheet.left > box.left + box.width / 2) right = Math.max(right, box.right - sheet.left + AREA_EDGE)
    else bottom = Math.max(bottom, box.bottom - sheet.top + AREA_EDGE)
  }
  // The map key along the bottom.
  if (legend?.height) bottom = Math.max(bottom, box.bottom - legend.top + AREA_EDGE)
  return { paddingTopLeft: [AREA_EDGE, top], paddingBottomRight: [right, bottom] }
}

export function CitizenMap({ points, centers, userPosition, focusTarget, locationError, isLocating, onLocate, t }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const layerRef = useRef(null)
  const userLayerRef = useRef(null)
  const hasShownUserRef = useRef(false)
  const userMovedRef = useRef(false)

  useEffect(() => {
    if (!mapRef.current) return undefined
    const container = mapRef.current
    // Zoom buttons at the top (the bottom is covered by the panel); the map
    // credit is shown in the map key below.
    const map = createLigtasMap(container, null, 13, { zoomPosition: 'topright', attribution: false })
    frameArea(map, overlayPadding(container))
    mapInstanceRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    // Kept apart so frequent location updates don't redraw every marker.
    userLayerRef.current = L.layerGroup().addTo(map)
    // Keep the town framed when the window changes size, until the person
    // moves the map themselves.
    map.on('dragstart', () => { userMovedRef.current = true })
    const reframe = () => { if (!userMovedRef.current) frameArea(map, overlayPadding(container)) }
    window.addEventListener('resize', reframe)
    const stopWatching = watchMapSize(map, container)
    return () => {
      window.removeEventListener('resize', reframe)
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
  }, [points, centers])

  useEffect(() => {
    const map = mapInstanceRef.current
    const layer = userLayerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    drawUserPosition(layer, userPosition)
    // Bring the person into view the first time they are found, unless they
    // have already moved the map themselves.
    if (userPosition && !hasShownUserRef.current) {
      hasShownUserRef.current = true
      const here = [userPosition.latitude, userPosition.longitude]
      if (!userMovedRef.current && !map.getBounds().contains(here)) map.panTo(here)
    }
  }, [userPosition])

  useEffect(() => {
    if (focusTarget && mapInstanceRef.current) {
      mapInstanceRef.current.setView([focusTarget.latitude, focusTarget.longitude], 16)
    }
  }, [focusTarget])

  return <div class="real-map-shell citizen-map-shell">
    <div class="real-map" ref={mapRef} />
    <button
      type="button"
      class={`map-locate${userPosition ? ' is-found' : ''}${locationError ? ' is-off' : ''}`}
      onClick={onLocate}
      aria-label={t('showMe')}
      title={locationError || t('showMe')}
    >
      {isLocating ? <span class="btn-spinner" aria-hidden="true" /> : <Icon name="locate" size={20} />}
    </button>
    <div class="map-legend">
      <span><i class="legend-red" /> {t('legendDanger')}</span>
      <span><i class="legend-yellow" /> {t('legendClosed')}</span>
      <span><i class="legend-green" /> {t('legendCenter')}</span>
      {userPosition && <span><i class="legend-blue" /> {t('legendYou')}</span>}
      <small class="map-credit">© OpenStreetMap contributors</small>
    </div>
  </div>
}
