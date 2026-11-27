import { useEffect, useRef, useState } from 'preact/hooks'
import { Icon, REPORT_TYPE_LABELS } from '../../lib/ui.jsx'
import { getAnalyticsData } from '../../lib/supabase.js'

const RANGES = [
  [7, 'Last 7 days'],
  [14, 'Last 14 days'],
  [30, 'Last 30 days'],
  [90, 'Last 90 days'],
  [365, 'Last 365 days'],
  ['all', 'All time'],
  ['custom', 'Custom'],
]
const DAY_MS = 86400000
// Days start at midnight in Santa Maria (Asia/Manila, UTC+8 all year), on
// every device, whatever its own time zone.
const MANILA_OFFSET_MS = 8 * 3600000
const TIME_ZONE = 'Asia/Manila'
const manilaDayStart = (ms) => Math.floor((ms + MANILA_OFFSET_MS) / DAY_MS) * DAY_MS - MANILA_OFFSET_MS
// "2026-11-27" (a Manila date) <-> the moment that day starts.
const dateInputValue = (ms) => new Date(ms + MANILA_OFFSET_MS).toISOString().slice(0, 10)
function parseDateInput(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  if (!match) return null
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) - MANILA_OFFSET_MS
  return Number.isNaN(ms) ? null : ms
}
const formatDay = (ms, options) => new Date(ms).toLocaleDateString([], { timeZone: TIME_ZONE, ...options })

// The chosen period as [start, end): whole Manila days, ending tonight.
// "All time" starts at the first stored report (null until loaded).
function periodFor(range, custom) {
  const end = manilaDayStart(Date.now()) + DAY_MS
  if (typeof range === 'number') return { start: end - range * DAY_MS, end }
  if (range === 'all') return { start: null, end }
  return { start: parseDateInput(custom.from), end: parseDateInput(custom.to) + DAY_MS }
}

// Short periods are shown per day, longer ones per week or per month.
function bucketsFor(start, end) {
  const days = Math.round((end - start) / DAY_MS)
  if (days <= 31) {
    return { unit: 'day', items: Array.from({ length: days }, (_, index) => {
      const from = start + index * DAY_MS
      return { from, to: from + DAY_MS, label: formatDay(from, { month: 'numeric', day: 'numeric' }), fullLabel: formatDay(from, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) }
    }) }
  }
  if (days <= 183) {
    const items = []
    for (let from = start; from < end; from += 7 * DAY_MS) {
      const to = Math.min(from + 7 * DAY_MS, end)
      items.push({ from, to, label: formatDay(from, { month: 'numeric', day: 'numeric' }), fullLabel: `${formatDay(from, { month: 'short', day: 'numeric' })} – ${formatDay(to - DAY_MS, { month: 'short', day: 'numeric', year: 'numeric' })}` })
    }
    return { unit: 'week', items }
  }
  const items = []
  // Over a year, months carry the year too ("Nov 25", "Nov 26").
  const monthLabel = days > 366 ? { month: 'short', year: '2-digit' } : { month: 'short' }
  const first = new Date(start + MANILA_OFFSET_MS)
  let year = first.getUTCFullYear()
  let month = first.getUTCMonth()
  for (let from = start; from < end;) {
    const next = Date.UTC(year, month + 1, 1) - MANILA_OFFSET_MS
    const to = Math.min(next, end)
    items.push({ from, to, label: formatDay(from, monthLabel), fullLabel: formatDay(from, { month: 'long', year: 'numeric' }) })
    from = to
    month += 1
    if (month > 11) { month = 0; year += 1 }
  }
  return { unit: 'month', items }
}

function formatDuration(minutes) {
  if (minutes == null) return '–'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const hours = minutes / 60
  return hours < 24 ? `${hours.toFixed(1)} hr` : `${(hours / 24).toFixed(1)} days`
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

// Rounds the axis top up to an even step so the midpoint tick is a whole number.
function niceMax(value) {
  if (value <= 4) return 4
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const max = Math.ceil(value / magnitude) * magnitude
  return (max / magnitude) % 2 ? max + magnitude : max
}

function DataTable({ caption, rows, valueLabel }) {
  return <details class="chart-table">
    <summary>Show data table</summary>
    <table>
      <caption class="sr-only">{caption}</caption>
      <thead><tr><th scope="col">{rows.label}</th><th scope="col">{valueLabel}</th></tr></thead>
      <tbody>{rows.items.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.value}</td></tr>)}</tbody>
    </table>
  </details>
}

// Single-series column chart: one hue, no legend (the title names the series).
function ColumnChart({ title, subtitle, items, unitLabel = 'Day' }) {
  const [active, setActive] = useState(null)
  const max = niceMax(Math.max(...items.map((item) => item.value), 0))
  const showEvery = items.length > 14 ? 3 : items.length > 7 ? 2 : 1
  const peak = items.reduce((best, item, index) => (item.value > (items[best]?.value ?? -1) ? index : best), 0)

  return <figure class="chart-card">
    <figcaption><strong>{title}</strong><span>{subtitle}</span></figcaption>
    <div class="column-chart" onPointerLeave={() => setActive(null)}>
      <div class="chart-grid" aria-hidden="true">
        {[max, max / 2, 0].map((tick) => <div key={tick}><span>{Math.round(tick).toLocaleString()}</span></div>)}
      </div>
      <div class="chart-columns" style={{ '--count': items.length }}>
        {items.map((item, index) => <button
          type="button"
          class={`chart-column${active === index ? ' is-active' : ''}`}
          key={item.label}
          aria-label={`${item.fullLabel}: ${item.value} ${item.value === 1 ? 'report' : 'reports'}`}
          onPointerEnter={() => setActive(index)}
          onFocus={() => setActive(index)}
          onBlur={() => setActive(null)}
        >
          <i style={{ height: `${item.value / max * 100}%` }} />
          {index === peak && item.value > 0 && <b class="chart-peak" style={{ bottom: `${item.value / max * 100}%` }}>{item.value}</b>}
          <span class="chart-axis-label" aria-hidden="true">{index % showEvery === 0 ? item.label : ''}</span>
          {active === index && <span class="chart-tooltip" role="presentation"><strong>{item.value}</strong><small>{item.fullLabel}</small></span>}
        </button>)}
      </div>
    </div>
    <DataTable caption={title} rows={{ label: unitLabel, items: items.map((item) => ({ label: item.fullLabel, value: item.value })) }} valueLabel="Reports" />
  </figure>
}

// Single-series horizontal bars with the value at each bar's tip.
function BarList({ title, subtitle, items, empty }) {
  const [active, setActive] = useState(null)
  const max = Math.max(...items.map((item) => item.value), 1)
  return <figure class="chart-card">
    <figcaption><strong>{title}</strong><span>{subtitle}</span></figcaption>
    {items.length === 0 && <p class="admin-empty-state">{empty}</p>}
    <div class="bar-list">
      {items.map((item, index) => <button
        type="button"
        class={`bar-row${active === index ? ' is-active' : ''}`}
        key={item.label}
        aria-label={`${item.label}: ${item.value}`}
        onPointerEnter={() => setActive(index)}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(index)}
        onBlur={() => setActive(null)}
      >
        <span class="bar-label">{item.label}</span>
        <span class="bar-track"><i style={{ width: `${item.value / max * 100}%` }} /><b>{item.value}</b></span>
        {active === index && item.detail && <span class="chart-tooltip chart-tooltip--bar" role="presentation"><strong>{item.value}</strong><small>{item.detail}</small></span>}
      </button>)}
    </div>
    {items.length > 0 && <DataTable caption={title} rows={{ label: 'Category', items }} valueLabel="Reports" />}
  </figure>
}


const UNIT_LABELS = { day: 'Day', week: 'Week', month: 'Month' }
const MIN_DATE = '2020-01-01'

// The period in words, for the chart subtitle.
function periodText(range, start, end) {
  if (typeof range === 'number') return `in the last ${range} days`
  const from = formatDay(start, { month: 'short', day: 'numeric', year: 'numeric' })
  const to = formatDay(end - DAY_MS, { month: 'short', day: 'numeric', year: 'numeric' })
  return range === 'all' ? `since the first report (${from})` : `from ${from} to ${to}`
}

// Everything is worked out from the stored records for the chosen period
// (lib/supabase.js getAnalyticsData), read again shortly after any report
// changes so the figures stay live. Nothing is estimated or filled in.
export function AnalyticsPanel({ reports, checkins }) {
  const todayStart = manilaDayStart(Date.now())
  const [range, setRange] = useState(14)
  // The custom dates being typed, and the ones applied.
  const [draft, setDraft] = useState({ from: dateInputValue(todayStart - 29 * DAY_MS), to: dateInputValue(todayStart) })
  const [custom, setCustom] = useState(null)
  const [customError, setCustomError] = useState('')
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)

  const ready = range !== 'custom' || custom
  const period = ready ? periodFor(range, custom) : null
  const periodKey = period ? `${range}:${period.start}:${period.end}` : ''

  const requestRef = useRef(0)
  const loadedKeyRef = useRef('')
  useEffect(() => {
    if (!period) return undefined
    const request = ++requestRef.current
    // A new period loads at once; a report change waits a moment, so a burst
    // of changes is read once.
    const delay = loadedKeyRef.current === periodKey ? 800 : 0
    const timer = setTimeout(() => {
      getAnalyticsData({ since: period.start == null ? null : new Date(period.start).toISOString(), until: new Date(period.end).toISOString() })
        .then((result) => {
          if (request !== requestRef.current) return
          loadedKeyRef.current = periodKey
          setData({ ...result, key: periodKey })
          setLoadError('')
        })
        .catch((error) => { if (request === requestRef.current) setLoadError(error.message) })
    }, delay)
    return () => clearTimeout(timer)
  }, [periodKey, reports, retry])

  const applyCustom = (event) => {
    event.preventDefault()
    const from = parseDateInput(draft.from)
    const to = parseDateInput(draft.to)
    const problem = from == null || to == null ? 'Choose both a start date and an end date.'
      : from > to ? 'The start date must be on or before the end date.'
      : to > todayStart ? 'The end date cannot be after today.'
      : from < parseDateInput(MIN_DATE) ? 'Choose a start date in 2020 or later.'
      : ''
    setCustomError(problem)
    if (!problem) setCustom({ ...draft })
  }

  const isCurrent = data?.key === periodKey
  // Reports the citizen withdrew never needed a response, so they are left out.
  const inRange = isCurrent ? data.reports.filter((report) => report.status !== 'Cancelled') : []
  const start = period?.start ?? (inRange.length ? manilaDayStart(Math.min(...inRange.map((report) => new Date(report.created_at).getTime()))) : todayStart)
  const end = period?.end ?? todayStart + DAY_MS
  const buckets = period ? bucketsFor(start, end) : { unit: 'day', items: [] }
  const perBucket = buckets.items.map((bucket) => ({ ...bucket, value: 0 }))
  inRange.forEach((report) => {
    const time = new Date(report.created_at).getTime()
    const bucket = perBucket.find((item) => time >= item.from && time < item.to)
    if (bucket) bucket.value += 1
  })
  // Only each person's latest check-in is stored, so older ones cannot be counted.
  const periodCheckins = checkins.filter((checkin) => {
    const time = new Date(checkin.updated_at).getTime()
    return time >= start && time < end
  })

  const typeCounts = inRange.reduce((counts, report) => counts.set(report.report_type, (counts.get(report.report_type) ?? 0) + 1), new Map())
  const byType = [...typeCounts]
    .map(([type, value]) => ({ label: REPORT_TYPE_LABELS[type] ?? type, value, detail: `${Math.round(value / inRange.length * 100)}% of reports` }))
    .sort((a, b) => b.value - a.value)

  const locationCounts = inRange.reduce((counts, report) => {
    const key = (report.location ?? '').trim().replace(/\s+/g, ' ')
    if (!key || /^GPS /.test(key)) return counts
    const normalized = key.toLowerCase()
    counts[normalized] = counts[normalized] ?? { label: key, value: 0 }
    counts[normalized].value += 1
    return counts
  }, {})
  const busiest = Object.values(locationCounts).sort((a, b) => b.value - a.value).slice(0, 5)
    .map((item) => ({ ...item, detail: 'reports from this location' }))

  // Events come oldest first, so the first one kept per report is its first verification.
  const firstVerified = new Map()
  if (isCurrent) data.events.forEach((event) => { if (!firstVerified.has(event.report_id)) firstVerified.set(event.report_id, new Date(event.created_at).getTime()) })
  const verifyMinutes = inRange.map((report) => {
    const verified = firstVerified.get(report.id)
    return verified ? (verified - new Date(report.created_at).getTime()) / 60000 : null
  }).filter((value) => value != null && value >= 0)
  const resolveMinutes = inRange.filter((report) => report.resolved_at)
    .map((report) => (new Date(report.resolved_at) - new Date(report.created_at)) / 60000)
    .filter((value) => value >= 0)

  const resolved = inRange.filter((report) => report.status === 'Resolved').length
  const safe = periodCheckins.filter((checkin) => checkin.status === 'Safe').length
  const needHelp = periodCheckins.filter((checkin) => checkin.status === 'Need help').length

  return <section class="admin-analytics">
    <div class="analytics-toolbar">
      <div><span class="ops-eyebrow">Response analytics</span><h2>How the response is going</h2></div>
      <div class="rx-segment analytics-range" role="tablist" aria-label="Date range">
        {RANGES.map(([value, label]) => <button type="button" role="tab" key={value} aria-selected={range === value} class={range === value ? 'is-active' : ''} onClick={() => { setRange(value); setCustomError('') }}>{label}</button>)}
      </div>
    </div>

    {range === 'custom' && <form class="analytics-custom" onSubmit={applyCustom} noValidate>
      <label>From<input type="date" value={draft.from} min={MIN_DATE} max={dateInputValue(todayStart)} onInput={(event) => setDraft({ ...draft, from: event.currentTarget.value })} /></label>
      <label>To<input type="date" value={draft.to} min={MIN_DATE} max={dateInputValue(todayStart)} onInput={(event) => setDraft({ ...draft, to: event.currentTarget.value })} /></label>
      <button type="submit" class="secondary-action"><Icon name="calendar" size={16} /> Apply</button>
      <small>Whole days, Philippine time (Asia/Manila).</small>
      {customError && <p class="form-error" role="alert">{customError}</p>}
    </form>}

    {!period && <p class="admin-empty-state">Choose the start and end dates, then Apply.</p>}
    {period && loadError && <p class="admin-notice is-error" role="alert">{loadError} <button type="button" class="inline-link" onClick={() => setRetry((count) => count + 1)}>Try again</button></p>}
    {period && !isCurrent && !loadError && <p class="analytics-loading" role="status"><span class="btn-spinner" aria-hidden="true" /> Loading reports for this period…</p>}

    {period && isCurrent && <>
      {inRange.length === 0 && <p class="admin-empty-state">No reports in this period.</p>}
      <div class="analytics-tiles">
        <article class="stat-tile"><span>Reports</span><strong>{inRange.length.toLocaleString()}</strong><small>{resolved} resolved · {inRange.filter((report) => report.report_type === 'SOS').length} SOS</small></article>
        <article class="stat-tile"><span>Average time to verify</span><strong>{formatDuration(average(verifyMinutes))}</strong><small>From report to admin approval</small></article>
        <article class="stat-tile"><span>Average time to resolve</span><strong>{formatDuration(average(resolveMinutes))}</strong><small>From report to resolution</small></article>
        <article class="stat-tile"><span>Safety check-ins</span><strong>{safe.toLocaleString()} safe</strong><small class={needHelp ? 'is-warning' : ''}>{needHelp ? <><Icon name="alert" size={12} /> {needHelp} need help</> : 'No one marked as needing help'}</small><small>Each person's latest check-in, if made in this period</small></article>
      </div>

      <div class="analytics-grid">
        <ColumnChart title={`Reports per ${buckets.unit}`} subtitle={`${inRange.length.toLocaleString()} reports ${periodText(range, start, end)}`} items={perBucket} unitLabel={UNIT_LABELS[buckets.unit]} />
        <BarList title="Reports by type" subtitle="Which hazards people report most" items={byType} empty="No reports in this period." />
        <BarList title="Busiest locations" subtitle="Top 5 report locations (GPS-only SOS excluded)" items={busiest} empty="No reports in this period." />
      </div>
    </>}
  </section>
}
