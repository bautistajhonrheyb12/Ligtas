-- Reporter contact details, report withdrawal, call hand-back, alert ending,
-- rescuer deactivation, integrity fixes and indexes.
-- Requires 20261102090000_field_operations.sql.

-- ---------------------------------------------------------------------------
-- Profiles: phone number, and sign-up details copied from the sign-up form
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column phone text
    check (phone is null or phone ~ '^\+?[0-9][0-9 -]{5,19}$');

grant update (phone) on table public.profiles to authenticated;

-- New accounts keep the name, barangay and phone given at sign-up. Values that
-- would break the column checks are dropped instead of failing the sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  name_value text := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  barangay_value text := nullif(trim(new.raw_user_meta_data ->> 'barangay'), '');
  phone_value text := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
begin
  insert into public.profiles (id, role, display_name, barangay, phone)
  values (
    new.id,
    'citizen',
    case when char_length(name_value) between 1 and 80 then name_value end,
    case when char_length(barangay_value) between 2 and 80 then barangay_value end,
    case when phone_value ~ '^\+?[0-9][0-9 -]{5,19}$' then phone_value end
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

-- ---------------------------------------------------------------------------
-- Incident reports: contact snapshot, Cancelled status
-- ---------------------------------------------------------------------------
alter table public.incident_reports
  add column contact_name text
    check (contact_name is null or char_length(contact_name) <= 80),
  add column contact_phone text
    check (contact_phone is null or char_length(contact_phone) <= 24);

alter table public.incident_reports
  drop constraint incident_reports_status_check;

alter table public.incident_reports
  add constraint incident_reports_status_check
    check (status in ('Pending', 'Verified', 'Resolved', 'Rejected', 'Cancelled'));

-- Responders call back the number on the reporter's profile at the time of the
-- report, so the copy is made here rather than trusted from the browser.
create function public.incident_reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select display_name, phone
    into new.contact_name, new.contact_phone
    from public.profiles
    where id = new.reporter_id;
  return new;
end;
$$;

revoke all on function public.incident_reports_before_insert() from public;

create trigger incident_reports_before_insert
  before insert on public.incident_reports
  for each row execute procedure public.incident_reports_before_insert();

-- Photos must come from the reporter's own storage folder.
drop policy "Citizens can submit incident reports" on public.incident_reports;

create policy "Citizens can submit incident reports"
  on public.incident_reports
  for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and public.current_user_role() = 'citizen'
    and assigned_to is null
    and response_stage is null
    and resolution_note is null
    and (photo_path is null or photo_path like (select auth.uid())::text || '/%')
    and (
      (status = 'Pending' and report_type <> 'SOS')
      or (status = 'Verified' and report_type = 'SOS' and priority = 'Critical')
    )
  );

-- Citizens may withdraw their own report while it is still waiting for review.
create policy "Citizens can withdraw their pending reports"
  on public.incident_reports
  for update
  to authenticated
  using (
    reporter_id = (select auth.uid())
    and status = 'Pending'
    and public.current_user_role() = 'citizen'
  )
  with check (
    reporter_id = (select auth.uid())
    and status = 'Cancelled'
  );

create or replace function public.incident_reports_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := public.current_user_role();
begin
  if caller_role = 'citizen' and (
    new.priority is distinct from old.priority
    or new.assigned_to is distinct from old.assigned_to
    or new.response_stage is distinct from old.response_stage
    or new.resolution_note is distinct from old.resolution_note
  ) then
    raise exception 'Citizens can only withdraw their reports.';
  end if;

  if caller_role = 'rescuer' and new.priority is distinct from old.priority then
    raise exception 'Rescuers cannot change report priority.';
  end if;

  -- A report sent back to review, rejected or withdrawn no longer has a team.
  if new.status in ('Pending', 'Rejected', 'Cancelled') then
    new.assigned_to := null;
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    new.assigned_at := case when new.assigned_to is null then null else now() end;
    if new.assigned_to is null then
      new.response_stage := null;
    elsif new.response_stage is null or new.response_stage is not distinct from old.response_stage then
      -- A newly assigned team always starts from the beginning.
      new.response_stage := 'Assigned';
    end if;
  end if;

  if new.status = 'Resolved' and old.status is distinct from 'Resolved' then
    new.resolved_at := now();
  elsif new.status <> 'Resolved' then
    new.resolved_at := null;
  end if;

  -- A rejection reason or resolution note no longer applies once the report is reopened.
  if old.status in ('Rejected', 'Resolved') and new.status in ('Pending', 'Verified')
    and new.resolution_note is not distinct from old.resolution_note then
    new.resolution_note := null;
  end if;

  return new;
end;
$$;

revoke all on function public.incident_reports_before_update() from public;

-- SOS has its own, separate limit so a burst of ordinary reports never blocks it.
create or replace function public.limit_incident_report_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.report_type = 'SOS' then
    if (
      select count(*)
      from public.incident_reports
      where reporter_id = new.reporter_id
        and report_type = 'SOS'
        and created_at > now() - interval '10 minutes'
    ) >= 3 then
      raise exception 'Your SOS was already sent. Rescuers have it. If you can, call 911 now.';
    end if;
  elsif (
    select count(*)
    from public.incident_reports
    where reporter_id = new.reporter_id
      and report_type <> 'SOS'
      and created_at > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'You have sent several reports in the last few minutes. Please wait a moment before sending another.';
  end if;
  return new;
end;
$$;

revoke all on function public.limit_incident_report_rate() from public;

-- Rescuers who cannot respond hand the call back to the open queue.
create function public.release_incident_report(report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() <> 'rescuer' then
    raise exception 'Only rescuers can hand back calls.';
  end if;

  update public.incident_reports
    set assigned_to = null
    where id = report_id
      and assigned_to = (select auth.uid())
      and status = 'Verified';

  if not found then
    raise exception 'This call is not assigned to you.';
  end if;
end;
$$;

revoke all on function public.release_incident_report(uuid) from public;
grant execute on function public.release_incident_report(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Activity log: reporters can follow their own reports
-- ---------------------------------------------------------------------------
create policy "Reporters can read the activity of their own reports"
  on public.report_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.incident_reports
      where incident_reports.id = report_events.report_id
        and incident_reports.reporter_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Alerts: admins can end or delete them
-- ---------------------------------------------------------------------------
grant update (expires_at), delete on table public.alerts to authenticated;

create policy "Admins can end alerts"
  on public.alerts
  for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "Admins can delete alerts"
  on public.alerts
  for delete
  to authenticated
  using (public.current_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Staff accounts: admins can deactivate a rescuer (back to a citizen account)
-- ---------------------------------------------------------------------------
create function public.deactivate_rescuer(rescuer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Only admins can deactivate rescuers.';
  end if;

  update public.profiles
    set role = 'citizen'
    where id = rescuer_id
      and role = 'rescuer';

  if not found then
    raise exception 'That account is not an active rescuer.';
  end if;

  -- Open calls go back to the queue so nothing is left waiting on this team.
  update public.incident_reports
    set assigned_to = null
    where assigned_to = rescuer_id
      and status = 'Verified';

  delete from public.rescuer_locations where rescuer_locations.rescuer_id = deactivate_rescuer.rescuer_id;
end;
$$;

revoke all on function public.deactivate_rescuer(uuid) from public;
grant execute on function public.deactivate_rescuer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Indexes for the queries the screens run most
-- ---------------------------------------------------------------------------
create index incident_reports_status_created_idx on public.incident_reports (status, created_at desc);
create index incident_reports_reporter_created_idx on public.incident_reports (reporter_id, created_at desc);
create index incident_reports_assigned_to_idx on public.incident_reports (assigned_to) where assigned_to is not null;
create index alerts_created_at_idx on public.alerts (created_at desc);
create index report_events_created_at_idx on public.report_events (created_at desc);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.report_events,
  public.safety_checkins;
