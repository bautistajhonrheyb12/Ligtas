-- Citizen interface fixes (Nov 2026): report categories, "Others" reports,
-- "Other info" map points, and the sample map points from the first setup.
--
-- 1. Report categories. Residents now choose from: Flooding, Fire, Vehicular
--    accident, Medical emergency, Rescue / trapped, Road obstruction, Downed
--    power line, Others. "Medical" and "Blocked road" keep their stored names
--    (the app shows them as Medical Emergency and Road Obstruction); three
--    values are new. The older values stay allowed, so past reports keep the
--    category they were sent with. Nothing is reclassified.
-- 2. report_type_other: what an "Others" report is about ("Gas leak"). The
--    app requires it; the database checks its shape and cleans it like the
--    rest of a report's text. Reports sent before this change are untouched.
-- 3. An "Other info" map point must say what it is about (its description).
--    Checked on new points only, so existing points can still be edited.
-- 4. The 4 sample map points added by 20261102090000_field_operations.sql
--    (no creator, the exact sample names, places and text) are removed. Points
--    an admin added are never touched.
--
-- Running it again changes nothing.

begin;

-- 1. Categories
alter table public.incident_reports
  drop constraint if exists incident_reports_report_type_check;

alter table public.incident_reports
  add constraint incident_reports_report_type_check
    check (report_type in (
      'Flooding', 'Fire', 'Vehicular accident', 'Medical', 'Rescue',
      'Blocked road', 'Downed power line', 'Other', 'SOS',
      -- No longer offered; kept for reports sent before.
      'Fallen tree', 'Power outage', 'Landslide'
    ));

-- 2. What an "Others" report is about
alter table public.incident_reports
  add column if not exists report_type_other text;

alter table public.incident_reports
  drop constraint if exists incident_reports_type_other_check;

alter table public.incident_reports
  add constraint incident_reports_type_other_check check (
    report_type_other is null
    or (report_type = 'Other' and char_length(report_type_other) between 2 and 60)
  );

-- Cleaned like the location and notes (the same function, one more field).
create or replace function public.incident_reports_clean_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.location := public.clean_text(new.location);
  new.notes := public.clean_text(new.notes);
  new.report_type_other := nullif(public.clean_text(new.report_type_other), '');
  return new;
end;
$$;

revoke all on function public.incident_reports_clean_text() from public;

-- 3. "Other info" points say what they are about
create or replace function public.map_points_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.point_type = 'Other info' and char_length(btrim(coalesce(new.description, ''))) < 3 then
    raise exception 'Say what this point is about in "Other, please specify".';
  end if;
  return new;
end;
$$;

revoke all on function public.map_points_validate() from public;

drop trigger if exists map_points_validate on public.map_points;
create trigger map_points_validate
  before insert on public.map_points
  for each row execute procedure public.map_points_validate();

-- 4. The sample points (exact match only)
delete from public.map_points
where created_by is null
  and (name, point_type, severity, description, latitude, longitude) in (
    ('Flood risk', 'Danger zone', 'High', 'Low-lying road near Tungkong Mangga Rd floods quickly.', 14.846, 120.995),
    ('Landslide watch', 'Danger zone', 'High', 'Heavy rain has raised slope movement risk near the ridge.', 14.858, 120.972),
    ('Power outage', 'Other info', 'Medium', 'Temporary outage affecting the east side of Poblacion.', 14.833, 120.982),
    ('Closed road', 'Closed road', 'Medium', 'Road closed for clearing operations.', 14.85, 120.974)
  );

commit;
