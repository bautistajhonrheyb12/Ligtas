-- Field operations: report location/photos/priority, call claiming, activity log,
-- evacuation centers, map points, safety check-ins, rescuer locations,
-- alert targeting/expiry, report rate limiting and realtime.

-- ---------------------------------------------------------------------------
-- Role helper. Security definer so policies on profiles can check the caller's
-- role without recursing into the profiles policies themselves.
-- ---------------------------------------------------------------------------
create function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

-- ---------------------------------------------------------------------------
-- Profiles: display name and home barangay
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column display_name text
    check (display_name is null or char_length(trim(display_name)) between 1 and 80),
  add column barangay text
    check (barangay is null or char_length(trim(barangay)) between 2 and 80);

-- The role column is deliberately not granted, so users cannot promote themselves.
grant update (display_name, barangay) on table public.profiles to authenticated;

create policy "Users can update their own profile details"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (public.current_user_role() = 'admin');

create policy "Rescuers can read staff profiles"
  on public.profiles
  for select
  to authenticated
  using (
    public.current_user_role() = 'rescuer'
    and role in ('rescuer', 'admin')
  );

-- ---------------------------------------------------------------------------
-- Incident reports
-- ---------------------------------------------------------------------------
alter table public.incident_reports
  drop constraint incident_reports_report_type_check;

alter table public.incident_reports
  add constraint incident_reports_report_type_check
    check (report_type in (
      'Flooding', 'Blocked road', 'Fallen tree', 'Power outage',
      'Landslide', 'Fire', 'Medical', 'SOS', 'Other'
    )),
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180),
  add column photo_path text check (photo_path is null or char_length(photo_path) <= 300),
  add column priority text not null default 'Normal'
    check (priority in ('Normal', 'Urgent', 'Critical')),
  add column people_affected integer
    check (people_affected is null or people_affected between 0 and 10000),
  add column vulnerable_people boolean not null default false,
  add column assigned_to uuid references auth.users (id) on delete set null,
  add column response_stage text
    check (response_stage in ('Assigned', 'En route', 'On scene')),
  add column assigned_at timestamptz,
  add column resolution_note text
    check (resolution_note is null or char_length(trim(resolution_note)) <= 500),
  add column resolved_at timestamptz,
  add constraint incident_reports_coordinates_paired
    check ((latitude is null) = (longitude is null));

grant update (status, priority, assigned_to, response_stage, resolution_note)
  on table public.incident_reports to authenticated;

-- SOS reports skip admin review so they reach rescuers immediately.
drop policy "Citizens can submit pending incident reports" on public.incident_reports;

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
    and (
      (status = 'Pending' and report_type <> 'SOS')
      or (status = 'Verified' and report_type = 'SOS' and priority = 'Critical')
    )
  );

-- Rescuers may claim an unassigned verified call, move it through the response
-- stages and resolve it, but never take over a call another rescuer claimed.
drop policy "Rescuers can resolve verified incident reports" on public.incident_reports;

create policy "Rescuers can claim and progress verified reports"
  on public.incident_reports
  for update
  to authenticated
  using (
    status = 'Verified'
    and (assigned_to is null or assigned_to = (select auth.uid()))
    and public.current_user_role() = 'rescuer'
  )
  with check (
    status in ('Verified', 'Resolved')
    and assigned_to = (select auth.uid())
    and public.current_user_role() = 'rescuer'
  );

create function public.incident_reports_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() = 'rescuer' and new.priority is distinct from old.priority then
    raise exception 'Rescuers cannot change report priority.';
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    new.assigned_at := case when new.assigned_to is null then null else now() end;
    if new.assigned_to is not null and new.response_stage is null then
      new.response_stage := 'Assigned';
    end if;
  end if;

  if new.status = 'Resolved' and old.status is distinct from 'Resolved' then
    new.resolved_at := now();
  elsif new.status <> 'Resolved' then
    new.resolved_at := null;
  end if;

  return new;
end;
$$;

revoke all on function public.incident_reports_before_update() from public;

create trigger incident_reports_before_update
  before update on public.incident_reports
  for each row execute procedure public.incident_reports_before_update();

-- Basic spam protection: at most 5 reports per person every 10 minutes.
create function public.limit_incident_report_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*)
    from public.incident_reports
    where reporter_id = new.reporter_id
      and created_at > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'You have sent several reports in the last few minutes. Please wait a moment before sending another.';
  end if;
  return new;
end;
$$;

revoke all on function public.limit_incident_report_rate() from public;

create trigger incident_reports_rate_limit
  before insert on public.incident_reports
  for each row execute procedure public.limit_incident_report_rate();

-- ---------------------------------------------------------------------------
-- Activity log, written by trigger so it cannot be skipped or forged.
-- ---------------------------------------------------------------------------
create table public.report_events (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.incident_reports (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index report_events_report_id_idx on public.report_events (report_id, created_at desc);

alter table public.report_events enable row level security;

revoke all on table public.report_events from anon, authenticated;
grant select on table public.report_events to authenticated;

create policy "Admins can read the report activity log"
  on public.report_events
  for select
  to authenticated
  using (public.current_user_role() = 'admin');

create function public.log_incident_report_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.report_events (report_id, actor_id, action, detail)
    values (new.id, actor, case when new.report_type = 'SOS' then 'SOS sent' else 'Submitted' end, new.report_type);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.report_events (report_id, actor_id, action, detail)
    values (new.id, actor, new.status, new.resolution_note);
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.report_events (report_id, actor_id, action, detail)
    values (new.id, actor, case when new.assigned_to is null then 'Unassigned' else 'Assigned' end, new.assigned_to::text);
  end if;
  if new.response_stage is distinct from old.response_stage and new.response_stage in ('En route', 'On scene') then
    insert into public.report_events (report_id, actor_id, action)
    values (new.id, actor, new.response_stage);
  end if;
  if new.priority is distinct from old.priority then
    insert into public.report_events (report_id, actor_id, action, detail)
    values (new.id, actor, 'Priority changed', old.priority || ' → ' || new.priority);
  end if;
  return new;
end;
$$;

revoke all on function public.log_incident_report_event() from public;

create trigger incident_reports_log_event
  after insert or update on public.incident_reports
  for each row execute procedure public.log_incident_report_event();

-- ---------------------------------------------------------------------------
-- Evacuation centers
-- ---------------------------------------------------------------------------
create table public.evacuation_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  location text not null check (char_length(trim(location)) between 2 and 160),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  capacity integer not null check (capacity between 1 and 100000),
  occupants integer not null default 0 check (occupants >= 0),
  is_open boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint evacuation_centers_occupants_within_capacity check (occupants <= capacity),
  constraint evacuation_centers_coordinates_paired check ((latitude is null) = (longitude is null))
);

alter table public.evacuation_centers enable row level security;

revoke all on table public.evacuation_centers from anon, authenticated;
grant select, insert, update, delete on table public.evacuation_centers to authenticated;

create policy "Signed-in users can read evacuation centers"
  on public.evacuation_centers
  for select
  to authenticated
  using (true);

create policy "Admins can add evacuation centers"
  on public.evacuation_centers
  for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

create policy "Admins can update evacuation centers"
  on public.evacuation_centers
  for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "Admins can delete evacuation centers"
  on public.evacuation_centers
  for delete
  to authenticated
  using (public.current_user_role() = 'admin');

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger evacuation_centers_touch_updated_at
  before update on public.evacuation_centers
  for each row execute procedure public.touch_updated_at();

insert into public.evacuation_centers (name, location, latitude, longitude, capacity, occupants) values
  ('Catmon Elementary School', 'Catmon, Santa Maria', 14.8478, 120.9952, 600, 480),
  ('San Miguel High School', 'San Miguel, Santa Maria', 14.8312, 120.9781, 420, 112),
  ('Poblacion Covered Court', 'Poblacion, Santa Maria', 14.8215, 120.9603, 300, 220);

-- ---------------------------------------------------------------------------
-- Map points (danger zones, closed roads, other info)
-- ---------------------------------------------------------------------------
create table public.map_points (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  point_type text not null check (point_type in ('Danger zone', 'Closed road', 'Other info')),
  severity text not null default 'High' check (severity in ('High', 'Medium', 'Low')),
  description text check (description is null or char_length(trim(description)) <= 300),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.map_points enable row level security;

revoke all on table public.map_points from anon, authenticated;
grant select, insert, update, delete on table public.map_points to authenticated;

create policy "Signed-in users can read map points"
  on public.map_points
  for select
  to authenticated
  using (true);

create policy "Admins can add map points"
  on public.map_points
  for insert
  to authenticated
  with check (public.current_user_role() = 'admin');

create policy "Admins can update map points"
  on public.map_points
  for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "Admins can delete map points"
  on public.map_points
  for delete
  to authenticated
  using (public.current_user_role() = 'admin');

insert into public.map_points (name, point_type, severity, description, latitude, longitude, created_by) values
  ('Flood risk', 'Danger zone', 'High', 'Low-lying road near Tungkong Mangga Rd floods quickly.', 14.846, 120.995, null),
  ('Landslide watch', 'Danger zone', 'High', 'Heavy rain has raised slope movement risk near the ridge.', 14.858, 120.972, null),
  ('Power outage', 'Other info', 'Medium', 'Temporary outage affecting the east side of Poblacion.', 14.833, 120.982, null),
  ('Closed road', 'Closed road', 'Medium', 'Road closed for clearing operations.', 14.85, 120.974, null);

-- ---------------------------------------------------------------------------
-- Safety check-ins ("I'm safe")
-- ---------------------------------------------------------------------------
create table public.safety_checkins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null check (status in ('Safe', 'Need help')),
  note text check (note is null or char_length(trim(note)) <= 200),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  updated_at timestamptz not null default now()
);

alter table public.safety_checkins enable row level security;

revoke all on table public.safety_checkins from anon, authenticated;
grant select, insert, update on table public.safety_checkins to authenticated;

create policy "Users can read their own check-in"
  on public.safety_checkins
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Staff can read all check-ins"
  on public.safety_checkins
  for select
  to authenticated
  using (public.current_user_role() in ('rescuer', 'admin'));

create policy "Users can create their own check-in"
  on public.safety_checkins
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own check-in"
  on public.safety_checkins
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger safety_checkins_touch_updated_at
  before update on public.safety_checkins
  for each row execute procedure public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Rescuer live locations
-- ---------------------------------------------------------------------------
create table public.rescuer_locations (
  rescuer_id uuid primary key references auth.users (id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m real check (accuracy_m is null or accuracy_m >= 0),
  updated_at timestamptz not null default now()
);

alter table public.rescuer_locations enable row level security;

revoke all on table public.rescuer_locations from anon, authenticated;
grant select, insert, update, delete on table public.rescuer_locations to authenticated;

create policy "Rescuers can read their own location"
  on public.rescuer_locations
  for select
  to authenticated
  using (rescuer_id = (select auth.uid()));

create policy "Admins can read all rescuer locations"
  on public.rescuer_locations
  for select
  to authenticated
  using (public.current_user_role() = 'admin');

create policy "Rescuers can share their location"
  on public.rescuer_locations
  for insert
  to authenticated
  with check (rescuer_id = (select auth.uid()) and public.current_user_role() = 'rescuer');

create policy "Rescuers can update their location"
  on public.rescuer_locations
  for update
  to authenticated
  using (rescuer_id = (select auth.uid()))
  with check (rescuer_id = (select auth.uid()) and public.current_user_role() = 'rescuer');

create policy "Rescuers can stop sharing their location"
  on public.rescuer_locations
  for delete
  to authenticated
  using (rescuer_id = (select auth.uid()));

create trigger rescuer_locations_touch_updated_at
  before update on public.rescuer_locations
  for each row execute procedure public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Alerts: barangay targeting and expiry
-- ---------------------------------------------------------------------------
alter table public.alerts
  add column barangays text[]
    check (barangays is null or cardinality(barangays) between 1 and 50),
  add column expires_at timestamptz,
  add constraint alerts_expiry_after_creation check (expires_at is null or expires_at > created_at);

-- ---------------------------------------------------------------------------
-- Report photos (private bucket, 5 MB images)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Citizens can upload report photos to their own folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Reporters and staff can view report photos"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'report-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.current_user_role() in ('rescuer', 'admin')
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime (row level security still applies to every change event)
-- ---------------------------------------------------------------------------
-- Include previous values in update events so screens can tell what changed
-- (for example, a report moving from Pending to Verified).
alter table public.incident_reports replica identity full;

alter publication supabase_realtime add table
  public.incident_reports,
  public.alerts,
  public.evacuation_centers,
  public.map_points,
  public.rescuer_locations;
