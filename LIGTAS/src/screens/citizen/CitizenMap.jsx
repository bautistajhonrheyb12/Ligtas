import { useEffect, useRef } from 'preact/hooks'
import L from 'leaflet'
import { Icon } from '../../lib/ui.jsx'
import { centerMapLabels } from '../../components/CentersDirectory.jsx'
import {
  AREA_EDGE,
  createLigtasMap,
  drawEvacuationCenters,
  drawMapPoints,
  drawUserPosition,
  frameArea,
  refitArea,
  removeLigtasMap,
  watchMapSize,
  zoomForAccuracy,
} from '../../lib/map.js'

// The map key slides between its two places in this time (account for it
// before measuring where the key ended up).
const LEGEND_MOVE_MS = 280

// Where an element sits in the page once any slide-in animation has finished:
// offsets ignore transforms, so the header and panel are measured at rest even
// while they are still sliding into place.
function restingBox(element) {
  if (!element) return null
  let top = 0
  let left = 0
  for (let node = element; node; node = node.offsetParent) {
    top += node.offsetTop
    left += node.offsetLeft
  }
  const width = element.offsetWidth
  const height = element.offsetHeight
  return { top, left, width, height, bottom: top + height, right: left + width }
}

// Room for the header and the information panel drawn over the map, so the
// municipality is framed in the part of the map people can actually see.
function overlayPadding(container) {
  const box = restingBox(container)
  const header = restingBox(document.querySelector('.citizen-ui > .citizen-header'))
  const sheet = restingBox(document.querySelector('.citizen-ui .citizen-sheet'))
  const legend = restingBox(container.parentElement?.querySelector('.map-legend'))
  let top = AREA_EDGE
  let right = AREA_EDGE
  let bottom = AREA_EDGE
  if (header?.height) top = Math.max(top, header.bottom - box.top + AREA_EDGE)
  // The map key along the bottom.
  const keyBottom = legend?.height ? box.bottom - legend.top + AREA_EDGE : AREA_EDGE
  bottom = Math.max(bottom, keyBottom)
  if (sheet?.width && sheet.height) {
    // A bottom sheet spans the width of a phone; on wider screens the panel
    // stands at the side (on tablets it can be more than half the width).
    if (sheet.width >= box.width - 40) bottom = Math.max(bottom, box.bottom - sheet.top + AREA_EDGE)
    else right = Math.max(right, box.right - sheet.left + AREA_EDGE)
  }
  // Never squeeze the town into a sliver: with too little room beside the
  // panel, it is framed as if the panel were not there.
  if (box.width - AREA_EDGE - right < 180 || box.height - top - bottom < 180) {
    right = AREA_EDGE
    bottom = keyBottom
  }
  return { paddingTopLeft: [AREA_EDGE, top], paddingBottomRight: [right, bottom] }
}

// Fits the town to the space left between the header, the panel and the map
// key. While someone is zoomed in on a street, their view is kept and only
// the zoom-out limit follows the new space.
function refit(map, container, wholeTown) {
  refitArea(map, overlayPadding(container), wholeTown)
}

export function CitizenMap({ points, centers, userPosition, focusTarget, locationError, isLocating, onLocate, isFullscreen = false, t, lang = 'en' }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const layerRef = useRef(null)
  const userLayerRef = useRef(null)
  const hasShownUserRef = useRef(false)
  const userMovedRef = useRef(false)
  const wasFullscreenRef = useRef(isFullscreen)

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
    map.on('dragstart', () => { userMovedRef.current = true })
    // Keep the town framed whenever the map's space changes size.
    const stopWatching = watchMapSize(map, container, (wholeTown) => refit(map, container, wholeTown))
    return () => {
      stopWatching()
      layerRef.current = null
      userLayerRef.current = null
      mapInstanceRef.current = null
      removeLigtasMap(map)
    }
  }, [])

  // Full screen hides the panel and drops the map key to the bottom edge (and
  // back): once the key has moved, the town is fitted to the new space.
  useEffect(() => {
    if (wasFullscreenRef.current === isFullscreen) return undefined
    wasFullscreenRef.current = isFullscreen
    const timer = setTimeout(() => {
      if (mapInstanceRef.current && mapRef.current) refit(mapInstanceRef.current, mapRef.current)
    }, LEGEND_MOVE_MS + 40)
    return () => clearTimeout(timer)
  }, [isFullscreen])

  useEffect(() => {
    const map = mapInstanceRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    drawMapPoints(layer, points)
    drawEvacuationCenters(layer, centers, { labels: centerMapLabels(t, lang) })
  }, [points, centers, lang])

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
      mapInstanceRef.current.setView([focusTarget.latitude, focusTarget.longitude], zoomForAccuracy(focusTarget.accuracy))
    }
  }, [focusTarget])

  return <div class={`real-map-shell citizen-map-shell${isFullscreen ? ' is-fullscreen' : ''}`}>
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
      <span><i class="legend-official" /> {t('legendOfficial')}</span>
      <span><i class="legend-temporary" /> {t('legendTemporary')}</span>
      {userPosition && <span><i class="legend-blue" /> {t('legendYou')}</span>}
      <small class="map-credit">© OpenStreetMap contributors</small>
    </div>
  </div>
}
