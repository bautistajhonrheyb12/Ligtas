-- Abuse limits: repeat offenders are paused, photo uploads are capped, and
-- hidden characters are stripped from text people type.
-- (Report and alert rate limits, the 5 MB photo limit and server-set times are
-- in earlier migrations. Supabase itself rejects any field a table does not
-- have, so unexpected JSON properties never reach the database.)
-- Requires 20261107092000_session_revocation.sql.

-- ---------------------------------------------------------------------------
-- Pause accounts with repeated location problems
-- ---------------------------------------------------------------------------
-- Three open security flags within a day pause ordinary reports until an admin
-- reviews the account and clears them. SOS is never paused.
create function public.incident_reports_account_pause()
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
    raise exception 'Reporting from this account is paused after repeated location problems. An admin will review it. In an emergency, use SOS or call 911.';
  end if;
  return new;
end;
$$;

revoke all on function public.incident_reports_account_pause() from public;

-- Named to run first among the report triggers (they run in name order).
create trigger incident_reports_account_pause
  before insert on public.incident_reports
  for each row execute procedure public.incident_reports_account_pause();

-- ---------------------------------------------------------------------------
-- Report photos: size, type and number of uploads
-- ---------------------------------------------------------------------------
-- Set again in case the bucket was changed in the dashboard.
update storage.buckets
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id = 'report-photos';

-- Photos this person uploaded in the last 10 minutes.
create function public.recent_photo_uploads()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from storage.objects
  where bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and created_at > now() - interval '10 minutes'
$$;

revoke all on function public.recent_photo_uploads() from public;
grant execute on function public.recent_photo_uploads() to authenticated;

-- At most 10 photos per person every 10 minutes (reports allow 5 in that time).
drop policy "Citizens can upload report photos to their own folder" on storage.objects;

create policy "Citizens can upload report photos to their own folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.recent_photo_uploads() < 10
  );

-- ---------------------------------------------------------------------------
-- Clean text
-- ---------------------------------------------------------------------------
-- Removes control characters (keeping tabs and line breaks) and the invisible
-- characters used to disguise text, such as right-to-left overrides that make
-- a message display differently from what it says.
create function public.clean_text(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(
    value,
    '[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F​‎‏‪-‮⁦-⁩﻿]',
    '',
    'g'
  ))
$$;

create function public.incident_reports_clean_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.location := public.clean_text(new.location);
  new.notes := public.clean_text(new.notes);
  return new;
end;
$$;

revoke all on function public.incident_reports_clean_text() from public;

create trigger incident_reports_clean_text
  before insert on public.incident_reports
  for each row execute procedure public.incident_reports_clean_text();

create function public.alerts_clean_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := public.clean_text(new.title);
  new.message := public.clean_text(new.message);
  new.location := public.clean_text(new.location);
  return new;
end;
$$;

revoke all on function public.alerts_clean_text() from public;

create trigger alerts_clean_text
  before insert on public.alerts
  for each row execute procedure public.alerts_clean_text();

-- Names appear on rescuer and admin screens, so they are cleaned too.
create function public.profiles_clean_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.display_name := nullif(public.clean_text(new.display_name), '');
  new.barangay := nullif(public.clean_text(new.barangay), '');
  return new;
end;
$$;

revoke all on function public.profiles_clean_text() from public;

create trigger profiles_clean_text
  before insert or update of display_name, barangay on public.profiles
  for each row execute procedure public.profiles_clean_text();
