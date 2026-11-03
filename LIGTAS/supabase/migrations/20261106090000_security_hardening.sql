-- Security hardening: the database sets its own timestamps instead of trusting
-- the browser, citizens cannot mark ordinary reports Critical, and alerts are
-- rate limited.
-- Requires 20261105090000_ph_mobile_and_google.sql.

-- ---------------------------------------------------------------------------
-- Incident reports
-- ---------------------------------------------------------------------------
-- created_at decides the report rate limit and the queue order, so a report
-- sent with an old or future date could skip the limit or jump the queue.
create or replace function public.incident_reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.report_type <> 'SOS' and new.priority = 'Critical' then
    raise exception 'Only SOS reports can be marked Critical.';
  end if;

  new.created_at := now();
  new.assigned_at := null;
  new.resolved_at := null;

  -- Responders call back the number on the reporter's profile at the time of
  -- the report, so the copy is made here rather than trusted from the browser.
  select display_name, phone
    into new.contact_name, new.contact_phone
    from public.profiles
    where id = new.reporter_id;
  return new;
end;
$$;

revoke all on function public.incident_reports_before_insert() from public;

-- ---------------------------------------------------------------------------
-- Alerts
-- ---------------------------------------------------------------------------
-- The server time decides the order alerts appear in, and no one can flood
-- every phone with alerts.
create function public.alerts_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_at := now();

  if (
    select count(*)
    from public.alerts
    where created_by = new.created_by
      and created_at > now() - interval '10 minutes'
  ) >= 10 then
    raise exception 'You have sent many alerts in the last few minutes. Please wait before sending another.';
  end if;
  return new;
end;
$$;

revoke all on function public.alerts_before_insert() from public;

create trigger alerts_before_insert
  before insert on public.alerts
  for each row execute procedure public.alerts_before_insert();

-- ---------------------------------------------------------------------------
-- Check-ins and rescuer locations
-- ---------------------------------------------------------------------------
-- updated_at decides whether a team shows as live and whether a check-in is
-- recent. Updates already use the server time; new rows now do too.
create trigger safety_checkins_touch_updated_at_on_insert
  before insert on public.safety_checkins
  for each row execute procedure public.touch_updated_at();

create trigger rescuer_locations_touch_updated_at_on_insert
  before insert on public.rescuer_locations
  for each row execute procedure public.touch_updated_at();
