-- Tamper detection for incident reports.
-- The report-integrity Edge Function signs each new report with an HMAC whose
-- secret key exists only in the function's settings, never in the database or
-- the app. If someone later changes a report's position, notes or contact
-- directly in the database, the signature no longer matches and staff screens
-- show the report as changed outside the app.
-- Requires 20261107090000_location_checks.sql.

alter table public.incident_reports
  add column integrity_sig text
    check (integrity_sig is null or integrity_sig ~ '^[0-9a-f]{64}$'),
  add column integrity_signed_at timestamptz;

-- Only the Edge Function (service role) writes the signature. Signed-in users
-- have no update permission on these columns, and a value sent with a new
-- report is discarded here.
create function public.incident_reports_clear_signature()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.integrity_sig := null;
  new.integrity_signed_at := null;
  return new;
end;
$$;

revoke all on function public.incident_reports_clear_signature() from public;

create trigger incident_reports_clear_signature
  before insert on public.incident_reports
  for each row execute procedure public.incident_reports_clear_signature();

-- A signature is written once. Removing or replacing it would let a changed
-- report look like one that was never signed.
create function public.incident_reports_keep_signature()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.integrity_sig is not null and (
    new.integrity_sig is distinct from old.integrity_sig
    or new.integrity_signed_at is distinct from old.integrity_signed_at
  ) then
    raise exception 'Report signatures cannot be changed.';
  end if;
  return new;
end;
$$;

revoke all on function public.incident_reports_keep_signature() from public;

create trigger incident_reports_keep_signature
  before update on public.incident_reports
  for each row execute procedure public.incident_reports_keep_signature();
