create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete cascade,
  alert_type text not null
    check (alert_type in ('Flood', 'Severe weather', 'Landslide', 'Road closure', 'Other')),
  severity text not null
    check (severity in ('Low', 'Moderate', 'High')),
  title text not null
    check (char_length(trim(title)) between 2 and 80),
  message text not null
    check (char_length(trim(message)) between 1 and 1000),
  location text not null
    check (char_length(trim(location)) between 2 and 160),
  target_roles text[] not null
    check (
      cardinality(target_roles) > 0
      and target_roles <@ array['citizen', 'rescuer', 'admin']::text[]
    ),
  created_at timestamptz not null default now()
);

alter table public.alerts enable row level security;

revoke all on table public.alerts from anon, authenticated;
grant select, insert on table public.alerts to authenticated;

create policy "Users can read alerts for their role or alerts they created"
  on public.alerts
  for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = any (target_roles)
    )
  );

create policy "Admins and rescuers can publish alerts"
  on public.alerts
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and (
          profiles.role = 'admin'
          or (
            profiles.role = 'rescuer'
            and target_roles <@ array['citizen', 'rescuer']::text[]
          )
        )
    )
  );
