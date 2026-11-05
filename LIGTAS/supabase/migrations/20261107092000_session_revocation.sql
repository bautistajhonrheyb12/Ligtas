-- Instant sign-out: a token stops working as soon as its session ends.
-- Supabase sign-in tokens stay valid until they expire, even after signing out.
-- Every token names its session (the session_id claim), so the role check now
-- also requires that session to still exist. Signing out, or an admin ending
-- someone's sessions, then takes away the token's powers immediately: a stolen
-- token is as good as blacklisted.
-- Requires 20261107091000_report_integrity.sql.

-- Stop early, with a clear message, if this project's database cannot read or
-- end sign-in sessions (nothing below is applied then).
do $$
begin
  if not has_table_privilege('auth.sessions', 'SELECT') or not has_table_privilege('auth.sessions', 'DELETE') then
    raise exception 'This database role cannot read and end sign-in sessions (auth.sessions), so instant sign-out cannot be set up.';
  end if;
end;
$$;

-- Every policy and function that checks roles goes through this helper.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.role = 'admin' and coalesce((select auth.jwt()) ->> 'aal', '') <> 'aal2' then 'admin-unverified'
    else p.role
  end
  from public.profiles p
  where p.id = (select auth.uid())
    and exists (
      select 1
      from auth.sessions s
      where s.id = nullif((select auth.jwt()) ->> 'session_id', '')::uuid
        and s.user_id = p.id
    )
$$;

-- The first rescuer policy checked the profiles table directly, so it would
-- have skipped the session check. Rebuild it on the shared helper.
drop policy "Rescuers can read verified and resolved incident reports" on public.incident_reports;

create policy "Rescuers can read verified and resolved incident reports"
  on public.incident_reports
  for select
  to authenticated
  using (
    status in ('Verified', 'Resolved')
    and public.current_user_role() = 'rescuer'
  );

-- Admins end every session of an account: for a lost phone, a suspected stolen
-- login, or someone leaving the team. The person has to sign in again.
create function public.end_user_sessions(target_user uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ended integer;
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Only admins can sign other people out.';
  end if;

  delete from auth.sessions where user_id = target_user;
  get diagnostics ended = row_count;
  return ended;
end;
$$;

revoke all on function public.end_user_sessions(uuid) from public;
grant execute on function public.end_user_sessions(uuid) to authenticated;

-- Deactivating a rescuer now also signs them out everywhere, so an open
-- rescuer screen cannot keep acting as a rescuer.
create or replace function public.deactivate_rescuer(rescuer_id uuid)
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

  delete from auth.sessions where user_id = rescuer_id;
end;
$$;
