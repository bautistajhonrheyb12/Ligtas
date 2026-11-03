import { useEffect, useRef } from 'preact/hooks'
import L from 'leaflet'
import { Icon } from '../../lib/ui.jsx'
import {
  createLigtasMap,
  drawEvacuationCenters,
  drawMapPoints,
  drawUserPosition,
  fitToContent,
  mapCenter,
  removeLigtasMap,
  watchMapSize,
} from '../../lib/map.js'

export function CitizenMap({ points, centers, userPosition, focusTarget, locationError, isLocating, onLocate, t }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const layerRef = useRef(null)
  const userLayerRef = useRef(null)
  const hasShownUserRef = useRef(false)
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

    const coordinates = [...points, ...centers.filter((center) => center.latitude != null)]
      .map((item) => [item.latitude, item.longitude])
    if (!userMovedRef.current && coordinates.length > fittedCountRef.current) {
      fitToContent(map, coordinates)
      fittedCountRef.current = coordinates.length
    }
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
    </div>
  </div>
}
