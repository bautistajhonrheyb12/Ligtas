# LIGTAS setup

## 1. Environment

Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable key.

```bash
npm install
npm run dev
```

## 2. Database

The app needs every migration in `supabase/migrations/`, in order.

`20261102090000_field_operations.sql` adds:

- report location (GPS), photos, priority, people affected and vulnerable-people flags
- call claiming by rescuers (`assigned_to`, `response_stage`, resolution notes)
- the `report_events` activity log (written automatically by a trigger)
- `evacuation_centers`, `map_points`, `safety_checkins`, `rescuer_locations` tables
- alert barangay targeting and expiry
- a private `report-photos` storage bucket
- a limit of 5 reports per person every 10 minutes
- realtime for reports, alerts, centers, map points and rescuer locations

`20261103090000_contacts_and_controls.sql` adds:

- a phone number on profiles, and name/barangay/phone saved from the sign-up form
- the reporter's name and phone copied onto each report so responders can call back
- citizens withdrawing a report that is still pending (status `Cancelled`)
- rescuers handing a call back to the open queue (`release_incident_report`)
- admins ending or deleting alerts, and deactivating rescuers (`deactivate_rescuer`)
- a separate SOS rate limit (3 per 10 minutes) so ordinary reports never block an SOS
- integrity fixes: unassigning clears the response stage, and sending a report back to
  review or rejecting it releases the team
- indexes, and realtime for the activity log and safety check-ins

`20261104090000_admin_two_step.sql` makes every admin permission require two-step
sign-in (see section 6). A session signed in with only the admin password has no
admin rights in the database.

`20261105090000_ph_mobile_and_google.sql` adds:

- Philippine mobile numbers only: saved as `+63` followed by 10 digits starting with 9
  (`+639171234567`). Numbers already saved as `0917 123 4567`, `63917…` or
  `+63 917…` are converted; anything else (landlines, foreign numbers) is cleared.
- the name from Google (`full_name`) for citizens who sign up with Google

`20261106090000_security_hardening.sql` stops the browser from deciding things
the server should:

- report, alert, check-in and rescuer-location times are set by the database, so a
  backdated report cannot skip the rate limit and a stale team cannot look live
- only SOS reports can be marked Critical
- at most 10 alerts per person every 10 minutes

`20261107090000_location_checks.sql` checks every report's position (see section 10):

- positions outside Santa Maria's border are refused
- a GPS report impossibly far from the same person's last GPS report (faster than
  150 km/h, ignoring hops under 3 km) is refused; pinned and offline reports skip
  this, since a pin may be anywhere in town
- an SOS is never refused: it goes through marked, so rescuers call first
- reports from networks outside the Philippines are marked (when Supabase passes on
  the network country)
- every problem is saved as a security flag for admins (*Security* page)

`20261107091000_report_integrity.sql` adds the signature column for tamper detection
(section 10). `20261107092000_session_revocation.sql` makes a token stop working the
moment its session ends. `20261107093000_abuse_limits.sql` pauses accounts with
repeated flags, caps photo uploads and strips hidden characters from text.

`20261116090000_priority_assistance.sql` adds priority rescue (section 12): the
`priority_members` table, the private `priority-proofs` bucket, the question every
citizen answers, and the verified categories on each report and SOS.

`20261117090000_terms_acceptance.sql` records who accepted the Terms of Use and
Privacy Policy, which version and when (section 13).

`20261118090000_sos_live_location.sql` adds the GPS accuracy of each report and
live SOS location (section 11): the `location_accuracy` and `live_*` columns and the
`share_sos_location` function. Until it is applied, the app still works, but without
accuracy circles or live location.

Apply every migration, in order. Screens built for a newer migration than the
database has fail with a "column does not exist" error, except the last one above.

Apply each migration with either option:

- **Supabase CLI:** `npx supabase db push` (the project is already linked)
- **Dashboard:** open *SQL Editor*, paste the file's contents and run it once

## 3. Auth redirect URLs

Password reset and sign-up confirmation emails link back to the app. In the Supabase
dashboard open *Authentication → URL Configuration* and:

- set **Site URL** to the address people use (for example `https://ligtas.example.org`)
- add that address and `http://localhost:5173` to **Redirect URLs**

Google sign-in also returns to these addresses.

### Continue with Google (citizens only)

The citizen login and sign-up screens offer *Continue with Google*. It stays broken
until Google is turned on in Supabase:

1. In [Google Cloud Console](https://console.cloud.google.com/) create a project, then
   open *APIs & Services → OAuth consent screen* and set it up (External, app name
   LIGTAS, your support email).
2. Open *Credentials → Create credentials → OAuth client ID*, type **Web application**.
   - **Authorized JavaScript origins:** the app address (for example
     `https://ligtas-self.vercel.app`) and `http://localhost:5173`
   - **Authorized redirect URIs:** `https://<project-ref>.supabase.co/auth/v1/callback`
     (Supabase shows this exact address on the Google provider page)
3. In Supabase open *Authentication → Sign In / Providers → Google*, switch it on and
   paste the **Client ID** and **Client Secret**.

While the consent screen is in *Testing*, only the Google accounts listed under
*Test users* can sign in. Publish the app there to let anyone in.

Google accounts become citizen accounts. If a rescuer or admin signs in with Google
(for example because Google uses the same email), the app signs them straight out:
staff must use their email and password. Google does not share a phone number, so
the report form reminds these citizens to add one under *Prepare → My details*.

## 4. Create-rescuer function

Admins create rescuer accounts through the `create-rescuer` Edge Function, because
creating users needs the service role key, which must never reach the browser.

```bash
npx supabase functions deploy create-rescuer
```

Deploy it again after pulling these changes: it now refuses admins who have not
completed two-step sign-in, and passwords without both letters and numbers.

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
to the function automatically.

## 5. First admin account

Sign up once as a citizen, then promote that account in the SQL Editor:

```sql
update public.profiles set role = 'admin', display_name = 'MDRRMO Operations'
where id = (select id from auth.users where email = 'you@example.com');
```

## 6. Admin sign-in and two-step verification

- **The Admin option is not on the public login page.** Staff open the app with
  `#staff` at the end of the address (for example `https://ligtas.example.org/#staff`).
  Share that link only with staff. The link is a convenience, not the protection.
- **Admins need an authenticator app** (Google Authenticator, Microsoft Authenticator
  or Authy). On the first sign-in after the migration, the app shows a QR code to scan;
  every sign-in after that asks for the 6-digit code.
- Authenticator apps (TOTP) are on by default in Supabase. If setup says they are off,
  enable them under *Authentication → Multi-Factor*.
- **If an admin loses their phone,** the project owner resets it in the SQL Editor, and
  the admin sets up a new phone on their next sign-in:

  ```sql
  delete from auth.mfa_factors
  where user_id = (select id from auth.users where email = 'admin@example.com');
  ```

- Turn on two-factor sign-in for your own Supabase account too (*Account → Security*).
  Whoever controls the Supabase project controls every role.

## 7. Emergency hotlines

`src/lib/hotlines.js` lists only the Municipality of Santa Maria's verified hotlines, from
its official *Emergency Hotlines* poster: MDRRMO Rescue, the police station, the fire
station, the LGU Command Center and RMMMH General Hospital. They show in the citizen
*Prepare* tab and on the About page, and the SOS screen's call button dials MDRRMO Rescue.
Never add a number that has not been verified. Update the file whenever the LGU
publishes new numbers (the SOS and database messages also quote the MDRRMO number).

## 8. Offline support

Production builds (`npm run build`) register `public/sw.js`, which keeps the app and
recently viewed map tiles available offline. The app also keeps the last alerts,
evacuation centers and map points on the device, and queues reports written offline
until the connection returns. Service workers only run over HTTPS (or `localhost`).

## 9. Security settings

`vercel.json` sends security headers with every page. The Content Security Policy
only lets the app load scripts from its own site and talk to its own Supabase project,
OpenStreetMap tiles and Google Fonts. **If the Supabase project changes, update the
project address in `vercel.json`**, or the app cannot reach the database.

The database rules, two-step sign-in and these headers do not cover everything. These
settings live in the dashboards and only the owner can change them:

**Supabase → Authentication**

- *Sign In / Providers → Email:* keep **Confirm email** on, and turn on **Secure email
  change**.
- *Sign In / Providers → Email:* set **Minimum password length** to 8 and **Password
  requirements** to **Lowercase, uppercase letters, digits and symbols**, matching the
  app (8+ characters with an uppercase and lowercase letter, a number and a symbol).
  The app's own check can be skipped by someone calling Supabase directly; this one
  cannot. Existing accounts keep their passwords; the rules apply to new ones.
- *Attack Protection:* turn on **Leaked password protection** if your plan has it.
- *Emails → SMTP:* set up custom SMTP before real use. The built-in sender is limited
  to a few emails an hour.

**Supabase → Advisors → Security Advisor:** run it after applying migrations and fix
anything it flags.

**Accounts:** turn on two-factor sign-in for the Supabase, Vercel and GitHub accounts
that own the project. Anyone who gets into one of them controls the app.

**Keys:** only the publishable (anon) key belongs in the app and in Vercel. Never put
the service role key in `.env.local`, Vercel or the code. If it is ever exposed,
rotate it under *Project Settings → API Keys*.

## 10. Fake reports, tampering and stolen logins

### Location checks (anti-spoofing)

A web app cannot detect GPS-spoofing apps on a phone, so the database checks whether
each position makes sense instead (migration `20261107090000`). What happens:

| Situation | Ordinary report | SOS |
|---|---|---|
| Position outside Santa Maria | refused, flagged | sent, marked, flagged |
| GPS position impossibly far from the last GPS report | refused, flagged | sent, marked, flagged |
| Network outside the Philippines | sent, marked, flagged | sent, marked, flagged |
| 3 open flags within a day | paused until an admin clears them | always sent |

Admins review flags on the **Security** page, call the person if needed, and clear
them. The Security page also shows whether the network-country check is working:
it relies on Supabase passing on Cloudflare's country header. IP location is never
used to block anyone. Mobile networks in the Philippines put thousands of people
behind one IP address, and an IP block during a typhoon could cut off a barangay.
Only a one-way hash of the IP is stored, to spot one person using several accounts.

### Tamper detection (signatures)

Each new report is signed by the `report-integrity` Edge Function with an HMAC key
that exists only in that function's secrets, never in the database or the app.
Rescuer and admin screens check the signatures. A report whose position, notes or
contact was changed outside the app shows **Changed outside the app** in red; signed
reports show **Signed**; reports from before signing was set up show **Not signed**.
Signatures cannot be changed or removed once written.

Set it up once (any long random value works as the key):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npx supabase secrets set REPORT_SIGNING_KEY=<the value printed above>
npx supabase functions deploy report-integrity
```

Keep the key secret and never change it: changing it makes every signed report look
tampered. Without the function deployed, reports still work; they just show as not
signed.

### Stolen logins (instant sign-out)

Migration `20261107092000` makes the database check, on every request, that the
token's sign-in session still exists. So:

- **Sign out** ends the session on Supabase's servers, and a copy of that token
  stops working immediately, even before it expires
- admins can end a rescuer's sessions with **Teams → Sign out everywhere** (lost
  phone, suspected stolen login); **Deactivate** also signs them out
- open admin and rescuer screens check every minute and close if their session was
  ended elsewhere

Also set in the Supabase dashboard:

- *Project Settings → JWT Keys* (or *Authentication → Sessions*): set the **access
  token expiry** to 900 seconds (15 minutes). The app refreshes tokens on its own.
- *Authentication → Sessions / Attack Protection:* keep **Detect and revoke
  potentially compromised refresh tokens** (refresh token reuse detection) on.

The app is a static website with no server of its own, so tokens are kept in the
browser, not in HttpOnly cookies. The Content Security Policy (section 9) is what
stops injected scripts from reading them.

### Rate limits and upload limits

| Limit | Where |
|---|---|
| 5 reports and 3 SOS per person per 10 minutes | database |
| 10 alerts per person per 10 minutes | database |
| 10 photo uploads per person per 10 minutes, 5 MB each, JPEG/PNG/WebP only | storage |
| Unknown fields in a request are refused | Supabase API |
| Text lengths, hidden and control characters stripped | database |
| Sign-in and sign-up attempts | Supabase Auth rate limits |

Floods of traffic (DDoS) are absorbed by Vercel's and Supabase's networks before they
reach the app. If you want more, Vercel's *Firewall* can add rate-limit rules for the
website (check your plan), and Supabase can add CAPTCHA to sign-up under
*Authentication → Attack Protection*.

## 11. In-app navigation

Citizens navigate to evacuation centers and rescuers to calls without leaving
LIGTAS. Routes come from **Valhalla**, an open-source router that uses
OpenStreetMap road data: they follow real roads, respect one-way streets and
turn restrictions, offer alternatives, and give turn-by-turn instructions with
street names. Driving and walking are both supported.

**Safety first.** Routes are planned around LIGTAS hazard information, and only
verified information changes a route:

| Information | Effect on routes |
|---|---|
| Closed road map point; verified *Blocked road* or *Fallen tree* report | Never routed through |
| High-risk danger zone; verified flood, fire or landslide report | Avoided; a route through it is never called safe |
| Medium/low-risk danger zone; unverified (pending) reports | Allowed, with a warning |

Citizens' routes use the official map points; rescuers' routes also use verified
incident reports. Alerts have no map position, so they cannot change routes. When
no route avoids the hazards, the app says so plainly, shows the only route as
*not safe* and gives the MDRRMO Rescue number.

**While navigating:** voice prompts (English), distance to the next turn, current
road, ETA, remaining distance, speed and GPS quality. The position snaps to the
road being travelled, the map turns with the direction of travel (or north up),
and the route is recalculated when the person leaves it (several off-route GPS
fixes in a row, not a single jump) or when a new hazard is reported on it. Every
screen keeps an *Open in Google Maps* fallback.

**Also built on navigation:**

- *Go to the nearest safe evacuation center* (citizen home screen) times every open
  center by road in one request, skips centers that can only be reached through a
  hazard, prefers centers with free space, and starts navigation. The nearest-centers
  list shows these road times ("6 min by road") instead of straight-line distance.
- *Hazard ahead*: medium-risk zones and unverified reports the route passes are
  announced on screen and by voice shortly before reaching them.
- *Report while navigating* (citizens): one tap reports a blocked road, flooding,
  fallen tree or landslide at the current GPS position. It is an ordinary report:
  admins review it, and the usual location checks and limits apply.
- Rescuers navigating to their own call are marked *En route* when they start, and
  can mark *On scene* when they arrive.

### Rescuer map and live SOS location

Every open call with a position is a pin on the rescuer's *Map* tab. Tapping a
pin, or *Show on map* on a call card, opens the call's details next to the map:
address (looked up from the position), how far it is by road and how long it
takes, how accurate the position is, the people affected and their priority
needs, a *Call* button for the reporter, and the same actions as the call list
(*Take this call*, *Navigate*, *Open in Google Maps*).

**Accuracy.**

- Each report saves how accurate the phone's GPS was. The map draws that as a
  circle around the pin, and the details warn when it is rough (100 m or more),
  so the team knows to search the area and call first.
- After an SOS, the person's phone keeps sending its position while LIGTAS is
  open: whenever they move (at least 15 m, more when the GPS is rough) and about
  once a minute. It stops when the SOS is resolved, after 6 hours, or when they tap
  *Stop* (it asks first). Fixes worse than 500 m are not sent.
- The pin moves to the live position and pulses while it is fresh (updated in the
  last 2 minutes); the details say how long ago it was updated. The position from
  the original SOS stays saved and signed; the live one is kept in separate
  columns.
- When the person moves 30 m or more while a rescuer is navigating to them, the
  route is recalculated to where they are now, and the app says so on screen and
  by voice.

**Checks on live positions** (in `share_sos_location`): only the person who sent
the SOS, signed in as a citizen, while it is open and less than 6 hours old; the
position must be inside Santa Maria and no faster than 150 km/h from the last
one (ignoring hops under 3 km); at most one update every 10 seconds.

**Routing server.** By default the app uses the free public Valhalla server run
by FOSSGIS (valhalla1.openstreetmap.de). It is meant for light use, about one
request per second, with no guarantee of availability; LIGTAS spaces its requests
and recalculates at most every 20 seconds. Read its current terms before a public
launch. For heavy use, run your own Valhalla server and set
`VITE_ROUTING_URL` (in `.env.local` and in Vercel), then add that address to
`connect-src` in `vercel.json`.

**Privacy.** Planning a route sends the start position and destination to the
routing server; the Privacy Policy says so, along with live SOS location. A
self-hosted server keeps these positions within the LGU.

## 12. Priority rescue

Persons with disability (PWD), pregnant women, senior citizens (60 or older) and
children (under 18) are rescued first. Each household lists them with a proof,
an admin checks it, and rescuers see the verified categories on that household's
calls.

**The question.** After signing in, every citizen account (including existing and
Google accounts) must answer *Does anyone in your household need priority
rescue?* before using the app. SOS and the MDRRMO Rescue number stay on that
screen, so the question never blocks an emergency, and it is skipped when the
profile cannot load (for example, offline).

- **No:** answered. People can be added later under *Prepare → Priority rescue*.
- **Yes:** the person agrees to the privacy terms, then adds each person with a
  full name, a birth year (required for seniors and children), an expected due
  date for a pregnancy, optional details, and a photo or PDF of a proof:

  | Category | Proof |
  |---|---|
  | PWD | PWD ID or medical certificate |
  | Pregnant | Prenatal record or medical certificate with the due date |
  | Senior citizen | Senior citizen ID, or any ID with the birth date |
  | Child | Birth certificate, school ID or any record with the birth date |

**Review.** Admins open *Priority* in the sidebar, view each proof (through a
link that expires after 5 minutes) and choose *Verify* or *Reject*. A rejection
needs a reason, which the household sees with a prompt to send a new proof.
Any change by the household sends the entry back for review, nobody can verify
their own entries, and admins can only approve or reject, never edit.

**On calls.** Every report and SOS records the household's categories when it is
sent, and open ones update as entries are reviewed. Rescuers and admins see
verified ones as solid purple tags (for example, *Senior citizen ×2*) and
unchecked ones as dashed *unverified* tags. In the rescuer queue, calls with
verified priority come first within the same urgency. A child who turns 18, or
a pregnancy more than 60 days past its due date, no longer counts.

**Privacy (RA 10173).** Disability and health details are sensitive personal
information. The person consents before adding anyone. Proofs sit in a private
bucket that only the household and admins can open; rescuers never see names,
details or proofs. *Remove everything and withdraw consent* deletes every
entry and proof file. Mention this in the app's privacy notice, and give
admins a short briefing: proofs are for checking only, not for downloading or
sharing.

**Limits.** Up to 15 people per household and 20 proof uploads per person every
10 minutes; files are images or PDF, up to 5 MB (photos are resized first).

## 13. Terms of Use and Privacy Policy

The pages live at `/#terms` and `/#privacy`, in English and Filipino. They are
linked in the top menu, the site footer, the log-in and sign-up screens,
*Prepare → My details*, the admin sidebar and the rescuer screen, and open
whether or not someone is signed in. Each page has key points, a contents list,
an English/Filipino switch and a print or save-as-PDF button.

The text is in `src/content/terms.js` and `src/content/privacy.js` (both
languages side by side; the English version applies if they differ). The
privacy contact (`CONTACT_EMAIL`, now ligtas1130@gmail.com) is in
`src/lib/legal.js`. The policy names this address as the Data Protection
Officer's, so whoever reads it should handle privacy requests.

Keep the Privacy Policy matching what the app does. When a feature starts
collecting or sending information differently (a new service provider, for
example), update both languages.

**Acceptance.** Sign-up requires ticking "I agree to the Terms of Use and Privacy
Policy". Everyone else, including Google sign-ins, rescuers and admins, accepts
once on their next sign-in. Citizens keep SOS and the rescue hotline on that
screen. Each acceptance is saved on the profile (`terms_version`,
`terms_accepted_at`).

**Changing the documents.** Edit the text, then set `LEGAL_VERSION` in
`src/lib/legal.js` to the new date (the pages show it as "Last updated").
Everyone is asked to accept again. For typo fixes, leave the version as it is.

**Requests the policy promises to handle** (by email):

- *A copy of someone's information:* export their rows from `profiles`,
  `incident_reports`, `safety_checkins` and `priority_members` (Table Editor →
  filter by their user ID → Export to CSV).
- *Deleting an account:* *Authentication → Users → Delete user*. This deletes
  the profile, reports, check-ins, priority entries and security records. Then,
  in *Storage*, delete the folder named after their user ID in both
  `report-photos` and `priority-proofs`, since files are not removed
  automatically.
- *Data breach:* the policy commits to notifying the National Privacy
  Commission and the people affected within 72 hours.

**Data Privacy Act housekeeping.** Designate a Data Protection Officer for the
team, and check with the National Privacy Commission (privacy.gov.ph) whether
LIGTAS must be registered. Registration is generally required when sensitive
personal information of 1,000 or more people is processed. Have the documents
reviewed by a lawyer before a wide public launch.

## Notes

- **SOS reports skip admin review** so they reach rescuers immediately. They have
  their own limit of 3 per person every 10 minutes.
- **Deactivating a rescuer** turns the account back into a citizen account. It does not
  delete the login; remove the user under *Authentication → Users* if needed.
- **Report photos** are resized to 1600 px in the browser before upload.
- **Report addresses** fill in by themselves when a pin is dropped or "Use my location"
  is tapped: street, subdivision, barangay and a nearby landmark from OpenStreetMap's
  Nominatim service (`src/lib/geocode.js`). When the street has no name on the map,
  the routing server finds the nearest named road and its distance. Text the person
  typed is never overwritten; the address is offered with a *Use this* button
  instead. Offline, the pin's exact coordinates are filled in. Nominatim is free
  for light use (about one request a second, which the app keeps to). Addresses
  are only as complete as OpenStreetMap, so mapping missing street names in
  Santa Maria on openstreetmap.org improves them for everyone.
- **Free Supabase projects pause after about a week without activity.** Restore the
  project from the dashboard if sign-in fails with "Failed to fetch".
