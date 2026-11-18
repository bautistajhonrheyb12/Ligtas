-- Stricter limits on ordinary reports, against spam and trolling. Per person:
--   * at most 3 reports waiting for review at once: an admin checking one
--     (verifying or rejecting it) frees a place;
--   * at most 3 reports in 10 minutes (was 5);
--   * at most 10 reports in 24 hours.
-- Withdrawn reports still count toward the 10-minute and 24-hour limits, so
-- sending and withdrawing cannot be used to get around them.
-- SOS keeps its own limit (3 in 10 minutes) and is never blocked by these.
-- The app checks the same limits before showing the report form
-- (src/lib/limits.js); keep the numbers in step.
-- Requires 20261113090000_local_emergency_messages.sql.

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
    return new;
  end if;

  if (
    select count(*)
    from public.incident_reports
    where reporter_id = new.reporter_id
      and report_type <> 'SOS'
      and status = 'Pending'
  ) >= 3 then
    raise exception 'You already have 3 reports waiting for review. You can send another once an administrator checks one of them. In an emergency, use SOS or call MDRRMO Rescue at 0923 022 6973.';
  end if;

  if (
    select count(*)
    from public.incident_reports
    where reporter_id = new.reporter_id
      and report_type <> 'SOS'
      and created_at > now() - interval '10 minutes'
  ) >= 3 then
    raise exception 'You have sent 3 reports in the last 10 minutes. Please wait a few minutes before sending another. In an emergency, use SOS or call MDRRMO Rescue at 0923 022 6973.';
  end if;

  if (
    select count(*)
    from public.incident_reports
    where reporter_id = new.reporter_id
      and report_type <> 'SOS'
      and created_at > now() - interval '24 hours'
  ) >= 10 then
    raise exception 'You have sent 10 reports in the last 24 hours, the most allowed in one day. In an emergency, use SOS or call MDRRMO Rescue at 0923 022 6973.';
  end if;

  return new;
end;
$$;

revoke all on function public.limit_incident_report_rate() from public;
