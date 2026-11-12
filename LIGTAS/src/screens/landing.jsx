
export const slides = [
  {
    eyebrow: 'Built for preparedness',
    title: 'Safer communities,\nsmarter response.',
    copy: 'Real-time disaster mapping, alerts, and coordination — all in one place.',
    type: 'welcome',
  },
  {
    eyebrow: 'Know what is happening',
    title: 'Real-time hazard\nmapping.',
    copy: 'View hazard zones, closed roads, and evacuation centers across Santa Maria.',
    type: 'map',
  },
  {
    eyebrow: 'Stay one step ahead',
    title: 'Alerts that\nreach you.',
    copy: 'Receive verified weather and flood warnings when they matter most.',
    type: 'alerts',
  },
]

function Pin({ x, y, label }) {
  return <div class="pin" style={{ left: `${x}%`, top: `${y}%` }}><span>{label}</span></div>
}

function MapPhoto() {
  return <div class="map-photo-slot">
    <img src="/Map-index.png" alt="LIGTAS hazard map" onError={(event) => { event.currentTarget.style.display = 'none' }} />
  </div>
}

export function IconPlaceholder({ name, label = 'Icon' }) {
  return <span class="asset-icon-placeholder"><span>{label}</span><img src={`/${name}.png`} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} /></span>
}


export function Illustration({ type }) {
  if (type === 'map') return <div class="map-visual" aria-hidden="true">
    <MapPhoto />
    <span class="map-scan" />
    <span class="map-ping map-ping--high" style={{ left: '67%', top: '34%' }} />
    <span class="map-ping map-ping--medium" style={{ left: '24%', top: '64%' }} />
    <span class="map-ping map-ping--info" style={{ left: '86%', top: '22%' }} />
    <div class="flood-card"><strong>Flood Warning</strong><span>Brgy. Santa Maria · Tungkong Mangga Rd, Bulacan</span></div>
  </div>
  if (type === 'alerts') return <div class="alert-visual" aria-hidden="true">
    <div class="bell"><svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>
    <div class="alert-panel">

      <div class="alert-row"><i>☁</i><div><b>Heavy Rainfall</b><span>Santa Maria, Bulacan<br/>Today, 8:30 PM</span></div></div>
      <hr />
      <div class="alert-row"><i>⌂</i><div><b>Flood Warning</b><span>Santa Maria, Bulacan<br/>Today, 8:30 PM</span></div></div>
    </div>
  </div>
  return <div class="island-visual" aria-hidden="true">
    <div class="cloud cloud-one" /><div class="cloud cloud-two" />
    <div class="island"><span class="tree t1"/><span class="tree t2"/><span class="tree t3"/><span class="tree t4"/><span class="house h1"/><span class="house h2"/><Pin x={35} y={42} label=""/><Pin x={67} y={66} label=""/><Pin x={75} y={35} label=""/></div>
  </div>
}
