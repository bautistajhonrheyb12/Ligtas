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

`src/lib/hotlines.js` only lists nationwide numbers (911 and the Red Cross, 143).
Add your verified local MDRRMO, BFP station and barangay numbers there.

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
  requirements** to letters and digits, matching the app. The app's own check can be
  skipped by someone calling Supabase directly; this one cannot.
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

## Notes

- **SOS reports skip admin review** so they reach rescuers immediately. They have
  their own limit of 3 per person every 10 minutes.
- **Deactivating a rescuer** turns the account back into a citizen account. It does not
  delete the login; remove the user under *Authentication → Users* if needed.
- **Report photos** are resized to 1600 px in the browser before upload.
- **Free Supabase projects pause after about a week without activity.** Restore the
  project from the dashboard if sign-in fails with "Failed to fetch".
