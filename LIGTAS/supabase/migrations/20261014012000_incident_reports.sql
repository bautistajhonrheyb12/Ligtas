create table public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  report_type text not null
    check (report_type in ('Flooding', 'Blocked road', 'Fallen tree', 'Power outage')),
  location text not null
    check (char_length(trim(location)) between 2 and 160),
  notes text not null
    check (char_length(trim(notes)) between 1 and 1000),
  status text not null default 'Pending'
    check (status in ('Pending', 'Verified', 'Resolved', 'Rejected')),
  created_at timestamptz not null default now()
);

alter table public.incident_reports enable row level security;

revoke all on table public.incident_reports from anon, authenticated;
grant select, insert on table public.incident_reports to authenticated;
grant update (status) on table public.incident_reports to authenticated;

create policy "Citizens can submit pending incident reports"
  on public.incident_reports
  for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status = 'Pending'
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'citizen'
    )
  );

create policy "Users can read their own incident reports"
  on public.incident_reports
  for select
  to authenticated
  using (reporter_id = (select auth.uid()));

create policy "Admins can read all incident reports"
  on public.incident_reports
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

create policy "Admins can update incident report status"
  on public.incident_reports
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );
