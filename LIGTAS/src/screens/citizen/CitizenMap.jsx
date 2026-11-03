import { useEffect, useRef } from 'preact/hooks'
import L from 'leaflet'
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

export function CitizenMap({ points, centers, userPosition, focusTarget, t }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const layerRef = useRef(null)
  const fittedCountRef = useRef(0)
  const userMovedRef = useRef(false)

  useEffect(() => {
    if (!mapRef.current) return undefined
    const map = createLigtasMap(mapRef.current, mapCenter, 13)
    mapInstanceRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    // Keep auto-framing new data until the person pans the map themselves.
    map.on('dragstart', () => { userMovedRef.current = true })
    const stopWatching = watchMapSize(map, mapRef.current)
    return () => {
      stopWatching()
      layerRef.current = null
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
    drawUserPosition(layer, userPosition)

    const coordinates = [...points, ...centers.filter((center) => center.latitude != null)]
      .map((item) => [item.latitude, item.longitude])
    if (!userMovedRef.current && coordinates.length > fittedCountRef.current) {
      fitToContent(map, coordinates)
      fittedCountRef.current = coordinates.length
    }
  }, [points, centers, userPosition])

  useEffect(() => {
    if (focusTarget && mapInstanceRef.current) {
      mapInstanceRef.current.setView([focusTarget.latitude, focusTarget.longitude], 16)
    }
  }, [focusTarget])

  return <div class="real-map-shell citizen-map-shell">
    <div class="real-map" ref={mapRef} />
    <div class="map-legend">
      <span><i class="legend-red" /> {t('legendDanger')}</span>
      <span><i class="legend-yellow" /> {t('legendClosed')}</span>
      <span><i class="legend-green" /> {t('legendCenter')}</span>
      {userPosition && <span><i class="legend-blue" /> {t('legendYou')}</span>}
    </div>
  </div>
}
