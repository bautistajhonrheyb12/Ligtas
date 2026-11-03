create policy "Rescuers can read verified and resolved incident reports"
  on public.incident_reports
  for select
  to authenticated
  using (
    status in ('Verified', 'Resolved')
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'rescuer'
    )
  );

create policy "Rescuers can resolve verified incident reports"
  on public.incident_reports
  for update
  to authenticated
  using (
    status = 'Verified'
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'rescuer'
    )
  )
  with check (
    status = 'Resolved'
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'rescuer'
    )
  );
