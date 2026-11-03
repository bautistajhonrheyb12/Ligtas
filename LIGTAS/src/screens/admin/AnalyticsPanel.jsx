import { useState } from 'preact/hooks'
import { Icon } from '../../lib/ui.jsx'

const RANGES = [[7, 'Last 7 days'], [14, 'Last 14 days'], [30, 'Last 30 days']]
const DAY_MS = 86400000

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
function ColumnChart({ title, subtitle, items }) {
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
          aria-label={`${item.fullLabel}: ${item.value} reports`}
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
    <DataTable caption={title} rows={{ label: 'Day', items: items.map((item) => ({ label: item.fullLabel, value: item.value })) }} valueLabel="Reports" />
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

export function AnalyticsPanel({ reports, events, checkins }) {
  const [range, setRange] = useState(14)
  const since = Date.now() - range * DAY_MS
  // Reports the citizen withdrew never needed a response, so they are left out.
  const inRange = reports.filter((report) => report.status !== 'Cancelled' && new Date(report.created_at).getTime() >= since)
  const recentCheckins = checkins.filter((checkin) => new Date(checkin.updated_at).getTime() >= since)

  const days = Array.from({ length: range }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (range - 1 - index))
    return date
  })
  const perDay = days.map((date) => {
    const next = date.getTime() + DAY_MS
    return {
      label: date.toLocaleDateString([], { month: 'numeric', day: 'numeric' }),
      fullLabel: date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
      value: inRange.filter((report) => {
        const time = new Date(report.created_at).getTime()
        return time >= date.getTime() && time < next
      }).length,
    }
  })

  const byType = Object.entries(inRange.reduce((counts, report) => ({ ...counts, [report.report_type]: (counts[report.report_type] ?? 0) + 1 }), {}))
    .map(([label, value]) => ({ label, value, detail: `${Math.round(value / inRange.length * 100)}% of reports` }))
    .sort((a, b) => b.value - a.value)

  const locationCounts = inRange.reduce((counts, report) => {
    const key = report.location.trim().replace(/\s+/g, ' ')
    if (/^GPS /.test(key)) return counts
    const normalized = key.toLowerCase()
    counts[normalized] = counts[normalized] ?? { label: key, value: 0 }
    counts[normalized].value += 1
    return counts
  }, {})
  const busiest = Object.values(locationCounts).sort((a, b) => b.value - a.value).slice(0, 5)
    .map((item) => ({ ...item, detail: 'reports from this location' }))

  const verifyMinutes = inRange.map((report) => {
    const verified = events.filter((event) => event.report_id === report.id && event.action === 'Verified')
      .map((event) => new Date(event.created_at).getTime())
      .sort((a, b) => a - b)[0]
    return verified ? (verified - new Date(report.created_at).getTime()) / 60000 : null
  }).filter((value) => value != null && value >= 0)
  const resolveMinutes = inRange.filter((report) => report.resolved_at)
    .map((report) => (new Date(report.resolved_at) - new Date(report.created_at)) / 60000)
    .filter((value) => value >= 0)

  const resolved = inRange.filter((report) => report.status === 'Resolved').length
  const safe = recentCheckins.filter((checkin) => checkin.status === 'Safe').length
  const needHelp = recentCheckins.filter((checkin) => checkin.status === 'Need help').length

  return <section class="admin-analytics">
    <div class="analytics-toolbar">
      <div><span class="ops-eyebrow">Response analytics</span><h2>How the response is going</h2></div>
      <div class="rx-segment analytics-range" role="tablist" aria-label="Date range">
        {RANGES.map(([value, label]) => <button type="button" role="tab" key={value} aria-selected={range === value} class={range === value ? 'is-active' : ''} onClick={() => setRange(value)}>{label}</button>)}
      </div>
    </div>

    <div class="analytics-tiles">
      <article class="stat-tile"><span>Reports</span><strong>{inRange.length.toLocaleString()}</strong><small>{resolved} resolved · {inRange.filter((report) => report.report_type === 'SOS').length} SOS</small></article>
      <article class="stat-tile"><span>Average time to verify</span><strong>{formatDuration(average(verifyMinutes))}</strong><small>From report to admin approval</small></article>
      <article class="stat-tile"><span>Average time to resolve</span><strong>{formatDuration(average(resolveMinutes))}</strong><small>From report to resolution</small></article>
      <article class="stat-tile"><span>Safety check-ins</span><strong>{safe.toLocaleString()} safe</strong><small class={needHelp ? 'is-warning' : ''}>{needHelp ? <><Icon name="alert" size={12} /> {needHelp} need help</> : 'No one marked as needing help'}</small></article>
    </div>

    <div class="analytics-grid">
      <ColumnChart title="Reports per day" subtitle={`${inRange.length} reports in the ${RANGES.find(([value]) => value === range)[1].toLowerCase()}`} items={perDay} />
      <BarList title="Reports by type" subtitle="Which hazards people report most" items={byType} empty="No reports in this period." />
      <BarList title="Busiest locations" subtitle="Top 5 report locations (GPS-only SOS excluded)" items={busiest} empty="No reports in this period." />
    </div>
  </section>
}
