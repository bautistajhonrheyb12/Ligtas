-- Rescuer operations (Nov 2026): availability, field notes, rescue outcomes,
-- and a clear answer when two teams try to take the same call.
--
-- 1. rescuer_status: each rescuer's availability (Available, Responding,
--    Unavailable). Rescuers set their own; rescuers and admins can read all,
--    so operations sees who can take a call. Nothing else can write it.
-- 2. claim_incident_report(): takes a call only while it is verified and has
--    no team, in one step, so two teams can never both take it. The second
--    team is told "Another team already took this call" instead of a raw
--    database error. (Row security already blocked a double claim; this makes
--    the refusal clear.)
-- 3. add_field_note(): a field note is a line in the existing activity log
--    (report_events, action 'Field note'). Only the team on the call (or an
--    admin) can add one; notes cannot be edited or deleted afterwards.
-- 4. Rescuers can read the activity log of the calls they can see (verified
--    or resolved), so the team sees the field notes. Reporters can still read
--    their own report's activity, except field notes, which may describe other
--    people.
-- 5. resolution_outcome: what came of a call, from a fixed list, set when it
--    is resolved. Cleared if the call is reopened. Citizens cannot set it.
--
-- Nothing existing is removed or rewritten. Running it again changes nothing.

begin;

-- ---------------------------------------------------------------------------
-- 1. Availability
-- ---------------------------------------------------------------------------
create table if not exists public.rescuer_status (
  rescuer_id uuid primary key references auth.users (id) on delete cascade,
  availability text not null default 'Available'
    check (availability in ('Available', 'Responding', 'Unavailable')),
  updated_at timestamptz not null default now()
);

alter table public.rescuer_status enable row level security;

revoke all on table public.rescuer_status from anon, authenticated;
grant select, insert, update on table public.rescuer_status to authenticated;

drop policy if exists "Staff can read rescuer availability" on public.rescuer_status;
create policy "Staff can read rescuer availability"
  on public.rescuer_status
  for select
  to authenticated
  using (public.current_user_role() in ('rescuer', 'admin'));

drop policy if exists "Rescuers can set their availability" on public.rescuer_status;
create policy "Rescuers can set their availability"
  on public.rescuer_status
  for insert
  to authenticated
  with check (rescuer_id = (select auth.uid()) and public.current_user_role() = 'rescuer');

drop policy if exists "Rescuers can change their availability" on public.rescuer_status;
create policy "Rescuers can change their availability"
  on public.rescuer_status
  for update
  to authenticated
  using (rescuer_id = (select auth.uid()) and public.current_user_role() = 'rescuer')
  with check (rescuer_id = (select auth.uid()) and public.current_user_role() = 'rescuer');

-- The time is always the server's.
create or replace function public.rescuer_status_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.rescuer_status_touch() from public;

drop trigger if exists rescuer_status_touch on public.rescuer_status;
create trigger rescuer_status_touch
  before insert or update on public.rescuer_status
  for each row execute procedure public.rescuer_status_touch();

-- Live on the admin dashboard and other rescuers' screens.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rescuer_status'
  ) then
    alter publication supabase_realtime add table public.rescuer_status;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Taking a call: one team only
-- ---------------------------------------------------------------------------
create or replace function public.claim_incident_report(report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  current_team uuid;
  current_status text;
begin
  if public.current_user_role() <> 'rescuer' then
    raise exception 'Only rescuers can take calls.';
  end if;

  -- One statement: if another team's update lands first, this one finds the
  -- call already taken and changes nothing.
  update public.incident_reports
    set assigned_to = caller
    where id = report_id
      and status = 'Verified'
      and assigned_to is null;
  if found then
    return;
  end if;

  select r.assigned_to, r.status into current_team, current_status
    from public.incident_reports r
    where r.id = report_id;
  if current_status is null then
    raise exception 'This call no longer exists.';
  end if;
  if current_team = caller and current_status = 'Verified' then
    return;
  end if;
  if current_status <> 'Verified' then
    raise exception 'This call is no longer open (%).', lower(current_status);
  end if;
  raise exception 'Another team already took this call.';
end;
$$;

revoke all on function public.claim_incident_report(uuid) from public;
grant execute on function public.claim_incident_report(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Field notes
-- ---------------------------------------------------------------------------
create or replace function public.add_field_note(call_id uuid, note text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  caller_role text := public.current_user_role();
  clean text := public.clean_text(note);
  call_status text;
  call_team uuid;
  new_id bigint;
begin
  if caller_role is null or caller_role not in ('rescuer', 'admin') then
    raise exception 'Only response staff can add field notes.';
  end if;
  if clean is null or char_length(clean) < 2 then
    raise exception 'Write the field note first.';
  end if;
  if char_length(clean) > 500 then
    raise exception 'Keep a field note to 500 characters.';
  end if;

  select r.status, r.assigned_to into call_status, call_team
    from public.incident_reports r
    where r.id = call_id;
  if call_status is null or call_status not in ('Verified', 'Resolved') then
    raise exception 'This call is not open to field notes.';
  end if;
  if caller_role = 'rescuer' and call_team is distinct from caller then
    raise exception 'Only the team on this call can add field notes.';
  end if;
  if (select count(*) from public.report_events e where e.report_id = call_id and e.action = 'Field note') >= 50 then
    raise exception 'This call already has 50 field notes.';
  end if;

  insert into public.report_events (report_id, actor_id, action, detail)
    values (call_id, caller, 'Field note', clean)
    returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.add_field_note(uuid, text) from public;
grant execute on function public.add_field_note(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Who reads the activity log
-- ---------------------------------------------------------------------------
drop policy if exists "Reporters can read the activity of their own reports" on public.report_events;
create policy "Reporters can read the activity of their own reports"
  on public.report_events
  for select
  to authenticated
  using (
    action <> 'Field note'
    and exists (
      select 1
      from public.incident_reports
      where incident_reports.id = report_events.report_id
        and incident_reports.reporter_id = (select auth.uid())
    )
  );

drop policy if exists "Rescuers can read the activity of calls they can see" on public.report_events;
create policy "Rescuers can read the activity of calls they can see"
  on public.report_events
  for select
  to authenticated
  using (
    public.current_user_role() = 'rescuer'
    and exists (
      select 1
      from public.incident_reports r
      where r.id = report_events.report_id
        and r.status in ('Verified', 'Resolved')
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Rescue outcome
-- ---------------------------------------------------------------------------
alter table public.incident_reports
  add column if not exists resolution_outcome text;

alter table public.incident_reports
  drop constraint if exists incident_reports_resolution_outcome_check;

alter table public.incident_reports
  add constraint incident_reports_resolution_outcome_check check (
    resolution_outcome is null or resolution_outcome in (
      'Rescued', 'Evacuated', 'Treated on site', 'Taken to hospital',
      'Hazard cleared', 'No action needed', 'Could not locate', 'False alarm'
    )
  );

grant update (resolution_outcome) on table public.incident_reports to authenticated;

-- The update guard from 20261103090000_contacts_and_controls.sql, with the
-- outcome added: citizens cannot set it, and it only stays on a resolved call.
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
    or new.resolution_outcome is distinct from old.resolution_outcome
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

  -- An outcome belongs to a resolved call only.
  if new.status <> 'Resolved' then
    new.resolution_outcome := null;
  end if;

  return new;
end;
$$;

revoke all on function public.incident_reports_before_update() from public;

commit;
