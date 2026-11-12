-- Database messages point to Santa Maria's MDRRMO Rescue hotline instead of 911.
-- Only the message text changes; both functions work exactly as before.
-- Requires 20261107093000_abuse_limits.sql.

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
      raise exception 'Your SOS has already been sent and rescuers have it. If you can, call MDRRMO Rescue at 0923 022 6973 now.';
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

create or replace function public.incident_reports_account_pause()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.report_type <> 'SOS' and (
    select count(*)
    from public.security_flags
    where user_id = new.reporter_id
      and cleared_at is null
      and created_at > now() - interval '24 hours'
  ) >= 3 then
    raise exception 'Reporting from this account is paused after repeated location problems. An administrator will review it. In an emergency, use SOS or call MDRRMO Rescue at 0923 022 6973.';
  end if;
  return new;
end;
$$;

revoke all on function public.incident_reports_account_pause() from public;
