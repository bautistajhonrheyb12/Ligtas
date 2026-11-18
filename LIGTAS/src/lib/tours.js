import { rescueHotline } from './hotlines.js'

// The guided tours for first-time users (components/Tour.jsx). Each step
// points at one part of the screen:
//   target    CSS selector of what to highlight (none: a centred card)
//   prepare   what the screen does first (open a tab, expand a panel...);
//             each dashboard supplies these by name
//   optional  skip the step when the target is not on screen
// Citizen text is in English and Filipino; staff screens are in English.
// Keep the button names here the same as on the screens.

const hotline = `${rescueHotline.name} at ${rescueHotline.display}`
const hotlineTl = `${rescueHotline.name} sa ${rescueHotline.display}`

export const TOURS = {
  citizen: [
    {
      icon: 'shield',
      title: { en: 'Welcome to LIGTAS', tl: 'Maligayang pagdating sa LIGTAS' },
      body: {
        en: 'Here is a quick tour of the main buttons. It takes about a minute. You can skip it and watch it again anytime from Prepare.',
        tl: 'Narito ang mabilis na paglilibot sa mga pangunahing button. Mga isang minuto lang ito. Puwede mo itong laktawan at panoorin ulit anumang oras mula sa Maghanda.',
      },
    },
    {
      target: '.map-frame',
      prepare: 'map',
      icon: 'map',
      title: { en: 'The map', tl: 'Ang mapa' },
      body: {
        en: 'This is Santa Maria. Red areas are danger zones, orange marks closed roads, and green pins are evacuation centers. Tap a pin to see its details.',
        tl: 'Ito ang Santa Maria. Pula ang mga delikadong lugar, kahel ang saradong daan, at berde ang mga evacuation center. Pindutin ang pin para makita ang detalye nito.',
      },
    },
    {
      target: '.map-locate',
      prepare: 'map',
      icon: 'locate',
      title: { en: 'Find yourself', tl: 'Hanapin ang sarili' },
      body: {
        en: 'Shows where you are on the map. Allow location when your phone asks.',
        tl: 'Ipinapakita kung nasaan ka sa mapa. Payagan ang location kapag nagtanong ang telepono mo.',
      },
    },
    {
      target: '.sos-trigger',
      prepare: 'home',
      icon: 'sos',
      title: { en: 'SOS: when your life is in danger', tl: 'SOS: kapag nasa panganib ang buhay mo' },
      body: {
        en: 'Sends your location to rescuers right away, with no waiting for review. Keep LIGTAS open afterwards so they can follow you if you move. Still call the hotline if you can.',
        tl: 'Agad na ipinapadala ang lokasyon mo sa mga rescuer, walang hintayang pagsusuri. Panatilihing bukas ang LIGTAS pagkatapos para masundan ka nila kung lumipat ka. Tumawag pa rin sa hotline kung kaya mo.',
      },
    },
    {
      target: '.safe-trigger',
      prepare: 'home',
      icon: 'heart',
      title: { en: "I'm safe", tl: 'Ligtas ako' },
      body: {
        en: 'One tap tells responders you are safe, so they can focus on people who still need help.',
        tl: 'Isang pindot para malaman ng mga tagatugon na ligtas ka, para matutukan nila ang mga nangangailangan pa ng tulong.',
      },
    },
    {
      target: '.citizen-sheet-peek button, .incident-report-trigger',
      prepare: 'home',
      icon: 'flag',
      title: { en: 'Report an incident', tl: 'Mag-ulat ng insidente' },
      body: {
        en: 'Flooding, a blocked road, a fallen tree, fire and more. Pin the spot on the map and the address fills in by itself. An admin checks each report before rescuers are sent.',
        tl: 'Baha, saradong daan, natumbang puno, sunog at iba pa. I-pin ang lugar sa mapa at kusang mapupunan ang address. Sinusuri ng admin ang bawat ulat bago magpadala ng rescuer.',
      },
    },
    {
      target: '.evacuate-now',
      prepare: 'home',
      icon: 'navigate',
      title: { en: 'Go to the nearest safe evacuation center', tl: 'Pumunta sa pinakamalapit na ligtas na evacuation center' },
      body: {
        en: 'Finds the closest open center by road, avoiding danger zones, and guides you there turn by turn, with voice.',
        tl: 'Hinahanap ang pinakamalapit na bukas na center sa daan, iniiwasan ang mga delikadong lugar, at ginagabayan ka papunta roon nang hakbang-hakbang, may boses pa.',
      },
    },
    {
      target: '.notify-prompt',
      prepare: 'home',
      optional: true,
      icon: 'bellRing',
      title: { en: 'Alerts even when LIGTAS is closed', tl: 'Alerto kahit nakasara ang LIGTAS' },
      body: {
        en: 'Tap Turn on so warnings and updates on your reports reach your phone. You can change this later in Prepare → This phone.',
        tl: 'Pindutin ang Buksan para dumating sa telepono mo ang mga babala at update sa mga ulat mo. Mababago ito sa Maghanda → Ang teleponong ito.',
      },
    },
    {
      target: '.citizen-tabs',
      prepare: 'home',
      icon: 'grid',
      title: { en: 'The tabs', tl: 'Ang mga tab' },
      body: {
        en: 'Map: this home screen. Alerts: warnings from MDRRMO. My reports: what happened to the reports you sent. Prepare: hotlines, your family, a go-bag checklist, safety tips, notifications and your details.',
        tl: 'Mapa: ang home screen na ito. Alerto: mga babala mula sa MDRRMO. Aking ulat: ang nangyari sa mga ulat na ipinadala mo. Maghanda: mga hotline, ang pamilya mo, go-bag checklist, payo sa kaligtasan, notifications at ang detalye mo.',
      },
    },
    {
      target: '.lang-toggle',
      icon: 'globe',
      title: { en: 'English or Filipino', tl: 'Ingles o Filipino' },
      body: {
        en: 'Switch the language anytime.',
        tl: 'Palitan ang wika anumang oras.',
      },
    },
    {
      icon: 'check',
      title: { en: "You're ready", tl: 'Handa ka na' },
      body: {
        en: `Watch this tour again anytime from Prepare → How to use LIGTAS. In an emergency, press SOS or call ${hotline}.`,
        tl: `Mapapanood ulit ang paglilibot na ito mula sa Maghanda → Paano gamitin ang LIGTAS. Sa emergency, pindutin ang SOS o tumawag sa ${hotlineTl}.`,
      },
    },
  ],

  rescuer: [
    {
      icon: 'shield',
      title: 'Welcome, rescue team',
      body: 'A quick tour of your screen. You can watch it again from How to use LIGTAS, at the bottom of the screen.',
    },
    {
      target: '.rx-duty',
      icon: 'locate',
      title: 'Share location while on duty',
      body: 'Operations sees your team on the map and can send you the nearest calls. Turn it off when you go off duty.',
    },
    {
      target: '.rx-hero',
      prepare: 'calls',
      icon: 'calls',
      title: 'Calls waiting',
      body: 'How many verified calls still need a team. New SOS calls arrive here instantly, with a sound.',
    },
    {
      target: '.rx-segment--three',
      prepare: 'calls',
      icon: 'list',
      title: 'Open, My calls, Resolved',
      body: 'Open: calls without a team. My calls: the ones your team took. Resolved: finished calls.',
    },
    {
      target: '.rx-call',
      prepare: 'calls',
      optional: true,
      icon: 'pin',
      title: 'A call',
      body: 'Type, place, how long ago and how far. Live means the person is sharing their location right now. Show on map opens it on the map.',
    },
    {
      target: '.rx-call .rx-call-actions',
      prepare: 'calls',
      optional: true,
      icon: 'check',
      title: 'Responding to a call',
      body: "Take this call assigns it to your team. Navigate gives turn-by-turn directions that avoid hazards. Then tap I'm on the way, I'm on scene, and Mark resolved. If you can't respond, return the call so another team can take it.",
    },
    {
      target: '.rx-tabbar button:nth-of-type(2)',
      icon: 'map',
      title: 'Map',
      body: 'Every open call as a pin. Tap one for the address, travel time by road and how accurate the location is, and to navigate there.',
    },
    {
      target: '.rx-tabbar button:nth-of-type(3)',
      icon: 'bell',
      title: 'Alerts',
      body: 'Warnings from operations. You can also publish an alert about the area you are in.',
    },
    {
      target: '.rx-notify-btn',
      icon: 'bellRing',
      title: 'Notifications',
      body: 'Turn them on so new SOS calls and calls assigned to you reach your phone even when LIGTAS is closed.',
    },
    {
      icon: 'check',
      title: "You're ready",
      body: 'Watch this again anytime from How to use LIGTAS, at the bottom of the screen.',
    },
  ],

  admin: [
    {
      icon: 'shield',
      title: 'Welcome to LIGTAS operations',
      body: 'A quick tour of the admin screen. You can watch it again from How to use LIGTAS in the menu.',
    },
    {
      target: '#admin-navigation',
      prepare: 'menu',
      icon: 'grid',
      title: 'Pages',
      body: 'Dashboard, Reports to verify, Alerts, Map points, evacuation Centers, rescue Teams, Priority rescue proofs, Analytics and Security warnings. Red numbers show what needs attention.',
    },
    {
      target: '.admin-send-alert',
      prepare: 'dashboard',
      icon: 'plus',
      title: 'Send an alert',
      body: 'Warn citizens, rescuers or both, for the whole town or chosen barangays. Phones with notifications on get it even when LIGTAS is closed.',
    },
    {
      target: '.admin-stats',
      prepare: 'dashboard',
      icon: 'chart',
      title: 'At a glance',
      body: 'Open evacuation centers, active reports, teams in the field, and who marked themselves safe.',
    },
    {
      target: '.admin-review-panel',
      prepare: 'dashboard',
      optional: true,
      icon: 'check',
      title: 'Needs review',
      body: 'New reports wait here. The check mark verifies a report and sends it to rescuers; the cross rejects it with a reason. Both ask before doing anything. SOS calls skip review.',
    },
    {
      target: '.admin-overview-map',
      prepare: 'dashboard',
      icon: 'map',
      title: 'Operations map',
      body: 'Reports, SOS calls, rescue teams, danger zones and evacuation centers on one map.',
    },
    {
      target: '.ops-notify',
      icon: 'bellRing',
      title: 'Notifications',
      body: 'Get SOS calls and new reports on this device even when LIGTAS is closed.',
    },
    {
      icon: 'check',
      title: "You're ready",
      body: 'Watch this again anytime from How to use LIGTAS in the menu.',
    },
  ],
}

// Whether this phone has already shown a role's tour.
const DONE_KEY = 'ligtas-tour-done'

export function tourDone(role) {
  try {
    return Boolean(JSON.parse(localStorage.getItem(DONE_KEY))?.[role])
  } catch {
    return false
  }
}

export function markTourDone(role) {
  try {
    const done = JSON.parse(localStorage.getItem(DONE_KEY)) ?? {}
    localStorage.setItem(DONE_KEY, JSON.stringify({ ...done, [role]: true }))
  } catch {
    // Not remembered: the tour may show again next time.
  }
}
