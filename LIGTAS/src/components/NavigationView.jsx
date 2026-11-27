import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import L from 'leaflet'
import { isRoughFix, mapTileUrl } from '../lib/map.js'
import { avoidAreas, hazardZones, hazardsAlongRoute, routeExposure } from '../lib/hazards.js'
import {
  bearing,
  createDeviationTracker,
  distanceM,
  dueAnnouncement,
  formatMeters,
  formatMinutes,
  gpsQuality,
  offsetPoint,
  projectOnRoute,
  routeProgress,
} from '../lib/navigation.js'
import { ROUTING_ATTRIBUTION, requestRoutes } from '../lib/routing.js'
import { Icon, directionsUrl, useWakeLock } from '../lib/ui.jsx'

const TEXT = {
  en: {
    locating: 'Finding your location…',
    planning: 'Planning the safest route…',
    rerouting: 'Recalculating route…',
    drive: 'Drive',
    walk: 'Walk',
    recommended: 'Recommended',
    alternative: 'Alternative',
    notRecommended: 'Not recommended',
    areas: 'areas',
    safe: 'Avoids reported hazards',
    caution: 'Passes near',
    unsafe: 'Not safe: passes through',
    avoided: 'Clear of all {count} reported hazard areas',
    via: 'via {road}',
    start: 'Start navigation',
    startUnsafe: 'Start anyway (not safe)',
    noSafeRoute: 'No safe route was found. Every road route passes through a reported hazard. Call MDRRMO Rescue at 0923 022 6973 if you need help to get there.',
    insideZone: 'Your start or destination is inside: {zones}. Take extra care there.',
    tooMany: 'There are more reported hazards than the route planner can check at once; the nearest ones were avoided first.',
    openGoogle: 'Open in Google Maps',
    close: 'Close',
    end: 'End',
    retry: 'Try again',
    arrive: 'Arrive',
    left: 'left',
    speed: 'km/h',
    gps: { good: 'GPS good', fair: 'GPS fair', poor: 'GPS weak', lost: 'GPS lost' },
    gpsLost: 'GPS signal lost. Showing your last known position.',
    gpsDenied: 'Location access is off. Allow location for this site in your browser settings to navigate.',
    offlineReroute: 'You left the route, but the route cannot be recalculated right now. Head back to the blue line or check your connection.',
    rerouted: 'Route recalculated.',
    destinationMoved: 'The person moved {distance}. Route updated to where they are now.',
    reroutedHazard: 'Rerouted around a newly reported hazard: {label}.',
    arrived: 'You have arrived',
    voiceOn: 'Voice on',
    voiceOff: 'Voice off',
    headingUp: 'Direction up',
    northUp: 'North up',
    recenter: 'Recenter',
    onRoad: 'On {road}',
    then: 'Then',
    hazardAhead: 'Caution: {label} ahead in {distance} – {source}.',
    hazardHere: 'Caution: you are passing {label} – {source}.',
    report: 'Report',
    reportTitle: 'Report at your location',
    reportTypes: { 'Blocked road': 'Road Obstruction', Flooding: 'Flooding', 'Vehicular accident': 'Vehicular Accident', 'Downed power line': 'Downed Power Line' },
    reportSending: 'Sending report…',
    reportSent: 'Report sent. Administrators will review it.',
    reportNeedsGps: 'Your position is not known yet, so the report cannot be placed.',
  },
  tl: {
    locating: 'Hinahanap ang lokasyon mo…',
    planning: 'Pinaplano ang pinakaligtas na ruta…',
    rerouting: 'Muling kinakalkula ang ruta…',
    drive: 'Sasakyan',
    walk: 'Lakad',
    recommended: 'Inirerekomenda',
    alternative: 'Alternatibo',
    notRecommended: 'Hindi inirerekomenda',
    areas: 'lugar',
    safe: 'Iniiwasan ang mga naiulat na panganib',
    caution: 'Dumadaan malapit sa',
    unsafe: 'Hindi ligtas: dumadaan sa',
    avoided: 'Malayo sa {count} naiulat na lugar na may panganib',
    via: 'sa {road}',
    start: 'Simulan ang nabigasyon',
    startUnsafe: 'Simulan pa rin (hindi ligtas)',
    noSafeRoute: 'Walang nakitang ligtas na ruta. Lahat ng daan ay dumadaan sa naiulat na panganib. Tumawag sa MDRRMO Rescue: 0923 022 6973 kung kailangan mo ng tulong.',
    insideZone: 'Nasa loob ng {zones} ang simula o destinasyon mo. Mag-ingat doon.',
    tooMany: 'Mas marami ang naiulat na panganib kaysa kayang suriin nang sabay; inuna ang pinakamalapit.',
    openGoogle: 'Buksan sa Google Maps',
    close: 'Isara',
    end: 'Tapusin',
    retry: 'Subukan muli',
    arrive: 'Darating',
    left: 'natitira',
    speed: 'km/h',
    gps: { good: 'Malakas ang GPS', fair: 'Katamtaman ang GPS', poor: 'Mahina ang GPS', lost: 'Walang GPS' },
    gpsLost: 'Nawala ang GPS. Ipinapakita ang huling alam mong lokasyon.',
    gpsDenied: 'Naka-off ang lokasyon. Payagan ang lokasyon para sa site na ito sa browser settings para makapag-navigate.',
    offlineReroute: 'Lumihis ka sa ruta pero hindi makalkula ang bagong ruta ngayon. Bumalik sa asul na linya o tingnan ang koneksyon mo.',
    rerouted: 'Nakalkula na ang bagong ruta.',
    destinationMoved: 'Lumipat ang tao nang {distance}. Na-update ang ruta papunta sa kinaroroonan nila ngayon.',
    reroutedHazard: 'Iniwasan ang bagong naiulat na panganib: {label}.',
    arrived: 'Nakarating ka na',
    voiceOn: 'May boses',
    voiceOff: 'Walang boses',
    headingUp: 'Direksyon pataas',
    northUp: 'Hilaga pataas',
    recenter: 'Ibalik sa akin',
    onRoad: 'Sa {road}',
    then: 'Pagkatapos',
    hazardAhead: 'Mag-ingat: {label} sa unahan, {distance} – {source}.',
    hazardHere: 'Mag-ingat: dumadaan ka sa {label} – {source}.',
    report: 'Mag-ulat',
    reportTitle: 'Mag-ulat sa lokasyon mo',
    reportTypes: { 'Blocked road': 'Nakaharang sa Daan / Puno', Flooding: 'Baha', 'Vehicular accident': 'Aksidente sa Daan', 'Downed power line': 'Nakalaylay na Kable' },
    reportSending: 'Ipinapadala ang ulat…',
    reportSent: 'Naipadala ang ulat. Susuriin ito ng mga administrator.',
    reportNeedsGps: 'Hindi pa alam ang lokasyon mo kaya hindi mailalagay ang ulat.',
  },
}

const REROUTE_COOLDOWN_MS = 20000
const ARRIVAL_M = 30
// A destination that moves (someone sharing their live location after an SOS)
// is routed to again once it has moved this far.
const DESTINATION_MOVE_M = 30
const COLORS = { active: '#2f78b7', alternative: '#8aa1b4', unsafe: '#c94f4e' }

// Arrow direction for each kind of Valhalla maneuver.
// Valhalla maneuver types to Lucide turn arrows.
const MANEUVER_ICONS = {
  4: 'flag', 5: 'flag', 6: 'flag',
  9: 'slightRight', 18: 'slightRight', 20: 'slightRight', 23: 'slightRight', 37: 'slightRight',
  16: 'slightLeft', 19: 'slightLeft', 21: 'slightLeft', 24: 'slightLeft', 38: 'slightLeft',
  10: 'turnRight', 11: 'turnRight',
  14: 'turnLeft', 15: 'turnLeft',
  12: 'uturnRight', 13: 'uturnLeft',
  25: 'merge',
  26: 'roundabout', 27: 'roundabout',
}

function ManeuverIcon({ type, size = 34 }) {
  return <Icon name={MANEUVER_ICONS[type] ?? 'straight'} size={size} strokeWidth={2.4} />
}

function spokenDistance(meters) {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} meters`
  return `${(meters / 1000).toFixed(1)} kilometers`
}

function speak(text) {
  if (!('speechSynthesis' in window)) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '')

// "Flash flood (3 areas), Closed road" instead of repeating each name.
function summarize(zones, areasWord) {
  const counts = new Map()
  zones.forEach((zone) => counts.set(zone.label, (counts.get(zone.label) ?? 0) + 1))
  return [...counts.entries()].map(([label, count]) => (count > 1 ? `${label} (${count} ${areasWord})` : label)).join(', ')
}

// Full-screen, hazard-aware turn-by-turn navigation to `destination`
// ({ latitude, longitude, name, location }). Routes follow real roads, avoid
// verified closures and high-risk zones from `points` and `reports`, and
// recalculate when the person leaves the route or a new hazard is reported.
// Optional: `notice` shows a message when the screen opens; `onStart` and
// `onArrive` are called when navigation starts and ends at the destination;
// `arrivalAction` ({ label, run }) adds a button on arrival; `onQuickReport`
// (type, { latitude, longitude, roadName }) lets the person report a hazard
// at their position with one tap while navigating.
export function NavigationView({ destination, points = [], reports = [], initialPosition = null, defaultMode = 'auto', lang = 'en', notice = '', onStart, onArrive, arrivalAction = null, onQuickReport = null, onClose }) {
  const t = TEXT[lang] ?? TEXT.en
  const target = [destination.latitude, destination.longitude]
  const targetRef = useRef(target)
  targetRef.current = target
  const zones = useMemo(() => hazardZones({ points, reports }), [points, reports])

  const [phase, setPhase] = useState('locating')
  const [mode, setMode] = useState(defaultMode)
  const [routes, setRoutes] = useState([])
  const [selected, setSelected] = useState(0)
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState(null)
  const [hud, setHud] = useState(null)
  const [banner, setBanner] = useState(notice)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportBusy, setReportBusy] = useState(false)
  const [arrivalDone, setArrivalDone] = useState(false)
  const [gps, setGps] = useState({ quality: 'lost', speed: null, denied: false })
  const [voiceOn, setVoiceOn] = useState(true)
  const [headingUp, setHeadingUp] = useState(true)
  const [following, setFollowing] = useState(true)
  const [rotation, setRotation] = useState(0)
  useWakeLock(phase === 'navigating')

  const stageRef = useRef(null)
  const rotatorRef = useRef(null)
  const mapElRef = useRef(null)
  const mapRef = useRef(null)
  const layers = useRef({})
  const fixRef = useRef(null)
  const live = useRef({ planned: false, navigating: false, route: null, hint: 0, displayed: null, heading: 0, spoken: new Set(), deviation: createDeviationTracker(), lastReroute: 0, rerouting: false, frame: 0 })
  // Latest values for the GPS callback, which is registered once.
  const state = useRef({})
  state.current = { phase, mode, voiceOn, following, headingUp, zones, t }

  // ---------------------------------------------------------------- map setup
  useEffect(() => {
    const map = L.map(mapElRef.current, { zoomControl: false, attributionControl: false, zoomSnap: 0.25, minZoom: 9, maxZoom: 19 })
      .setView(target, 15)
    L.tileLayer(mapTileUrl, { maxZoom: 19 }).addTo(map)
    layers.current.hazards = L.layerGroup().addTo(map)
    layers.current.routes = L.layerGroup().addTo(map)
    layers.current.destination = L.marker(target, {
      icon: L.divIcon({ className: 'nav-destination', html: '<span></span>', iconSize: [30, 38], iconAnchor: [15, 36] }),
      keyboard: false,
    }).addTo(map)
    map.on('dragstart', () => setFollowing(false))
    mapRef.current = map

    // The map sits in a square larger than the screen, so it can rotate
    // without showing empty corners.
    const resize = () => {
      const stage = stageRef.current
      const rotator = rotatorRef.current
      if (!stage || !rotator) return
      const side = Math.ceil(Math.hypot(stage.clientWidth, stage.clientHeight))
      Object.assign(rotator.style, { width: `${side}px`, height: `${side}px`, left: `${(stage.clientWidth - side) / 2}px`, top: `${(stage.clientHeight - side) / 2}px` })
      map.invalidateSize()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(stageRef.current)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(live.current.frame)
      window.speechSynthesis?.cancel()
      map.remove()
    }
  }, [])

  // Hazard areas on the map.
  useEffect(() => {
    const group = layers.current.hazards
    if (!group) return
    group.clearLayers()
    zones.forEach((zone) => {
      const color = zone.kind === 'caution' ? '#d9a63b' : '#c94f4e'
      L.circle([zone.lat, zone.lng], {
        radius: zone.radiusM,
        color,
        weight: zone.kind === 'closure' ? 3 : 1.5,
        dashArray: zone.kind === 'caution' ? '5 5' : null,
        fillColor: color,
        fillOpacity: zone.kind === 'caution' ? 0.12 : 0.22,
      }).bindTooltip(`${zone.label}: ${zone.source}`).addTo(group)
    })
  }, [zones])

  // ---------------------------------------------------------------- planning
  async function planRoutes({ origin, heading = null, reroute = false, reason = '' }) {
    const travelMode = state.current.mode
    const target = targetRef.current
    const zones = state.current.zones
    const areas = avoidAreas(zones, origin, target)
    const containingIds = new Set(areas.containing.map((zone) => zone.id))
    live.current.planned = true
    if (!reroute) {
      setPhase('planning')
      setError(null)
    } else {
      live.current.rerouting = true
      setBanner(t.rerouting)
    }
    try {
      let found
      let unsafeOnly = false
      try {
        found = await requestRoutes({ origin, destination: target, mode: travelMode, avoid: areas.polygons, alternatives: reroute ? 1 : 2, heading })
      } catch (planError) {
        if (planError.kind !== 'no-route' || !areas.polygons.length) throw planError
        // No route avoids every hazard. Check whether one exists at all,
        // still never through a verified closed road, so the person can be
        // told plainly instead of being shown a dangerous route as safe.
        const closurePolygons = areas.used.flatMap((zone, index) => (zone.kind === 'closure' ? [areas.polygons[index]] : []))
        found = await requestRoutes({ origin, destination: target, mode: travelMode, avoid: closurePolygons, alternatives: 0, heading })
        unsafeOnly = true
      }
      const evaluated = found.map((route) => {
        const exposure = routeExposure(route.coords, zones)
        const blocking = exposure.filter((zone) => zone.kind !== 'caution' && !containingIds.has(zone.id))
        return { ...route, exposure, blocking, cautions: exposure.filter((zone) => zone.kind === 'caution'), safe: !blocking.length }
      })
      // Safety first, then fewer cautions, then the faster route.
      evaluated.sort((a, b) => Number(b.safe) - Number(a.safe) || a.cautions.length - b.cautions.length || a.timeS - b.timeS)
      const nextPlan = { containing: areas.containing, containingIds, skipped: areas.skipped, avoided: areas.used.length, unsafeOnly }
      setPlan(nextPlan)
      if (reroute) {
        startRoute(evaluated[0], reason || t.rerouted, true)
      } else {
        setRoutes(evaluated)
        setSelected(0)
        setPhase('preview')
        drawPreview(evaluated, 0)
      }
    } catch (planError) {
      if (planError.kind === 'cancelled') return
      if (reroute) {
        setBanner(t.offlineReroute)
      } else {
        setError(planError)
        setPhase('error')
      }
    } finally {
      live.current.rerouting = false
      live.current.lastReroute = Date.now()
    }
  }

  // Padding that keeps fitted content in the visible part of the screen: the
  // map is a square larger than the screen (so it can rotate), and the
  // route panel covers the bottom (phones) or the left side (wider screens).
  function visiblePadding() {
    const stage = stageRef.current
    const side = rotatorRef.current?.clientWidth ?? stage.clientWidth
    const hiddenX = Math.max(0, (side - stage.clientWidth) / 2)
    const hiddenY = Math.max(0, (side - stage.clientHeight) / 2)
    const wide = stage.clientWidth >= 760
    const panelLeft = wide ? 450 : 0
    const panelBottom = wide ? 0 : Math.min(stage.clientHeight * 0.62, 420)
    return { paddingTopLeft: [hiddenX + 30 + panelLeft, hiddenY + 100], paddingBottomRight: [hiddenX + 30, hiddenY + panelBottom + 20] }
  }

  function drawPreview(list, active) {
    const group = layers.current.routes
    group.clearLayers()
    list.forEach((route, index) => {
      if (index === active) return
      L.polyline(route.coords, { color: '#fff', weight: 9, opacity: 0.9 }).addTo(group)
      L.polyline(route.coords, { color: route.safe ? COLORS.alternative : COLORS.unsafe, weight: 5, dashArray: route.safe ? null : '8 8' })
        .on('click', () => { setSelected(index); drawPreview(list, index) })
        .addTo(group)
    })
    const chosen = list[active]
    if (chosen) {
      L.polyline(chosen.coords, { color: '#fff', weight: 11, opacity: 0.95 }).addTo(group)
      L.polyline(chosen.coords, { color: chosen.safe ? COLORS.active : COLORS.unsafe, weight: 7, dashArray: chosen.safe ? null : '10 8' }).addTo(group)
      mapRef.current.fitBounds(L.latLngBounds(chosen.coords).extend(target), visiblePadding())
    }
  }

  function startRoute(route, message = '', isReroute = false) {
    const current = live.current
    current.route = route
    current.navigating = true
    current.hint = 0
    current.spoken = new Set()
    current.deviation.reset()
    // Hazards this route passes (cautions, or any hazard on an unsafe route),
    // with where they begin, for "hazard ahead" warnings.
    current.hazardsAhead = hazardsAlongRoute(route, zones)
    current.warned = new Set()
    const group = layers.current.routes
    group.clearLayers()
    layers.current.casing = L.polyline(route.coords, { color: '#fff', weight: 12, opacity: 0.95 }).addTo(group)
    layers.current.line = L.polyline(route.coords, { color: route.safe ? COLORS.active : COLORS.unsafe, weight: 8, dashArray: route.safe ? null : '10 8' }).addTo(group)
    setPhase('navigating')
    setFollowing(true)
    setBanner(message)
    if (message) setTimeout(() => setBanner((value) => (value === message ? '' : value)), 6000)
    const first = route.maneuvers[0]
    if (state.current.voiceOn) {
      const intro = isReroute ? message : `Starting route to ${destination.name}.`
      speak(`${intro} ${route.safe ? '' : 'Warning. This route is not safe. '}${first.verbal}`)
    }
    if (!isReroute) onStart?.()
    if (fixRef.current) onFix(fixRef.current)
  }

  // Warns once about each hazard the route passes, shortly before reaching it.
  function warnHazardsAhead(alongM) {
    const current = live.current
    const s = state.current
    const lookAhead = s.mode === 'pedestrian' ? 150 : 400
    for (const { zone, alongM: startsAt } of current.hazardsAhead ?? []) {
      const distance = startsAt - alongM
      if (distance > lookAhead || distance < -zone.radiusM || current.warned.has(zone.id)) continue
      current.warned.add(zone.id)
      const source = zone.source.charAt(0).toLowerCase() + zone.source.slice(1)
      const message = distance > 20
        ? fill(t.hazardAhead, { label: zone.label, source, distance: formatMeters(distance) })
        : fill(t.hazardHere, { label: zone.label, source })
      setBanner(message)
      setTimeout(() => setBanner((value) => (value === message ? '' : value)), 9000)
      if (s.voiceOn) speak(distance > 20 ? `Caution. ${zone.label} ahead in ${spokenDistance(distance)}.` : `Caution. You are passing ${zone.label}.`)
      break
    }
  }

  // ---------------------------------------------------------------- GPS
  function onFix(fix) {
    const current = live.current
    const s = state.current
    if (!current.planned) {
      planRoutes({ origin: fix.point })
    }
    // Before navigation starts, just show the person on the map.
    if (!current.navigating || !current.route) {
      moveMarker(fix.point, fix.heading ?? current.heading, fix.accuracy)
      return
    }
    const route = current.route
    const projection = projectOnRoute(fix.point, route.coords, route.cumulative, current.hint)
    current.hint = projection.index
    const onRoute = projection.offsetM <= Math.max(25, fix.accuracy ?? 0)
    // On the route, the marker sits on the road and points along it.
    const shown = onRoute ? projection.snapped : fix.point
    const heading = onRoute
      ? bearing(route.coords[projection.index], route.coords[Math.min(route.coords.length - 1, projection.index + 1)])
      : fix.heading ?? current.heading
    current.heading = heading
    moveMarker(shown, heading, fix.accuracy)
    layers.current.line?.setLatLngs([shown, ...route.coords.slice(projection.index + 1)])
    layers.current.casing?.setLatLngs([shown, ...route.coords.slice(projection.index + 1)])

    const progress = routeProgress(route, projection.alongM)
    setHud({ progress, arrival: new Date(Date.now() + progress.remainingTimeS * 1000) })
    if (progress.remainingM <= ARRIVAL_M || distanceM(fix.point, targetRef.current) <= ARRIVAL_M) {
      current.navigating = false
      setRotation(0)
      mapRef.current.setView(targetRef.current, 17, { animate: true })
      setPhase('arrived')
      if (s.voiceOn) speak(`You have arrived at ${destination.name}.`)
      onArrive?.()
      return
    }
    warnHazardsAhead(projection.alongM)
    if (s.voiceOn) {
      const due = dueAnnouncement(progress, s.mode, current.spoken)
      const verbal = due?.maneuver.verbal ?? ''
      if (due) speak(due.stage === 'now' ? verbal : `In ${spokenDistance(progress.distanceToNextM)}, ${verbal.charAt(0).toLowerCase()}${verbal.slice(1)}`)
    }
    if (s.following) followCamera(shown, heading, fix.speed)
    const off = current.deviation.update(projection.offsetM, fix.accuracy, Date.now())
    if (off && !current.rerouting && Date.now() - current.lastReroute > REROUTE_COOLDOWN_MS) {
      planRoutes({ origin: fix.point, heading: fix.heading, reroute: true })
    }
  }

  function moveMarker(point, heading, accuracy) {
    const map = mapRef.current
    if (!map) return
    const current = live.current
    if (!layers.current.user) {
      layers.current.accuracy = L.circle(point, { radius: isRoughFix(accuracy) ? 0 : accuracy ?? 0, color: '#2f78b7', weight: 1, opacity: 0.5, fillColor: '#2f78b7', fillOpacity: 0.08, interactive: false }).addTo(map)
      layers.current.user = L.marker(point, {
        icon: L.divIcon({ className: 'nav-user', html: '<span class="nav-user-arrow"></span>', iconSize: [34, 34] }),
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000,
      }).addTo(map)
      current.displayed = point
    }
    // Glide from the shown position to the new fix instead of jumping. This
    // only animates between real fixes; it never invents movement.
    cancelAnimationFrame(current.frame)
    const from = current.displayed
    const startedAt = performance.now()
    const step = (now) => {
      const k = Math.min(1, (now - startedAt) / 800)
      const position = [from[0] + (point[0] - from[0]) * k, from[1] + (point[1] - from[1]) * k]
      layers.current.user.setLatLng(position)
      current.displayed = position
      if (k < 1) current.frame = requestAnimationFrame(step)
    }
    current.frame = requestAnimationFrame(step)
    // A rough fix gets no circle (it would cover the whole screen).
    layers.current.accuracy.setLatLng(point).setRadius(isRoughFix(accuracy) ? 0 : accuracy ?? 0)
    const arrow = layers.current.user.getElement()?.querySelector('.nav-user-arrow')
    if (arrow && heading != null) arrow.style.transform = `rotate(${heading}deg)`
  }

  function followCamera(point, heading, speed) {
    const map = mapRef.current
    const s = state.current
    const fast = speed != null && speed > 14
    const zoom = s.mode === 'pedestrian' ? 18 : fast ? 16 : 17
    // Look ahead: the person sits in the lower part of the screen.
    const stage = stageRef.current
    const metersPerPixel = 40075016 * Math.cos(point[0] * Math.PI / 180) / (256 * 2 ** zoom)
    const ahead = s.headingUp ? (stage?.clientHeight ?? 600) * 0.22 * metersPerPixel : 0
    const center = ahead ? offsetPoint(point, heading, ahead) : point
    map.setView(center, zoom, { animate: true, duration: 0.8 })
    if (s.headingUp) setRotation(Math.round(heading))
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      setGps((value) => ({ ...value, denied: true }))
      setError({ kind: 'gps', message: t.gpsDenied })
      setPhase('error')
      return undefined
    }
    let lastPoint = null
    const handle = (position) => {
      const point = [position.coords.latitude, position.coords.longitude]
      // A heading from the GPS if moving; otherwise from the last two fixes.
      let heading = position.coords.heading
      if ((heading == null || Number.isNaN(heading) || (position.coords.speed ?? 0) < 1) && lastPoint && distanceM(lastPoint, point) > 5) heading = bearing(lastPoint, point)
      if (heading == null || Number.isNaN(heading)) heading = null
      if (!lastPoint || distanceM(lastPoint, point) > 5) lastPoint = point
      const fix = { point, accuracy: position.coords.accuracy, heading, speed: position.coords.speed, at: Date.now() }
      fixRef.current = fix
      setGps({ quality: gpsQuality(fix.accuracy, 0), speed: fix.speed, denied: false })
      onFix(fix)
    }
    if (initialPosition && Date.now() - (initialPosition.at ?? 0) < 120000) {
      handle({ coords: { latitude: initialPosition.latitude, longitude: initialPosition.longitude, accuracy: initialPosition.accuracy, heading: null, speed: null } })
    }
    const watchId = navigator.geolocation.watchPosition(handle, (watchError) => {
      if (watchError.code === watchError.PERMISSION_DENIED) {
        setGps((value) => ({ ...value, denied: true, quality: 'lost' }))
        if (state.current.phase === 'locating') {
          setError({ kind: 'gps', message: t.gpsDenied })
          setPhase('error')
        }
      }
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 })
    // GPS counts as lost when no fix has arrived for 15 seconds.
    const timer = setInterval(() => {
      const fix = fixRef.current
      const quality = gpsQuality(fix?.accuracy, fix ? Date.now() - fix.at : Infinity)
      setGps((value) => (value.quality === quality ? value : { ...value, quality }))
    }, 3000)
    return () => {
      navigator.geolocation.clearWatch(watchId)
      clearInterval(timer)
    }
  }, [])

  // A newly reported hazard on the current route triggers a reroute.
  useEffect(() => {
    const route = live.current.route
    const fix = fixRef.current
    if (!live.current.navigating || !route || !fix || live.current.rerouting) return
    const ahead = route.coords.slice(live.current.hint)
    const blocking = routeExposure(ahead, zones).filter((zone) => zone.kind !== 'caution' && !plan?.containingIds?.has(zone.id) && !route.blocking?.some((known) => known.id === zone.id))
    if (blocking.length) planRoutes({ origin: fix.point, heading: fix.heading, reroute: true, reason: fill(t.reroutedHazard, { label: blocking[0].label }) })
  }, [zones])

  // Map rotation follows the direction of travel only while following.
  const appliedRotation = phase === 'navigating' && headingUp && following ? rotation : 0

  const showBriefly = (message, ms = 6000) => {
    setBanner(message)
    setTimeout(() => setBanner((value) => (value === message ? '' : value)), ms)
  }

  // The destination moved (live location after an SOS): move the pin, and plan
  // again from here once it has moved far enough to matter.
  const routedTargetRef = useRef(target)
  useEffect(() => {
    layers.current.destination?.setLatLng(target)
    const moved = distanceM(routedTargetRef.current, target)
    if (moved < DESTINATION_MOVE_M) return
    const fix = fixRef.current
    const current = live.current
    if (!fix || !current.planned || current.rerouting) return
    routedTargetRef.current = target
    const message = fill(t.destinationMoved, { distance: formatMeters(moved) })
    if (current.navigating) {
      planRoutes({ origin: fix.point, heading: fix.heading, reroute: true, reason: message })
    } else if (state.current.phase === 'preview') {
      showBriefly(message)
      planRoutes({ origin: fix.point })
    }
  }, [target[0], target[1]])

  useEffect(() => {
    if (notice) setTimeout(() => setBanner((value) => (value === notice ? '' : value)), 10000)
  }, [])

  // One-tap report of a hazard where the person is now.
  const sendQuickReport = async (type) => {
    const fix = fixRef.current
    setReportOpen(false)
    if (!fix || gpsQuality(fix.accuracy, Date.now() - fix.at) === 'lost') {
      showBriefly(t.reportNeedsGps)
      return
    }
    setReportBusy(true)
    setBanner(t.reportSending)
    try {
      await onQuickReport(type, { latitude: fix.point[0], longitude: fix.point[1], accuracy: fix.accuracy, roadName: hud?.progress?.roadName ?? null })
      showBriefly(t.reportSent)
    } catch (reportError) {
      showBriefly(reportError.message, 9000)
    } finally {
      setReportBusy(false)
    }
  }

  const runArrivalAction = async () => {
    try {
      await arrivalAction.run()
      setArrivalDone(true)
    } catch (actionError) {
      showBriefly(actionError.message, 9000)
    }
  }

  const recenter = () => {
    setFollowing(true)
    const fix = fixRef.current
    if (fix) followCamera(live.current.displayed ?? fix.point, live.current.heading, fix.speed)
  }

  const retry = () => {
    const fix = fixRef.current
    if (fix) planRoutes({ origin: fix.point })
    else setPhase('locating')
  }

  const changeMode = (next) => {
    if (next === mode) return
    setMode(next)
    state.current.mode = next
    const fix = fixRef.current
    if (fix) planRoutes({ origin: fix.point })
  }

  const end = () => {
    live.current.navigating = false
    window.speechSynthesis?.cancel()
    onClose()
  }

  const chosen = routes[selected]
  const progress = hud?.progress
  const googleLink = <a class="nav-link-button" href={directionsUrl(destination)} target="_blank" rel="noreferrer"><Icon name="navigate" size={15} /> {t.openGoogle}</a>

  return <div class="nav-view" role="dialog" aria-modal="true" aria-label={`Navigation to ${destination.name}`}>
    <div class="nav-stage" ref={stageRef}>
      <div class="nav-rotator" ref={rotatorRef} style={{ transform: `rotate(${-appliedRotation}deg)` }}>
        <div class="nav-map" ref={mapElRef} />
      </div>
    </div>

    {/* Top: the next instruction while navigating, the destination otherwise,
        with any messages stacked underneath. */}
    <div class="nav-top-stack">
    {phase === 'navigating' && progress && <div class="nav-instruction" role="status" aria-live="polite">
      <span class="nav-instruction-icon"><ManeuverIcon type={(progress.next ?? progress.current).type} /></span>
      <div>
        <strong>{progress.next ? formatMeters(progress.distanceToNextM) : formatMeters(progress.remainingM)}</strong>
        <p>{(progress.next ?? progress.current).instruction}</p>
        {progress.roadName && <small>{fill(t.onRoad, { road: progress.roadName })}</small>}
      </div>
    </div>}
    {phase !== 'navigating' && <div class="nav-top">
      <div><small>{destination.location || ''}</small><strong>{destination.name}</strong></div>
      <button type="button" class="nav-icon-button" onClick={end} aria-label={t.close}><Icon name="x" size={20} /></button>
    </div>}

    {banner && <p class="nav-banner" role="status">{banner}</p>}
    {phase === 'navigating' && gps.quality === 'lost' && <p class="nav-banner is-warning" role="alert">{t.gpsLost}</p>}
    </div>

    {/* Map buttons while navigating */}
    {phase === 'navigating' && <div class="nav-side-buttons">
      <button type="button" class={`nav-icon-button${voiceOn ? ' is-on' : ''}`} onClick={() => { setVoiceOn(!voiceOn); if (voiceOn) window.speechSynthesis?.cancel() }} aria-pressed={voiceOn} aria-label={voiceOn ? t.voiceOn : t.voiceOff} title={voiceOn ? t.voiceOn : t.voiceOff}>
        <Icon name="bell" size={18} />
      </button>
      <button type="button" class="nav-icon-button" onClick={() => setHeadingUp(!headingUp)} aria-pressed={headingUp} aria-label={headingUp ? t.headingUp : t.northUp} title={headingUp ? t.headingUp : t.northUp}>
        <span class="nav-compass" style={{ transform: `rotate(${-appliedRotation}deg)` }}>N</span>
      </button>
      {onQuickReport && <button type="button" class="nav-report-button" onClick={() => setReportOpen(!reportOpen)} disabled={reportBusy} aria-expanded={reportOpen}>
        <Icon name="alert" size={16} /> {t.report}
      </button>}
      {!following && <button type="button" class="nav-recenter" onClick={recenter}><Icon name="locate" size={16} /> {t.recenter}</button>}
    </div>}

    {reportOpen && <div class="nav-report-sheet" role="group" aria-label={t.reportTitle}>
      <strong>{t.reportTitle}</strong>
      <div>
        {Object.entries(t.reportTypes).map(([type, label]) => <button type="button" key={type} onClick={() => sendQuickReport(type)}>{label}</button>)}
      </div>
    </div>}

    {/* Bottom panel */}
    <section class="nav-panel">
      {phase === 'locating' && <p class="nav-wait"><span class="btn-spinner" aria-hidden="true" /> {t.locating}</p>}
      {phase === 'planning' && <p class="nav-wait"><span class="btn-spinner" aria-hidden="true" /> {t.planning}</p>}

      {phase === 'error' && <div class="nav-error">
        <p role="alert">{error?.message}</p>
        <div class="nav-actions">
          {error?.kind !== 'gps' && <button type="button" class="nav-primary" onClick={retry}>{t.retry}</button>}
          {googleLink}
        </div>
      </div>}

      {phase === 'preview' && chosen && <div class="nav-preview">
        <div class="nav-mode" role="group" aria-label="Travel mode">
          <button type="button" class={mode === 'auto' ? 'is-active' : ''} onClick={() => changeMode('auto')}>{t.drive}</button>
          <button type="button" class={mode === 'pedestrian' ? 'is-active' : ''} onClick={() => changeMode('pedestrian')}>{t.walk}</button>
        </div>
        {plan?.unsafeOnly && <p class="nav-warning is-danger" role="alert">{t.noSafeRoute}</p>}
        {plan?.containing?.length > 0 && <p class="nav-warning">{fill(t.insideZone, { zones: summarize(plan.containing, t.areas) })}</p>}
        {plan?.skipped?.length > 0 && <p class="nav-warning">{t.tooMany}</p>}
        <div class="nav-route-list">
          {routes.map((route, index) => <button type="button" key={index} class={`nav-route${index === selected ? ' is-selected' : ''}${route.safe ? '' : ' is-unsafe'}`} onClick={() => { setSelected(index); drawPreview(routes, index) }}>
            <span class="nav-route-time">{formatMinutes(route.timeS)}</span>
            <span class="nav-route-meta">{formatMeters(route.distanceM)}{route.via ? ` · ${fill(t.via, { road: route.via })}` : ''}</span>
            <span class="nav-route-label">{!route.safe ? t.notRecommended : index === 0 ? t.recommended : t.alternative}</span>
            <span class={`nav-route-safety${route.safe ? (route.cautions.length ? ' is-caution' : ' is-safe') : ' is-unsafe'}`}>
              {!route.safe ? `${t.unsafe} ${summarize(route.blocking, t.areas)}`
                : route.cautions.length ? `${t.caution} ${summarize(route.cautions, t.areas)}`
                  : plan?.avoided ? fill(t.avoided, { count: plan.avoided }) : t.safe}
            </span>
          </button>)}
        </div>
        <div class="nav-actions">
          <button type="button" class={`nav-primary${chosen.safe ? '' : ' is-danger'}`} onClick={() => startRoute(chosen)}>{chosen.safe ? t.start : t.startUnsafe}</button>
          {googleLink}
        </div>
      </div>}

      {phase === 'navigating' && progress && <div class="nav-progress">
        <div class="nav-eta">
          <strong>{formatMinutes(progress.remainingTimeS)}</strong>
          <span>{formatMeters(progress.remainingM)} · {t.arrive} {hud.arrival.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
        </div>
        <div class="nav-status">
          {gps.speed != null && gps.speed >= 0 && <span class="nav-speed"><b>{Math.round(gps.speed * 3.6)}</b> {t.speed}</span>}
          <span class={`nav-gps nav-gps--${gps.quality}`}><i /> {t.gps[gps.quality]}</span>
        </div>
        <button type="button" class="nav-end" onClick={end}>{t.end}</button>
      </div>}

      {phase === 'arrived' && <div class="nav-arrived">
        <Icon name="check" size={26} />
        <div><strong>{t.arrived}</strong><span>{destination.name}</span></div>
        {arrivalAction && !arrivalDone && <button type="button" class="nav-primary" onClick={runArrivalAction}>{arrivalAction.label}</button>}
        <button type="button" class={arrivalAction && !arrivalDone ? 'nav-secondary' : 'nav-primary'} onClick={end}>{t.close}</button>
      </div>}
      <p class="nav-attribution">Map and road data © OpenStreetMap contributors · {ROUTING_ATTRIBUTION.split(' · ')[0]}</p>
    </section>
  </div>
}
