-- Alerts: say what an "Other" alert is about, and keep end times sensible.
--
-- alert_type stays one of the fixed types (Flood, Severe weather, Landslide,
-- Road closure, Other). When it is Other, alert_type_other says what it really
-- is, such as "Chemical spill"; the app and notifications show that instead.
-- Alerts sent before this change keep working (ending or deleting them is not
-- affected): the rules below only apply to new alerts.

alter table public.alerts
  add column if not exists alert_type_other text
    constraint alerts_type_other_check check (
      alert_type_other is null
      or (alert_type = 'Other' and char_length(trim(alert_type_other)) between 2 and 60)
    );

-- Cleaned like the rest of an alert's text.
create or replace function public.alerts_clean_text()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title := public.clean_text(new.title);
  new.message := public.clean_text(new.message);
  new.location := public.clean_text(new.location);
  new.alert_type_other := nullif(public.clean_text(new.alert_type_other), '');
  return new;
end;
$$;

-- Checked after the text is cleaned (triggers run in name order:
-- alerts_before_insert, alerts_clean_text, then this one).
create function public.alerts_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.alert_type = 'Other' and new.alert_type_other is null then
    raise exception 'Say what kind of alert this is (for example, Chemical spill).';
  end if;
  -- The end time must be after the alert is sent (a constraint already says
  -- so) and no more than 30 days ahead.
  if new.expires_at is not null and new.expires_at > now() + interval '30 days' then
    raise exception 'An alert can end at most 30 days from now. Choose an earlier end time.';
  end if;
  return new;
end;
$$;

revoke all on function public.alerts_validate() from public;

create trigger alerts_validate
  before insert on public.alerts
  for each row execute procedure public.alerts_validate();
