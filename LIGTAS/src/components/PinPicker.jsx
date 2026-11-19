import { useEffect, useRef } from 'preact/hooks'
import L from 'leaflet'
import { createLigtasMap, removeLigtasMap, watchMapSize } from '../lib/map.js'
import { isInsideSantaMaria } from '../lib/santaMaria.js'

// Small map for choosing a location: tap to place the pin, drag to fine-tune.
// Pins can only be placed inside Santa Maria; a tap or drag outside calls
// onOutside so the form can say why nothing happened.
export function PinPicker({ position, onChange, onOutside }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const onOutsideRef = useRef(onOutside)
  onChangeRef.current = onChange
  onOutsideRef.current = onOutside

  useEffect(() => {
    const map = createLigtasMap(mapRef.current, position ? [position.latitude, position.longitude] : null, 16)
    map.on('click', (event) => {
      if (isInsideSantaMaria(event.latlng.lat, event.latlng.lng)) onChangeRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng })
      else onOutsideRef.current?.()
    })
    mapInstanceRef.current = map
    const stopWatching = watchMapSize(map, mapRef.current)
    return () => {
      stopWatching()
      markerRef.current = null
      mapInstanceRef.current = null
      removeLigtasMap(map)
    }
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    if (!position) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    const latLng = [position.latitude, position.longitude]
    if (markerRef.current) {
      markerRef.current.setLatLng(latLng)
    } else {
      markerRef.current = L.marker(latLng, {
        draggable: true,
        icon: L.divIcon({ className: 'pin-marker', html: '<span></span>', iconSize: [30, 38], iconAnchor: [15, 36] }),
      }).addTo(map)
      markerRef.current.on('dragstart', (event) => { event.target.startLatLng = event.target.getLatLng() })
      markerRef.current.on('dragend', (event) => {
        const { lat, lng } = event.target.getLatLng()
        if (isInsideSantaMaria(lat, lng)) onChangeRef.current({ latitude: lat, longitude: lng })
        else {
          event.target.setLatLng(event.target.startLatLng)
          onOutsideRef.current?.()
        }
      })
    }
    map.setView(latLng, Math.max(map.getZoom(), 16))
  }, [position])

  return <div class="pin-picker" ref={mapRef} />
}
