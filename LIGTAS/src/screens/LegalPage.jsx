import { useEffect } from 'preact/hooks'
import { hotlines, rescueHotline } from '../lib/hotlines.js'
import { CONTACT_EMAIL, LEGAL_UPDATED, privacyUrl, termsUrl } from '../lib/legal.js'
import { Icon } from '../lib/ui.jsx'

// The Terms of Use (#terms) and Privacy Policy (#privacy). Written for what
// LIGTAS actually does; update LEGAL_VERSION in lib/legal.js when they change.

function Email() {
  return CONTACT_EMAIL
    ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
    : <b class="legal-missing">[privacy contact email to be added]</b>
}

const Rescue = () => <a href={`tel:${rescueHotline.number}`}>{rescueHotline.name} at {rescueHotline.display}</a>

function Section({ id, number, title, children }) {
  return <section class="legal-section" id={`legal-${id}`} aria-labelledby={`legal-${id}-title`}>
    <h2 id={`legal-${id}-title`}><span>{number}</span>{title}</h2>
    {children}
  </section>
}

// Buttons rather than #links: the page itself lives at #terms / #privacy.
function Contents({ items }) {
  return <nav class="legal-contents" aria-label="On this page">
    <strong>On this page</strong>
    <ol>
      {items.map(([id, title]) => <li key={id}>
        <button type="button" onClick={() => document.getElementById(`legal-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{title}</button>
      </li>)}
    </ol>
  </nav>
}

function Summary({ title, items }) {
  return <aside class="legal-summary" lang="fil">
    <strong><Icon name="globe" size={16} /> {title}</strong>
    <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
  </aside>
}

const TERMS_SECTIONS = [
  ['emergency', 'LIGTAS is not an emergency service'],
  ['who', 'Who can use LIGTAS'],
  ['account', 'Your account'],
  ['reports', 'Reports, SOS and photos'],
  ['conduct', 'Things you must not do'],
  ['priority', 'Priority rescue'],
  ['maps', 'Maps, alerts and directions'],
  ['staff', 'Rescuer and admin accounts'],
  ['availability', 'Availability and changes'],
  ['closing', 'Pausing and closing accounts'],
  ['liability', 'Disclaimers and limits of liability'],
  ['changes', 'Changes to these terms'],
  ['law', 'Governing law'],
  ['contact', 'Contact us'],
]

function Terms() {
  const n = (id) => TERMS_SECTIONS.findIndex(([key]) => key === id) + 1
  return <>
    <p class="legal-lead">
      These Terms of Use are an agreement between you and the LIGTAS team, the people who build and run
      LIGTAS (the Localized Informative Geographic Tagging &amp; Safety Mapping System). By creating an account or
      using LIGTAS, you agree to them. If you do not agree, do not use LIGTAS. The <a href={privacyUrl}>Privacy
      Policy</a> explains how your information is handled and is part of these terms.
    </p>
    <Summary title="Buod sa Filipino" items={[
      `Hindi kapalit ng emergency hotline ang LIGTAS. Kapag may panganib sa buhay, tumawag agad sa ${rescueHotline.name}: ${rescueHotline.display}.`,
      'Totoong pangyayari lang ang iulat. Bawal ang pekeng ulat o pekeng SOS: puwedeng isara ang account at ipaalam sa awtoridad.',
      'Makikita ng mga admin at rescuer ang pangalan, numero at lokasyon mo sa mga ulat mo, para matulungan ka.',
      'Sa priority rescue, ilista lang ang totoong kasama sa bahay, nang may pahintulot nila, at totoong patunay.',
      'Gabay lang ang mapa at ruta. Sundin ang MDRRMO at barangay, at huwag dumaan sa daang mukhang delikado.',
      'Para sa edad 18 pataas ang account. Kung mas bata, kailangan ang pahintulot ng magulang o tagapag-alaga.',
    ]} />
    <Contents items={TERMS_SECTIONS} />

    <Section id="emergency" number={n('emergency')} title="LIGTAS is not an emergency service">
      <p>LIGTAS helps residents, rescuers and the municipal operations team share information during disasters. It does not replace emergency hotlines. We cannot guarantee that someone will see your report or SOS, or that help will arrive, or arrive in time.</p>
      <p>Reports and SOS depend on your phone, your connection, our service providers and the people on duty, and any of these can fail or be delayed.</p>
      <p class="legal-callout"><Icon name="phone" size={16} /><span>If a life is in danger, call <Rescue /> or another Santa Maria hotline right away, even if you have already sent an SOS.</span></p>
      <ul class="legal-hotlines">
        {hotlines.map((line) => <li key={line.number}><span>{line.name}</span><a href={`tel:${line.number}`}>{line.display}</a></li>)}
      </ul>
    </Section>

    <Section id="who" number={n('who')} title="Who can use LIGTAS">
      <ul>
        <li>LIGTAS is for people in Santa Maria, Bulacan, and for the rescuers and staff who serve them.</li>
        <li>You must be 18 or older to create an account. Younger people need a parent or guardian to create or approve the account; that parent or guardian is responsible for its use.</li>
        <li>Rescuer and admin accounts are created by LIGTAS administrators only.</li>
      </ul>
    </Section>

    <Section id="account" number={n('account')} title="Your account">
      <ul>
        <li>Use your real name and a mobile number you answer, and keep them up to date. Responders call this number about your reports and SOS.</li>
        <li>Keep your password secret. Tell us right away if you think someone else has used your account. You are responsible for what is done with your account.</li>
        <li>One person per account. Do not share, lend or sell accounts.</li>
        <li>If you sign in with Google, Google's terms also apply to that sign-in.</li>
      </ul>
    </Section>

    <Section id="reports" number={n('reports')} title="Reports, SOS and photos">
      <ul>
        <li>Report only things that are really happening, as accurately as you can.</li>
        <li>Send an SOS only when you, or someone with you, needs help right away. An SOS goes straight to rescuers without review.</li>
        <li>Send only photos you took or are allowed to share. Avoid showing people's faces or private details unless it helps the response.</li>
        <li>Your reports, with your name, mobile number and location, are seen by administrators and by rescuers (SOS immediately, other reports once verified). Verified information may be shown to other users as a hazard on the map, without your name or number.</li>
        <li>You keep ownership of what you send. You allow the LIGTAS team, the municipal operations team and rescuers to use, copy and share it as needed to respond, to warn others and to prepare for future disasters.</li>
        <li>Administrators may reject or close reports. To keep information reliable, LIGTAS also checks reports automatically: reports from outside Santa Maria or with impossible locations may be blocked, the number of reports per person is limited, and accounts with repeated problems have ordinary reports paused until an administrator reviews them. An SOS is never blocked.</li>
      </ul>
    </Section>

    <Section id="conduct" number={n('conduct')} title="Things you must not do">
      <ul>
        <li>Send false, prank or joke reports or SOS.</li>
        <li>Pretend to be someone else, a rescuer, or a government office.</li>
        <li>Harass, threaten or insult anyone, including in report notes.</li>
        <li>Share another person's personal information without their permission, except as these terms allow (such as listing household members for priority rescue with their consent).</li>
        <li>Fake your location or get around the location checks or limits.</li>
        <li>Try to get into accounts, information or parts of LIGTAS you are not allowed to use, or test its security without our written permission. If you find a security problem, tell us at <Email />.</li>
        <li>Overload, copy or scrape LIGTAS, or use automated tools on it.</li>
        <li>Use LIGTAS for advertising, campaigning or anything unlawful.</li>
      </ul>
      <p>Breaking these rules can lead to removed reports, a paused or closed account and, for false emergency reports or other unlawful acts, a referral to the proper authorities.</p>
    </Section>

    <Section id="priority" number={n('priority')} title="Priority rescue">
      <ul>
        <li>List only people in your household who need priority rescue (persons with disability, pregnant women, senior citizens 60 or older, and children under 18), and only with their permission or that of their parent or guardian.</li>
        <li>Proofs must be genuine, readable and unaltered.</li>
        <li>Administrators may reject or withdraw any entry. False or altered proofs may lead to your account being closed.</li>
        <li>A verified entry helps rescuers decide, but it does not guarantee that anyone will be rescued first or at a particular time. Rescuers decide based on the whole situation.</li>
      </ul>
    </Section>

    <Section id="maps" number={n('maps')} title="Maps, alerts and directions">
      <ul>
        <li>Hazard maps, alerts, evacuation center capacity and travel times come from people and sources that can be incomplete, late or wrong. Conditions change quickly in a disaster.</li>
        <li>Always follow instructions from the MDRRMO, barangay officials and other authorities, and use your own judgment. If a road looks flooded, blocked or unsafe, do not take it, even if LIGTAS suggests it.</li>
        <li>Directions use OpenStreetMap data and a routing service run by others. Routes avoid reported hazards where possible, but cannot avoid hazards no one has reported.</li>
        <li>If you are driving, start the route before you set off, keep your eyes on the road and obey traffic laws. Do not handle your phone while driving.</li>
      </ul>
    </Section>

    <Section id="staff" number={n('staff')} title="Rescuer and admin accounts">
      <ul>
        <li>Use LIGTAS and the information in it only for disaster response and preparedness in Santa Maria.</li>
        <li>Keep reporters' names, numbers, locations and priority information confidential. Do not copy, screenshot or share them outside the response. Open priority proofs only to review them.</li>
        <li>Share your location only while on duty.</li>
        <li>Administrators must use two-step sign-in. Staff accounts may be signed out or deactivated at any time, for example when someone leaves the team.</li>
        <li>Staff also follow the rules of their office and the Data Privacy Act of 2012.</li>
      </ul>
    </Section>

    <Section id="availability" number={n('availability')} title="Availability and changes">
      <ul>
        <li>LIGTAS is free to use. We may change, add or remove features, or end the service, and will give notice when we can.</li>
        <li>LIGTAS may be unavailable at times, including during disasters, because of network, power or service-provider problems. Some information stays on your phone for offline use, but it may be out of date.</li>
      </ul>
    </Section>

    <Section id="closing" number={n('closing')} title="Pausing and closing accounts">
      <ul>
        <li>We may pause or close accounts that break these terms or put others at risk.</li>
        <li>You may stop using LIGTAS at any time. To delete your account, email <Email />. The <a href={privacyUrl}>Privacy Policy</a> explains what is deleted.</li>
      </ul>
    </Section>

    <Section id="liability" number={n('liability')} title="Disclaimers and limits of liability">
      <p>LIGTAS is provided "as is" and "as available". To the extent allowed by Philippine law, the LIGTAS team does not promise that LIGTAS will always work, be free of errors, or that its information is complete or accurate.</p>
      <p>To the extent allowed by law, the LIGTAS team is not liable for losses caused by delays or failures in delivering reports, SOS or alerts; by relying on maps, alerts, directions or other information in LIGTAS; or by the actions of other users, responders, service providers or other third parties.</p>
      <p>Nothing in these terms limits liability that Philippine law does not allow to be limited.</p>
    </Section>

    <Section id="changes" number={n('changes')} title="Changes to these terms">
      <p>When we change these terms in a way that matters, we update the date at the top and ask you to accept the new version the next time you open LIGTAS. SOS stays available while you decide. If you do not accept, you can stop using LIGTAS and ask us to delete your account.</p>
    </Section>

    <Section id="law" number={n('law')} title="Governing law">
      <p>These terms are governed by the laws of the Republic of the Philippines.</p>
    </Section>

    <Section id="contact" number={n('contact')} title="Contact us">
      <p>Questions about these terms: <Email />. This address is not monitored for emergencies. In an emergency, call <Rescue />.</p>
    </Section>
  </>
}

const PRIVACY_SECTIONS = [
  ['collect', 'Information we collect'],
  ['sensitive', 'Sensitive personal information'],
  ['use', 'Why we use it'],
  ['see', 'Who can see your information'],
  ['providers', 'Service providers and transfers abroad'],
  ['phone', 'Information stored on your phone'],
  ['keep', 'How long we keep it'],
  ['protect', 'How we protect it'],
  ['rights', 'Your rights'],
  ['children', 'Children'],
  ['changes', 'Changes to this policy'],
  ['contact', 'Contact us'],
]

const COLLECTED = [
  ['Account details', 'Email address, password (stored scrambled by our sign-in provider; no one can read it), name, mobile number and home barangay.', 'When you sign up or edit Prepare → My details.', 'To sign you in, let responders call you back, and show alerts for your barangay.'],
  ['Google sign-in', 'Your name and email address from Google.', 'Only if you choose Continue with Google.', 'To create your account and sign you in.'],
  ['Reports and SOS', 'Type, description, location (GPS or a pinned spot), photo, number of people affected, whether vulnerable people are present, and time. Your name and number are copied onto each report.', 'When you send one.', 'To verify and respond to it, and to keep a record of incidents.'],
  ['Safety check-ins', '"I\'m safe" or "Need help", with your location if available.', 'When you tap I\'m safe or send an SOS.', 'So responders know who is safe and who needs help.'],
  ['Priority rescue', 'Names, category (PWD, pregnant, senior citizen, child), birth year or due date, optional details, and a proof.', 'Only if you add people, after you consent.', 'So the people who need help first are reached first.'],
  ['Your location', 'Your phone\'s position while LIGTAS is open.', 'Only if you allow location access.', 'To show you on the map, find the nearest safe evacuation center and give directions. It leaves your phone only as described in sections 4 and 5.'],
  ['Rescuer location', 'A rescuer\'s latest position.', 'While a rescuer shares location on duty.', 'To coordinate response teams.'],
  ['Security records', 'Report times, the country your network appears to be in, a scrambled (hashed) form of your IP address when a location check fails, sign-in session records, digital signatures on reports, and a log of staff actions on reports.', 'Automatically.', 'To detect fake reports, stolen accounts and tampering, and to keep staff accountable.'],
]

function Privacy() {
  const n = (id) => PRIVACY_SECTIONS.findIndex(([key]) => key === id) + 1
  return <>
    <p class="legal-lead">
      This Privacy Policy explains what information LIGTAS collects, why, who can see it, how long it is kept, and
      your rights under the Data Privacy Act of 2012 (Republic Act No. 10173). LIGTAS is run by the LIGTAS team,
      which is responsible for this information as its personal information controller.
    </p>
    <div class="legal-glance">
      <p><Icon name="shield" size={18} /><span><b>In short:</b> we collect what is needed to warn you and get help to you. Rescuers see what they need to respond; administrators see more, to verify reports and proofs. We never sell your information or use it for advertising. You can correct it, get a copy, or ask us to delete it.</span></p>
    </div>
    <Summary title="Buod sa Filipino" items={[
      'Kinokolekta namin ang kailangan para mabalaan at matulungan ka: detalye ng account, mga ulat at SOS (kasama ang lokasyon at litrato), at, kung gusto mo, impormasyon ng mga kasama sa bahay na kailangang unahing iligtas.',
      'Nakikita ng mga rescuer ang kailangan nila para tumugon. Mas marami ang nakikita ng mga admin para masuri ang mga ulat at patunay. Hindi namin ibinebenta ang impormasyon mo.',
      'Sa priority rescue, kategorya lang ang nakikita ng mga rescuer, hindi ang pangalan o ang patunay.',
      'Lumalabas lang sa telepono mo ang lokasyon mo kapag nagpadala ka ng ulat, SOS o check-in, o nagplano ng ruta.',
      'Puwede mong itama, kopyahin o ipabura ang impormasyon mo. Puwede ka ring magreklamo sa National Privacy Commission.',
    ]} />
    <Contents items={PRIVACY_SECTIONS} />

    <Section id="collect" number={n('collect')} title="Information we collect">
      <div class="legal-table" role="table" aria-label="Information we collect">
        <div class="legal-row legal-row--head" role="row"><span role="columnheader">What</span><span role="columnheader">Details</span><span role="columnheader">When</span><span role="columnheader">Why</span></div>
        {COLLECTED.map(([what, details, when, why]) => <div class="legal-row" role="row" key={what}>
          <b role="cell">{what}</b><span role="cell">{details}</span><span role="cell"><i>When: </i>{when}</span><span role="cell"><i>Why: </i>{why}</span>
        </div>)}
      </div>
    </Section>

    <Section id="sensitive" number={n('sensitive')} title="Sensitive personal information">
      <p>Information about disability, pregnancy and age is sensitive personal information under the Data Privacy Act. We collect it only after you consent, and only for priority rescue. When you list other people, you confirm that they, or their parent or guardian, agreed.</p>
      <ul>
        <li>Administrators see names, details and proofs, to check them.</li>
        <li>Rescuers see only the categories on your household's SOS and reports (for example, "Senior citizen ×2"), never names, details or proofs.</li>
        <li>Proofs are kept in private storage that only you and administrators can open, through links that expire after 5 minutes.</li>
        <li>You can withdraw consent at any time in Prepare → Priority rescue. This deletes every entry and proof at once.</li>
      </ul>
    </Section>

    <Section id="use" number={n('use')} title="Why we use it">
      <p>Under Sections 12 and 13 of the Data Privacy Act, we process your information:</p>
      <ul>
        <li><b>With your consent:</b> to create your account, to hold priority rescue information, and to use your location while the app is open.</li>
        <li><b>To protect life and health:</b> to share reports, SOS, locations and priority categories with responders during emergencies.</li>
        <li><b>To provide the service you asked for:</b> signing in, alerts for your barangay, and call-backs from responders.</li>
        <li><b>To keep LIGTAS reliable and safe:</b> to detect fake reports, abuse and stolen accounts.</li>
      </ul>
      <p>Some checks are automatic. A report from outside Santa Maria, or from a location that is impossibly far from your last one, may be blocked, and repeated problems pause ordinary reports until an administrator reviews them. An SOS is never blocked. If you think a check got it wrong, contact us. We do not use your information for advertising, and we do not sell it.</p>
    </Section>

    <Section id="see" number={n('see')} title="Who can see your information">
      <dl class="legal-who">
        <div><dt>You</dt><dd>Your profile, your reports and their status, your check-in, and your priority entries and proofs.</dd></div>
        <div><dt>Rescuers</dt><dd>Every SOS and every verified report, with the reporter's name, mobile number, location, notes and photo; priority categories on those calls; and check-in statuses.</dd></div>
        <div><dt>Administrators (municipal operations)</dt><dd>Everything above, plus all profiles, priority entries and proofs, security records and the activity log.</dd></div>
        <div><dt>Other residents</dt><dd>None of your personal information. A verified report may become a hazard point on the map, without your name or number.</dd></div>
        <div><dt>Authorities</dt><dd>Only when the law requires it, or when needed to protect someone's life or health in an emergency.</dd></div>
      </dl>
    </Section>

    <Section id="providers" number={n('providers')} title="Service providers and transfers abroad">
      <p>LIGTAS uses these providers to work. They handle information only to provide their service:</p>
      <ul>
        <li><b>Supabase:</b> database, sign-in and file storage (profiles, reports, photos, proofs).</li>
        <li><b>Vercel:</b> hosts the LIGTAS website and app.</li>
        <li><b>Google:</b> only if you use Continue with Google.</li>
        <li><b>OpenStreetMap map servers:</b> your phone downloads map images of the area you are viewing, which shows that area and your IP address to them.</li>
        <li><b>FOSSGIS routing server (Germany):</b> when you ask for directions, or LIGTAS looks for the nearest safe evacuation center, your starting point and destination are sent to it to work out the route.</li>
      </ul>
      <p>Some of these providers store or process information outside the Philippines. We remain responsible for your information under the Data Privacy Act wherever it is processed. Voice directions use your phone's own speech feature.</p>
    </Section>

    <Section id="phone" number={n('phone')} title="Information stored on your phone">
      <ul>
        <li>Recent alerts, evacuation centers, map points and reports are saved on your phone so they still show without a connection. This saved copy is deleted when you sign out.</li>
        <li>Reports written without a connection wait on your phone until you are back online.</li>
        <li>Your language, go-bag checklist and map images you have viewed stay on your phone for offline use.</li>
        <li>Signing in keeps a session key on your phone. LIGTAS uses no advertising or tracking cookies.</li>
      </ul>
    </Section>

    <Section id="keep" number={n('keep')} title="How long we keep it">
      <ul>
        <li><b>Account, reports and check-ins:</b> while your account exists. Reports are kept as records of incidents that help later response and planning.</li>
        <li><b>Priority entries and proofs:</b> until you remove them, withdraw consent, or your account is deleted.</li>
        <li><b>Check-ins and rescuer locations:</b> only the latest one is kept. A rescuer's location is removed when they stop sharing it.</li>
        <li><b>Security records:</b> while your account exists, so misuse can be investigated and reports can be trusted.</li>
        <li><b>When your account is deleted:</b> your profile, reports, check-ins, priority entries, security records, photos and proofs are deleted with it.</li>
      </ul>
    </Section>

    <Section id="protect" number={n('protect')} title="How we protect it">
      <ul>
        <li>Encrypted connections (HTTPS) for everything LIGTAS sends and receives.</li>
        <li>Access rules in the database for every account type, so each person sees only what their role allows.</li>
        <li>Two-step sign-in for administrators; sessions can be ended remotely and stop working at once.</li>
        <li>Private storage for photos and proofs, opened only through short-lived links.</li>
        <li>Digital signatures on reports, to detect changes made outside the app.</li>
        <li>Location checks and limits against fake and automated reports.</li>
      </ul>
      <p>No system is perfectly secure. If a breach of personal information is likely to cause you harm, we will notify the National Privacy Commission and the people affected within 72 hours of learning of it, as the law requires.</p>
    </Section>

    <Section id="rights" number={n('rights')} title="Your rights">
      <p>Under the Data Privacy Act, you have the right to:</p>
      <ul>
        <li>be informed of how your information is used (this policy);</li>
        <li>access your information and get a copy in a common electronic format;</li>
        <li>correct information that is wrong or out of date;</li>
        <li>object to processing and withdraw your consent;</li>
        <li>have your information blocked or deleted;</li>
        <li>claim damages if you are harmed by unlawful processing; and</li>
        <li>file a complaint with the <a href="https://privacy.gov.ph" target="_blank" rel="noreferrer">National Privacy Commission</a>.</li>
      </ul>
      <p><b>In the app</b>, you can change your name, number and barangay in Prepare → My details, withdraw a report that is still waiting for review, and remove priority entries or withdraw consent in Prepare → Priority rescue. <b>For anything else</b>, such as a copy of your information or deleting your account, email <Email />. We may ask you to confirm your identity first. Some information may be kept where the law requires it, for example to investigate a false emergency report.</p>
    </Section>

    <Section id="children" number={n('children')} title="Children">
      <p>Accounts are for people 18 and older, or younger people with a parent's or guardian's permission. Information about children also reaches LIGTAS when a parent or guardian lists them for priority rescue; it is used only for that.</p>
    </Section>

    <Section id="changes" number={n('changes')} title="Changes to this policy">
      <p>We update the date at the top whenever this policy changes. For important changes, we ask you to accept the new version in the app.</p>
    </Section>

    <Section id="contact" number={n('contact')} title="Contact us">
      <p>Privacy questions and requests: <Email /> (LIGTAS team, Santa Maria, Bulacan). This address is not monitored for emergencies. In an emergency, call <Rescue />.</p>
    </Section>
  </>
}

export function LegalPage({ doc, onBack }) {
  const isTerms = doc === 'terms'
  useEffect(() => {
    window.scrollTo(0, 0)
    const previous = document.title
    document.title = `${isTerms ? 'Terms of Use' : 'Privacy Policy'} · LIGTAS`
    return () => { document.title = previous }
  }, [doc])

  return <article class="legal-page">
    <header class="legal-hero">
      <button type="button" class="legal-back" onClick={onBack}><Icon name="arrow" size={16} /> Back</button>
      <span class="about-eyebrow">{isTerms ? 'Terms of Use' : 'Privacy Policy'}</span>
      <h1>{isTerms ? 'Terms of Use' : 'Privacy Policy'}</h1>
      <p>Last updated {LEGAL_UPDATED}</p>
      <nav class="legal-switch" aria-label="Legal documents">
        <a href={termsUrl} aria-current={isTerms ? 'page' : undefined}>Terms of Use</a>
        <a href={privacyUrl} aria-current={isTerms ? undefined : 'page'}>Privacy Policy</a>
      </nav>
    </header>
    <div class="legal-body">{isTerms ? <Terms /> : <Privacy />}</div>
  </article>
}
