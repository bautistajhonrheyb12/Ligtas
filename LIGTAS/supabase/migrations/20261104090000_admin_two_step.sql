-- Admin powers require two-step sign-in (an authenticator app code).
-- A password alone signs an admin in, but the database treats that session as
-- having no admin rights until the code is verified (JWT claim aal = 'aal2').
-- Requires 20261103090000_contacts_and_controls.sql.

-- Every policy and function that checks for admins goes through this helper,
-- so changing it here protects all of them at once.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when role = 'admin' and coalesce((select auth.jwt()) ->> 'aal', '') <> 'aal2' then 'admin-unverified'
    else role
  end
  from public.profiles
  where id = (select auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- The first migrations checked the profiles table directly. Rewrite those
-- policies to use the helper so they also require two-step sign-in.
-- ---------------------------------------------------------------------------
drop policy "Admins can read all incident reports" on public.incident_reports;

create policy "Admins can read all incident reports"
  on public.incident_reports
  for select
  to authenticated
  using (public.current_user_role() = 'admin');

drop policy "Admins can update incident report status" on public.incident_reports;

create policy "Admins can update incident report status"
  on public.incident_reports
  for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy "Users can read alerts for their role or alerts they created" on public.alerts;

create policy "Users can read alerts for their role or alerts they created"
  on public.alerts
  for select
  to authenticated
  using (
    public.current_user_role() = any (target_roles)
    or (
      created_by = (select auth.uid())
      and public.current_user_role() in ('admin', 'rescuer')
    )
  );

drop policy "Admins and rescuers can publish alerts" on public.alerts;

create policy "Admins and rescuers can publish alerts"
  on public.alerts
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      public.current_user_role() = 'admin'
      or (
        public.current_user_role() = 'rescuer'
        and target_roles <@ array['citizen', 'rescuer']::text[]
      )
    )
  );
