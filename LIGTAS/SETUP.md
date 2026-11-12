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

The screens expect the newest migration. Until it is applied, report lists fail to load
with a "column does not exist" error.

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

## Notes

- **SOS reports skip admin review** so they reach rescuers immediately. They have
  their own limit of 3 per person every 10 minutes.
- **Deactivating a rescuer** turns the account back into a citizen account. It does not
  delete the login; remove the user under *Authentication → Users* if needed.
- **Report photos** are resized to 1600 px in the browser before upload.
- **Free Supabase projects pause after about a week without activity.** Restore the
  project from the dashboard if sign-in fails with "Failed to fetch".
