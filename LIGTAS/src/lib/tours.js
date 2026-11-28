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
        en: 'Here is a quick tour of the main buttons. It takes about a minute. You can skip it and watch it again anytime from your profile.',
        tl: 'Narito ang mabilis na paglilibot sa mga pangunahing button. Mga isang minuto lang ito. Puwede mo itong laktawan at panoorin ulit anumang oras mula sa profile mo.',
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
      target: '.report-trigger',
      prepare: 'home',
      icon: 'flag',
      title: { en: 'Report an incident', tl: 'Mag-ulat ng insidente' },
      body: {
        en: 'Beside SOS. Flooding, fire, a road accident, a road obstruction, a downed power line and more. Pin the spot on the map and the address fills in by itself. An admin checks each report before rescuers are sent.',
        tl: 'Katabi ng SOS. Baha, sunog, aksidente sa daan, nakaharang sa daan, nakalaylay na kable at iba pa. I-pin ang lugar sa mapa at kusang mapupunan ang address. Sinusuri ng admin ang bawat ulat bago magpadala ng rescuer.',
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
        en: 'Tap Turn on so warnings and updates on your reports reach your phone. You can change this later in your profile → Notifications.',
        tl: 'Pindutin ang Buksan para dumating sa telepono mo ang mga babala at update sa mga ulat mo. Mababago ito sa profile mo → Mga notification.',
      },
    },
    {
      target: '.citizen-tabs',
      prepare: 'home',
      icon: 'grid',
      title: { en: 'The tabs', tl: 'Ang mga tab' },
      body: {
        en: 'Map: this home screen. Alerts: warnings from MDRRMO. My reports: what happened to the reports you sent. Prepare: your safety check-in, hotlines, your family, priority rescue, a go-bag checklist and safety tips.',
        tl: 'Mapa: ang home screen na ito. Alerto: mga babala mula sa MDRRMO. Aking ulat: ang nangyari sa mga ulat na ipinadala mo. Maghanda: mga hotline, ang pamilya mo, priority rescue, go-bag checklist at payo sa kaligtasan.',
      },
    },
    {
      target: '.safe-trigger',
      prepare: 'prepare',
      icon: 'heart',
      title: { en: "I'm safe", tl: 'Ligtas ako' },
      body: {
        en: 'In Prepare, one tap tells responders and your family you are safe, so rescuers can focus on people who still need help. While an SOS is open, the same button is on the SOS panel.',
        tl: 'Sa Maghanda, isang pindot para malaman ng mga tagatugon at ng pamilya mo na ligtas ka, para matutukan ng mga rescuer ang mga nangangailangan pa ng tulong. Habang bukas ang SOS, nasa SOS panel din ang button na ito.',
      },
    },
    {
      target: '.citizen-header .profile-button',
      icon: 'user',
      title: { en: 'Your profile', tl: 'Ang profile mo' },
      body: {
        en: 'Your details, password, notifications, language and help. Sign out from here too.',
        tl: 'Ang detalye mo, password, notifications, wika at tulong. Dito ka rin magsa-sign out.',
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
        en: `Watch this tour again anytime from your profile → How to use LIGTAS. In an emergency, press SOS or call ${hotline}.`,
        tl: `Mapapanood ulit ang paglilibot na ito mula sa profile mo → Paano gamitin ang LIGTAS. Sa emergency, pindutin ang SOS o tumawag sa ${hotlineTl}.`,
      },
    },
  ],

  rescuer: [
    {
      icon: 'shield',
      title: 'Welcome, rescue team',
      body: 'A quick tour of your screen. You can watch it again from your profile, the round button at the top right.',
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
      target: '.rx-availability',
      prepare: 'calls',
      icon: 'user',
      title: 'Your availability',
      body: 'Available, Responding or Unavailable. Operations sees it on the admin dashboard when choosing a team. Accepting a call sets you to Responding, and finishing your last call sets you back to Available.',
    },
    {
      target: '.rx-filters',
      prepare: 'calls',
      icon: 'list',
      title: 'Find the right call',
      body: 'Filter by urgency, priority households, who has the call and distance from you, or search by place. Most urgent calls come first.',
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
      body: "Accept this call gives it to your team (only one team can accept a call). Navigate gives turn-by-turn directions that avoid hazards. The call then moves to Active.",
    },
    {
      target: '.rx-tabbar button:nth-of-type(2)',
      icon: 'navigate',
      title: 'Active',
      body: "Your ongoing operations: the progress from Accepted to On scene, the details that matter on the way, and field notes operations sees at once. Tap I'm on the way, I'm on scene, then Mark resolved and choose the outcome. Can't respond? Return the call.",
    },
    {
      target: '.rx-tabbar button:nth-of-type(3)',
      icon: 'map',
      title: 'Map',
      body: 'Every open call as a pin, priority households ringed in purple. Tap one for the address, travel time by a road that avoids hazards, the nearest evacuation centers with space, and to navigate there.',
    },
    {
      target: '.rx-tabbar button:nth-of-type(4)',
      icon: 'history',
      title: 'History',
      body: 'Finished operations with their times, outcome, remarks and field notes. Search and filter by period or outcome.',
    },
    {
      target: '.rx-tabbar button:nth-of-type(5)',
      icon: 'bell',
      title: 'Alerts',
      body: 'Warnings from operations. You can also publish an alert about the area you are in.',
    },
    {
      target: '.rx-bell',
      icon: 'bellRing',
      title: 'Notifications',
      body: 'New SOS calls, calls given to you, notes and changes on your calls, and alerts. Unread ones are marked until you open them.',
    },
    {
      target: '.rx-header .profile-button',
      icon: 'user',
      title: 'Your profile',
      body: 'Turn on notifications here, so new SOS calls and calls assigned to you reach your phone even when LIGTAS is closed. Your password, this tour and Sign out are here too.',
    },
    {
      icon: 'check',
      title: "You're ready",
      body: 'Watch this again anytime from your profile → How to use LIGTAS.',
    },
  ],

  admin: [
    {
      icon: 'shield',
      title: 'Welcome to LIGTAS operations',
      body: 'A quick tour of the admin screen. You can watch it again from your profile, at the top right.',
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
      target: '.ops-header .profile-button',
      icon: 'user',
      title: 'Your profile',
      body: 'Turn on notifications here to get SOS calls and new reports on this device even when LIGTAS is closed. Your password, this tour and Sign out are here too.',
    },
    {
      icon: 'check',
      title: "You're ready",
      body: 'Watch this again anytime from your profile → How to use LIGTAS.',
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
