-- Where rescuers should go, as accurately as the phone can tell:
--   * location_accuracy: how accurate a report's GPS position was, in metres
--     (shown to rescuers as a search radius);
--   * live_*: for an open SOS, the person's latest position, sent by their
--     phone while LIGTAS stays open, so rescuers go where the person is now
--     and not only where they were when they pressed SOS.
-- The original position stays exactly as sent: it is part of the report's
-- signature (report-integrity), so the live position is kept apart from it.

alter table public.incident_reports
  add column location_accuracy integer
    check (location_accuracy is null or location_accuracy between 0 and 5000),
  add column live_latitude double precision check (live_latitude between -90 and 90),
  add column live_longitude double precision check (live_longitude between -180 and 180),
  add column live_accuracy integer
    check (live_accuracy is null or live_accuracy between 0 and 5000),
  add column live_updated_at timestamptz;

-- A new report never arrives with a live position, and only a GPS position
-- has an accuracy.
create function public.incident_reports_location_extras()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.live_latitude := null;
  new.live_longitude := null;
  new.live_accuracy := null;
  new.live_updated_at := null;
  if new.latitude is null or new.location_source is distinct from 'gps' then
    new.location_accuracy := null;
  end if;
  return new;
end;
$$;

revoke all on function public.incident_reports_location_extras() from public;

create trigger incident_reports_location_extras
  before insert on public.incident_reports
  for each row execute procedure public.incident_reports_location_extras();

-- The person who sent an open SOS shares their latest position. Returns true
-- when it was saved, false when it came too soon after the last one (at most
-- one every 10 seconds). Positions outside Santa Maria, or impossibly far from
-- the last one, are refused. Live sharing ends when the SOS is resolved or
-- closed, or 6 hours after it was sent.
create function public.share_sos_location(sos_id uuid, lat double precision, lng double precision, accuracy_m double precision default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  sos public.incident_reports;
  from_lat double precision;
  from_lng double precision;
  from_at timestamptz;
  hours double precision;
begin
  select * into sos from public.incident_reports where id = sos_id;
  if sos.id is null or sos.reporter_id is distinct from (select auth.uid()) then
    raise exception 'This is not your SOS.';
  end if;
  if public.current_user_role() is distinct from 'citizen' then
    raise exception 'Sign in again to share your location.';
  end if;
  if sos.report_type <> 'SOS' or sos.status <> 'Verified' then
    raise exception 'This SOS is no longer open.';
  end if;
  if sos.created_at < now() - interval '6 hours' then
    raise exception 'Live location stops 6 hours after an SOS.';
  end if;
  if lat is null or lng is null or not public.inside_santa_maria(lat, lng) then
    raise exception 'This position is outside Santa Maria.';
  end if;
  if sos.live_updated_at is not null and sos.live_updated_at > now() - interval '10 seconds' then
    return false;
  end if;

  -- No faster than 150 km/h from the last known position (ignoring hops under
  -- 3 km, as the report location check does).
  from_lat := coalesce(sos.live_latitude, sos.latitude);
  from_lng := coalesce(sos.live_longitude, sos.longitude);
  from_at := coalesce(sos.live_updated_at, sos.created_at);
  if from_lat is not null then
    hours := greatest(extract(epoch from now() - from_at) / 3600, 0);
    if public.distance_km(from_lat, from_lng, lat, lng) > greatest(3, 150 * hours) then
      raise exception 'This position is too far from your last one.';
    end if;
  end if;

  update public.incident_reports
    set live_latitude = lat,
        live_longitude = lng,
        live_accuracy = case when accuracy_m between 0 and 5000 then round(accuracy_m)::integer end,
        live_updated_at = now()
    where id = sos_id;
  return true;
end;
$$;

revoke all on function public.share_sos_location(uuid, double precision, double precision, double precision) from public;
grant execute on function public.share_sos_location(uuid, double precision, double precision, double precision) to authenticated;
