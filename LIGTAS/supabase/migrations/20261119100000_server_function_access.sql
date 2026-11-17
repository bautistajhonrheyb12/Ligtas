-- Lets the server functions (create-rescuer, report-integrity, send-push) read
-- and write what they need.
-- They use the project's secret (service role) key. On this project, new tables
-- do not give that key access automatically, and the earlier migrations only
-- granted access to signed-in users. So these functions were refused: push
-- notifications were never sent, reports were never signed, and creating a
-- rescuer account failed. This grants exactly what each function uses, nothing
-- more. Only server code holds the secret key; it is never in the app.
-- Requires 20261119090000_push_notifications.sql.

-- create-rescuer: checks that the caller is an admin, then makes the new
-- account a rescuer.
grant select on table public.profiles to service_role;
grant update (role, display_name) on table public.profiles to service_role;

-- report-integrity: reads reports to sign or check them, and writes each
-- signature once (a trigger stops a signature from ever changing).
grant select on table public.incident_reports to service_role;
grant update (integrity_sig, integrity_signed_at) on table public.incident_reports to service_role;

-- send-push: reads the new alert or report change, and removes phones that
-- have unsubscribed.
grant select on table public.alerts to service_role;
grant select on table public.report_events to service_role;
grant select, delete on table public.push_subscriptions to service_role;
