import { useEffect, useState } from 'preact/hooks'
import { Icon, distanceKm, formatDistance } from '../lib/ui.jsx'
import { Portal } from './Portal.jsx'
import {
  BARANGAYS,
  centerCapacity,
  centerLoad,
  centerSummary,
  centerTitle,
  classificationOf,
  contactNumbers,
  facilityTypeLabel,
  hasPin,
  locationStatusOf,
} from '../lib/centers.js'

// Evacuation centers for residents: an honest one-line capacity, the official
// or temporary label, a details panel, and the full list with filters.

// One line about capacity and how full the center is. Estimates say so, and an
// unknown capacity is never shown as a number.
export function capacityLine(center, t) {
  const load = centerLoad(center)
  if (load.status === 'documented') return t('capacity', { occupants: center.occupants, capacity: center.capacity })
  if (load.status === 'estimated') {
    return center.occupants > 0
      ? t('capEstimate', { occupants: center.occupants, low: load.spaceLow, high: load.spaceHigh })
      : t('capEstimateEmpty', { low: center.capacity, high: center.capacity_max })
  }
  return center.occupants > 0 ? t('capUnverifiedCount', { occupants: center.occupants }) : t('capUnverifiedEmpty')
}

// Map popup wording in the resident's language (see drawEvacuationCenters).
export function centerMapLabels(t, lang) {
  return {
    official: t('centerOfficialLong'),
    temporary: t('centerTemporaryLong'),
    center: t('legendCenter'),
    closed: t('closed'),
    type: (type) => facilityTypeLabel(type, lang),
    capacity: (center) => capacityLine(center, t),
    unconfirmedPin: t('locUnconfirmed'),
  }
}

export function CenterKindChip({ center, t }) {
  const kind = classificationOf(center)
  if (!kind) return null
  return <span class={`center-kind is-${kind}`}>{kind === 'official' ? t('centerOfficial') : t('centerTemporary')}</span>
}

function CapacityDetail({ center, t }) {
  const capacity = centerCapacity(center)
  if (capacity.status === 'documented') return <><strong>{t('capDocumented', { count: capacity.low.toLocaleString() })}</strong><small>{t('capDocumentedNote')}</small></>
  if (capacity.status === 'estimated') {
    return <><strong>{t('capEstimated', { low: capacity.low, high: capacity.high })}</strong><small>{t('capEstimatedNote', { source: center.capacity_source || 'MDRRMO guidance' })}</small></>
  }
  return <strong>{t('capUnverified')}</strong>
}

// Everything known about a center; fields with nothing in them are left out.
export function CenterDetails({ center, t, lang }) {
  const kind = classificationOf(center)
  const numbers = contactNumbers(center)
  const location = locationStatusOf(center)
  return <dl class="center-details">
    {kind && <div><dt>{t('detailClassification')}</dt><dd><strong>{kind === 'official' ? t('centerOfficialLong') : t('centerTemporaryLong')}</strong><small>{kind === 'official' ? t('centerOfficialHelp') : t('centerTemporaryHelp')}</small></dd></div>}
    {center.facility_type && <div><dt>{t('detailType')}</dt><dd>{facilityTypeLabel(center.facility_type, lang)}</dd></div>}
    {center.barangay && <div><dt>{t('detailBarangay')}</dt><dd>{center.barangay}</dd></div>}
    <div><dt>{t('detailAddress')}</dt><dd>{center.location}</dd></div>
    <div><dt>{t('detailCoordinates')}</dt><dd>{hasPin(center)
      ? <><span>{center.latitude.toFixed(5)}, {center.longitude.toFixed(5)}</span><small>{location === 'confirmed' ? t('locConfirmed') : t('locUnconfirmed')}</small></>
      : <small>{t('locUnknown')}</small>}</dd></div>
    <div><dt>{t('detailCapacity')}</dt><dd><CapacityDetail center={center} t={t} /></dd></div>
    {numbers.length > 0 && <div><dt>{t('detailContact')}</dt><dd class="center-contacts">{numbers.map((number) => <a href={`tel:${number.tel}`} key={number.tel}><Icon name="phone" size={14} /> {number.text}</a>)}</dd></div>}
    {center.source && <div><dt>{t('detailSource')}</dt><dd>{center.source}</dd></div>}
    {center.remarks && <div><dt>{t('detailRemarks')}</dt><dd>{center.remarks}</dd></div>}
  </dl>
}

const sameText = (a, b) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

// Every evacuation center, official ones first, then the resident's own
// barangay, then by distance when the location is known. Filters: official or
// temporary, and barangay.
export function CentersDirectory({ centers, userPosition, homeBarangay, t, lang, onClose, onNavigate, onShowOnMap }) {
  const [kind, setKind] = useState('all')
  const [barangay, setBarangay] = useState('')

  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  const summary = centerSummary(centers)
  const counts = { all: centers.length, official: summary.official, temporary: summary.temporary }
  const barangays = BARANGAYS.filter((name) => centers.some((center) => center.barangay === name))
  const visible = centers
    .filter((center) => kind === 'all' || classificationOf(center) === kind)
    .filter((center) => !barangay || center.barangay === barangay)
    .map((center) => ({ ...center, distance: userPosition && hasPin(center) ? distanceKm(userPosition, center) : null }))
    .sort((a, b) => {
      const rank = (center) => (classificationOf(center) === 'official' ? 0 : 1) * 2 + (sameText(center.barangay, homeBarangay) ? 0 : 1)
      if (rank(a) !== rank(b)) return rank(a) - rank(b)
      if (userPosition && (a.distance ?? Infinity) !== (b.distance ?? Infinity)) return (a.distance ?? Infinity) - (b.distance ?? Infinity)
      return (a.barangay ?? '').localeCompare(b.barangay ?? '') || a.name.localeCompare(b.name)
    })

  return <Portal><div class="alert-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section class="alert-modal centers-directory" role="dialog" aria-modal="true" aria-labelledby="centers-directory-title">
      <div class="alert-modal-heading">
        <div>
          <h2 id="centers-directory-title">{t('allCentersTitle')}</h2>
          <p class="centers-directory-summary">{t('allCentersSummary', { total: summary.total, official: summary.official, temporary: summary.temporary })} · {t('centersOnMap')}: {summary.onMap}</p>
        </div>
        <button type="button" class="alert-modal-close" aria-label={t('close')} onClick={onClose}>×</button>
      </div>
      <div class="centers-directory-filters">
        <div class="centers-kind-filter" role="group" aria-label={t('detailClassification')}>
          {[['all', t('filterAll')], ['official', t('filterOfficial')], ['temporary', t('filterTemporary')]].map(([value, label]) => <button
            type="button"
            key={value}
            class={`${kind === value ? 'is-active' : ''}${value !== 'all' ? ` is-${value}` : ''}`}
            aria-pressed={kind === value}
            onClick={() => setKind(value)}
          >{label} <b>{counts[value]}</b></button>)}
        </div>
        <select value={barangay} onChange={(event) => setBarangay(event.currentTarget.value)} aria-label={t('detailBarangay')}>
          <option value="">{t('allBarangays')}</option>
          {barangays.map((name) => <option value={name} key={name}>{name}</option>)}
        </select>
      </div>
      <div class="centers-directory-list">
        {visible.length === 0 && <p class="admin-empty-state">{t('noCentersMatch')}</p>}
        {visible.map((center) => {
          const centerKind = classificationOf(center)
          return <article class={`center-entry${centerKind ? ` is-${centerKind}` : ''}${center.is_open ? '' : ' is-closed'}`} key={center.id}>
            <div class="center-entry-head">
              <span class="center-entry-icon" aria-hidden="true"><Icon name="home" size={16} /></span>
              <div>
                <strong>{centerTitle(center)}</strong>
                <span>{[center.facility_type ? facilityTypeLabel(center.facility_type, lang) : null, center.barangay, center.distance != null ? t('away', { distance: formatDistance(center.distance) }) : null].filter(Boolean).join(' · ')}</span>
              </div>
              <CenterKindChip center={center} t={t} />
            </div>
            <p class="center-entry-capacity">{capacityLine(center, t)}{center.is_open ? '' : ` · ${t('closed')}`}</p>
            {!hasPin(center) && <p class="center-entry-note"><Icon name="pin" size={13} /> {t('notOnMap')}</p>}
            <details class="center-entry-details">
              <summary>{t('centerDetails')}</summary>
              <CenterDetails center={center} t={t} lang={lang} />
            </details>
            {hasPin(center) && <div class="evac-actions">
              <button type="button" class="evac-navigate" onClick={() => onNavigate(center)}><Icon name="navigate" size={16} /> {t('navigate')}</button>
              <button type="button" class="evac-show" onClick={() => onShowOnMap(center)}><Icon name="pin" size={16} /> {t('showOnMap')}</button>
            </div>}
          </article>
        })}
      </div>
    </section>
  </div></Portal>
}
