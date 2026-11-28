import { useEffect, useRef, useState } from 'preact/hooks'
import { PriorityTags } from '../../components/PriorityTags.jsx'
import { isLiveFresh } from '../../lib/callLocation.js'
import { describeLocation } from '../../lib/geocode.js'
import { avoidAreas, hazardZones } from '../../lib/hazards.js'
import { distanceM, formatMeters, formatMinutes } from '../../lib/navigation.js'
import { requestTravelTimes } from '../../lib/routing.js'
import { Icon, directionsUrl, reportTypeLabel, reportTypeStyle, timeAgo } from '../../lib/ui.jsx'
import { centerLoad, centerTitle, hasPin, mayHaveRoom } from '../../lib/centers.js'

// A call picked on the field map: where exactly it is and how sure that is,
// how long it takes to get there by road, who is involved, and the same
// actions as in the queue (take the call, navigate, update the stage).

const ROAD_REFRESH_M = 150
const ADDRESS_REFRESH_M = 30

function positionLine(report) {
  if (report.isLive) {
    const fresh = isLiveFresh(report)
    return {
      tone: fresh ? 'live' : 'stale',
      text: fresh ? `Live location · updated ${timeAgo(report.locationUpdatedAt).toLowerCase()}` : `Last live location · ${timeAgo(report.locationUpdatedAt).toLowerCase()}`,
    }
  }
  if (report.location_source === 'pin') return { tone: 'pin', text: 'Pinned on the map by the reporter' }
  return { tone: 'sent', text: `Location sent with the ${report.report_type === 'SOS' ? 'SOS' : 'report'} · ${timeAgo(report.created_at).toLowerCase()}` }
}

// Free space at a center, said honestly: an estimate says so, and an unknown
// capacity is never shown as a number.
function spaceText(center) {
  const load = centerLoad(center)
  if (load.status === 'unverified') return center.occupants > 0 ? `${center.occupants} sheltered · capacity not confirmed` : 'Capacity not confirmed'
  if (load.status === 'estimated') return `About ${load.spaceLow}–${load.spaceHigh} spaces free (estimate)`
  return `${load.spaceLow} of ${center.capacity} spaces free`
}

// The open centers nearest the call (straight line), for where to bring people.
function nearestCenters(centers, target, count = 2) {
  return centers
    .filter((center) => center.is_open && hasPin(center))
    .map((center) => ({ center, meters: distanceM(target, [center.latitude, center.longitude]) }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, count)
}

export function CallSheet({ report, myPosition, points, reports, centers = [], isTampered, actions, onClose }) {
  const [address, setAddress] = useState({ status: 'idle', label: '' })
  const [road, setRoad] = useState({ status: 'idle' })
  const addressAtRef = useRef(null)
  const roadFromRef = useRef(null)
  const type = reportTypeStyle(report.report_type)
  const target = [report.latitude, report.longitude]
  const position = positionLine(report)
  const isGpsOnly = /^GPS\s/i.test(report.location ?? '')

  // The street and barangay, looked up again when the person has moved.
  useEffect(() => {
    const last = addressAtRef.current
    if (last && last.id === report.id && distanceM(last.point, target) < ADDRESS_REFRESH_M) return undefined
    addressAtRef.current = { id: report.id, point: target }
    const controller = new AbortController()
    setAddress((current) => ({ status: 'looking', label: current.label }))
    describeLocation(target[0], target[1], { signal: controller.signal, onPartial: (result) => setAddress({ status: 'looking', label: result.label }) })
      .then((result) => setAddress({ status: 'done', label: result.label }))
      .catch((error) => { if (error.name !== 'AbortError') setAddress({ status: 'failed', label: '' }) })
    return () => controller.abort()
  }, [report.id, target[0], target[1]])

  // Time and distance by road, avoiding reported hazards, from the rescuer.
  useEffect(() => {
    if (!myPosition) {
      setRoad({ status: 'no-position' })
      return undefined
    }
    const origin = [myPosition.latitude, myPosition.longitude]
    const last = roadFromRef.current
    if (last && last.id === report.id && distanceM(last.origin, origin) < ROAD_REFRESH_M && distanceM(last.target, target) < ROAD_REFRESH_M) return undefined
    roadFromRef.current = { id: report.id, origin, target }
    const controller = new AbortController()
    setRoad((current) => ({ ...current, status: 'looking' }))
    const zones = hazardZones({ points, reports })
    requestTravelTimes({ origin, targets: [target], avoid: avoidAreas(zones, origin, target).polygons, signal: controller.signal })
      .then(([travel]) => setRoad(travel ? { status: 'done', ...travel } : { status: 'no-route' }))
      .catch(() => { if (!controller.signal.aborted) setRoad({ status: 'failed' }) })
    return () => controller.abort()
  }, [report.id, target[0], target[1], myPosition?.latitude, myPosition?.longitude])

  const straightM = myPosition ? distanceM([myPosition.latitude, myPosition.longitude], target) : null
  const accuracy = report.accuracy

  return <section class={`rx-call-sheet rx-tone--${type.tone}${report.priority === 'Critical' ? ' is-critical' : ''}`} aria-label={`${reportTypeLabel(report)} call`}>
    <div class="rx-sheet-head">
      <span class="rx-type-icon"><Icon name={type.icon} size={22} /></span>
      <div>
        <strong>{reportTypeLabel(report)}</strong>
        <small><Icon name="clock" size={12} /> {timeAgo(report.created_at)}{report.priority !== 'Normal' ? ` · ${report.priority}` : ''}</small>
      </div>
      <button type="button" class="rx-sheet-close" onClick={onClose} aria-label="Close call details"><Icon name="x" size={18} /></button>
    </div>

    <div class="rx-sheet-place">
      <p class="rx-sheet-address">
        <Icon name="pin" size={16} />
        <span>
          {address.label || (isGpsOnly ? (address.status === 'failed' ? report.location : 'Finding the address…') : report.location)}
          {!isGpsOnly && address.label && address.label !== report.location && <small>Reporter wrote: {report.location}</small>}
        </span>
      </p>
      <p class={`rx-sheet-position is-${position.tone}`}>
        <i aria-hidden="true" />
        <span>{position.text}{accuracy ? ` · accurate to about ${formatMeters(accuracy)}` : ''}</span>
      </p>
      {accuracy >= 100 && <p class="rx-sheet-search"><Icon name="locate" size={14} /> GPS was rough: search within about {formatMeters(accuracy)} of the pin, and call the person to confirm.</p>}
      <p class="rx-sheet-road">
        <Icon name="navigate" size={15} />
        {road.status === 'done' && <span><b>{formatMinutes(road.timeS)}</b> by road · {formatMeters(road.distanceM)}</span>}
        {road.status === 'looking' && <span>Working out the road route…</span>}
        {road.status === 'no-route' && <span class="is-warning">No safe road route found. Check hazards on the way.</span>}
        {road.status === 'failed' && <span>{straightM != null ? `${formatMeters(straightM)} away in a straight line` : 'Distance unavailable'}</span>}
        {road.status === 'no-position' && <span>Turn on location to see the distance.</span>}
      </p>
    </div>

    {isTampered && <p class="integrity-warning" role="alert"><Icon name="alert" size={15} /><span><b>Changed outside the app.</b> Confirm with operations before responding.</span></p>}
    {report.location_flag && <p class="location-warning" role="note"><Icon name="alert" size={15} /><span><b>Check before going:</b> {report.location_flag}. Call the reporter to confirm where they are.</span></p>}

    {(report.priority_needs?.length || report.priority_pending?.length || report.people_affected > 0) ? <div class="rx-call-tags">
      <PriorityTags needs={report.priority_needs} pending={report.priority_pending} />
      {report.people_affected > 0 && <span><Icon name="users" size={14} /> {report.people_affected} {report.people_affected === 1 ? 'person' : 'people'}</span>}
    </div> : null}
    {report.notes && <p class="rx-sheet-notes">{report.notes}</p>}

    {(report.contact_name || report.contact_phone) && <div class="rx-call-contact">
      <span><Icon name="user" size={14} /> {report.contact_name || 'Reporter'}</span>
      {report.contact_phone
        ? <a href={`tel:${report.contact_phone.replace(/[^+\d]/g, '')}`}><Icon name="phone" size={15} /> Call</a>
        : <small>No phone number</small>}
    </div>}

    {centers.length > 0 && <div class="rx-sheet-centers">
      <h4><Icon name="home" size={14} /> Nearest open evacuation centers</h4>
      <ul>
        {nearestCenters(centers, target).map(({ center, meters }) => <li key={center.id} class={mayHaveRoom(center) ? '' : 'is-full'}>
          <strong>{centerTitle(center)}</strong>
          <span>{formatMeters(meters)} from the call (straight line) · {mayHaveRoom(center) ? spaceText(center) : 'Full'}</span>
        </li>)}
      </ul>
    </div>}

    {actions}
    <a class="rx-sheet-google" href={directionsUrl(report)} target="_blank" rel="noreferrer">Open in Google Maps</a>
  </section>
}
