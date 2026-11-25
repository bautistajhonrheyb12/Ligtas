-- Evacuation centers: official or temporary, what kind of facility, and how sure
-- we are of each one's capacity and map location.
--
-- classification   official  = a designated evacuation center (in the inventory
--                              as Permanent)
--                  temporary = a site used to shelter evacuees when needed
--                              (courts, chapels, schools, halls)
-- capacity_status  documented = capacity is an official figure
--                  estimated  = capacity to capacity_max is an estimate (such as
--                               the MDRRMO's 100–150 people for a covered court)
--                  unverified = nobody has established it yet (no number shown)
-- location_status  confirmed   = the pin was checked to be on the building
--                  unconfirmed = the pin is on the building as identified from
--                                map data or by an admin, not yet checked on site
--                  unknown     = no pin yet; the center is listed by address only
-- suggested_latitude / suggested_longitude: a possible spot found in map data
--                  but not confirmed; shown to admins only, never on the map.
-- verification_notes: what still needs checking (for admins).
--
-- Existing centers keep working: their capacity counts as documented (it was
-- entered as an exact number) and a pin they already have counts as unconfirmed.

alter table public.evacuation_centers
  add column if not exists classification text not null default 'temporary',
  add column if not exists facility_type text not null default 'other',
  add column if not exists barangay text,
  add column if not exists contact_numbers text,
  add column if not exists capacity_status text not null default 'documented',
  add column if not exists capacity_max integer,
  add column if not exists capacity_source text,
  add column if not exists location_status text not null default 'unknown',
  add column if not exists location_source text,
  add column if not exists source text,
  add column if not exists remarks text,
  add column if not exists verification_notes text,
  add column if not exists suggested_latitude double precision,
  add column if not exists suggested_longitude double precision;

update public.evacuation_centers
  set location_status = case when latitude is null then 'unknown' else 'unconfirmed' end;

-- Capacity can now be unknown, or a range; occupants may not go past the top of it.
alter table public.evacuation_centers alter column capacity drop not null;
alter table public.evacuation_centers drop constraint if exists evacuation_centers_occupants_within_capacity;

alter table public.evacuation_centers
  add constraint evacuation_centers_classification_check
    check (classification in ('official', 'temporary')),
  add constraint evacuation_centers_facility_type_check
    check (facility_type in ('evacuation_center', 'covered_court', 'school', 'chapel', 'barangay_hall', 'other')),
  add constraint evacuation_centers_barangay_check
    check (barangay is null or barangay in (
      'Bagbaguin', 'Balasing', 'Buenavista', 'Bulac', 'Camangyanan', 'Catmon', 'Caypombo', 'Caysio',
      'Guyong', 'Lalakhan', 'Mag-asawang Sapa', 'Mahabang Parang', 'Manggahan', 'Parada', 'Poblacion',
      'Pulong Buhangin', 'San Gabriel', 'San Jose Patag', 'San Vicente', 'Santa Clara', 'Santa Cruz',
      'Santo Tomas', 'Silangan', 'Tumana'
    )),
  add constraint evacuation_centers_capacity_status_check
    check (
      (capacity_status = 'documented' and capacity is not null and capacity_max is null)
      or (capacity_status = 'estimated' and capacity is not null and capacity_max is not null and capacity_max >= capacity)
      or (capacity_status = 'unverified' and capacity is null and capacity_max is null)
    ),
  add constraint evacuation_centers_capacity_max_check
    check (capacity_max is null or capacity_max between 1 and 100000),
  add constraint evacuation_centers_occupants_within_capacity
    check (occupants <= coalesce(capacity_max, capacity, 100000)),
  add constraint evacuation_centers_location_status_check
    check (location_status in ('confirmed', 'unconfirmed', 'unknown') and ((location_status = 'unknown') = (latitude is null))),
  add constraint evacuation_centers_text_lengths
    check (
      (contact_numbers is null or char_length(contact_numbers) <= 120)
      and (capacity_source is null or char_length(capacity_source) <= 200)
      and (location_source is null or char_length(location_source) <= 200)
      and (source is null or char_length(source) <= 200)
      and (remarks is null or char_length(remarks) <= 600)
      and (verification_notes is null or char_length(verification_notes) <= 800)
    ),
  add constraint evacuation_centers_suggested_spot_check
    check (
      (suggested_latitude is null) = (suggested_longitude is null)
      and (suggested_latitude is null or (suggested_latitude between -90 and 90 and suggested_longitude between -180 and 180))
    );

-- Tidies the text, and keeps the location status in step with the pin: removing
-- the pin makes it unknown; a new pin is unconfirmed until someone confirms it.
create or replace function public.evacuation_centers_prepare()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := public.clean_text(new.name);
  new.location := public.clean_text(new.location);
  new.contact_numbers := nullif(public.clean_text(new.contact_numbers), '');
  new.capacity_source := nullif(public.clean_text(new.capacity_source), '');
  new.location_source := nullif(public.clean_text(new.location_source), '');
  new.source := nullif(public.clean_text(new.source), '');
  new.remarks := nullif(public.clean_text(new.remarks), '');
  new.verification_notes := nullif(public.clean_text(new.verification_notes), '');
  if new.latitude is null then
    new.location_status := 'unknown';
  elsif new.location_status = 'unknown' then
    new.location_status := 'unconfirmed';
  end if;
  return new;
end;
$$;

revoke all on function public.evacuation_centers_prepare() from public;

drop trigger if exists evacuation_centers_prepare on public.evacuation_centers;
create trigger evacuation_centers_prepare
  before insert or update on public.evacuation_centers
  for each row execute procedure public.evacuation_centers_prepare();

-- One record per facility: the same name in the same barangay is refused,
-- ignoring case, spaces and punctuation ("Sta. Cruz Highschool" and
-- "sta cruz high school" are the same). Different facilities that share a
-- generic name ("Covered Court") in different barangays are fine.
create unique index if not exists evacuation_centers_one_per_facility
  on public.evacuation_centers (regexp_replace(lower(name), '[^a-z0-9]+', '', 'g'), coalesce(barangay, ''));
