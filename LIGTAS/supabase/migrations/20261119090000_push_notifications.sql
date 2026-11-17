-- Push notifications: alerts and report updates reach phones even when LIGTAS
-- is closed (Web Push).
--   * push_subscriptions: one row per phone (browser) that turned notifications
--     on. Each is tied to that phone's sign-in session, so a phone that signs
--     out, or is signed out by an admin, stops receiving notifications at once.
--   * New alerts and report changes call the send-push Edge Function (through
--     pg_net), which decides who to tell and sends the notifications.
--   * push_sent remembers what was already sent, so nothing is sent twice even
--     if the function is called again for the same event.
-- Requires 20261118090000_sos_live_location.sql.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------------
-- Only the push services of the major browsers. The send-push function posts
-- to these addresses, so it must never be pointed at any other server.
create function public.is_push_endpoint(url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select char_length(url) <= 1000
    and url ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com|[a-z0-9.-]+\.push\.apple\.com)/'
$$;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null,
  endpoint text not null unique check (public.is_push_endpoint(endpoint)),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{80,100}={0,2}$'),
  auth_secret text not null check (auth_secret ~ '^[A-Za-z0-9_-]{16,32}={0,2}$'),
  language text not null default 'en' check (language in ('en', 'tl')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- No direct access: the functions below are the only way in.
alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;

-- Saves this phone's subscription for the person signed in on it. A phone
-- that was used by someone else before moves to the new person.
create function public.save_push_subscription(push_endpoint text, push_p256dh text, push_auth text, push_language text default 'en')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  my_session uuid := nullif((select auth.jwt()) ->> 'session_id', '')::uuid;
begin
  if me is null or my_session is null
     or coalesce(public.current_user_role(), '') not in ('citizen', 'rescuer', 'admin') then
    raise exception 'Sign in again to turn on notifications.';
  end if;
  if not coalesce(public.is_push_endpoint(push_endpoint), false) then
    raise exception 'This browser''s notification service is not supported. Use Chrome, Edge, Firefox or Safari.';
  end if;

  insert into public.push_subscriptions (user_id, session_id, endpoint, p256dh, auth_secret, language)
  values (me, my_session, push_endpoint, push_p256dh, push_auth, coalesce(push_language, 'en'))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        session_id = excluded.session_id,
        p256dh = excluded.p256dh,
        auth_secret = excluded.auth_secret,
        language = excluded.language,
        updated_at = now();

  -- Phones that have signed out no longer count, and one person keeps at most
  -- 10 phones.
  delete from public.push_subscriptions s
  where s.user_id = me
    and (
      not exists (select 1 from auth.sessions x where x.id = s.session_id)
      or s.id in (
        select k.id from public.push_subscriptions k
        where k.user_id = me
        order by k.updated_at desc
        offset 10
      )
    );
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

create function public.remove_push_subscription(push_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions
  where endpoint = push_endpoint
    and user_id = (select auth.uid());
$$;

revoke all on function public.remove_push_subscription(text) from public;
grant execute on function public.remove_push_subscription(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Used by the send-push function only (service role)
-- ---------------------------------------------------------------------------
-- The phones to notify: people with one of the roles (citizens only in the
-- given barangays, when there are any) and the people listed, skipping the
-- person who caused the event. Only phones whose sign-in is still active.
create function public.push_subscribers(
  target_roles text[] default '{}',
  target_users uuid[] default '{}',
  target_barangays text[] default null,
  skip_user uuid default null
)
returns table (sub_id uuid, sub_user uuid, sub_role text, endpoint text, p256dh text, auth_secret text, language text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.user_id, p.role, s.endpoint, s.p256dh, s.auth_secret, s.language
  from public.push_subscriptions s
  join public.profiles p on p.id = s.user_id
  where exists (select 1 from auth.sessions x where x.id = s.session_id and x.user_id = s.user_id)
    and (skip_user is null or s.user_id <> skip_user)
    and (
      s.user_id = any (coalesce(target_users, '{}'))
      or (
        p.role = any (coalesce(target_roles, '{}'))
        and (
          p.role <> 'citizen'
          or coalesce(cardinality(target_barangays), 0) = 0
          or lower(trim(coalesce(p.barangay, ''))) in (select lower(trim(b)) from unnest(target_barangays) b)
        )
      )
    )
$$;

revoke all on function public.push_subscribers(text[], uuid[], text[], uuid) from public;
grant execute on function public.push_subscribers(text[], uuid[], text[], uuid) to service_role;

-- What has been sent (kept for a week).
create table public.push_sent (
  event_key text primary key check (char_length(event_key) <= 120),
  sent_at timestamptz not null default now()
);

alter table public.push_sent enable row level security;
revoke all on table public.push_sent from anon, authenticated;

-- True the first time an event is claimed, false every time after. Also
-- tidies up: old claims, and the subscriptions of phones that signed out.
create function public.push_claim(claim_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.push_sent where sent_at < now() - interval '7 days';
  delete from public.push_subscriptions s
  where not exists (select 1 from auth.sessions x where x.id = s.session_id);
  insert into public.push_sent (event_key) values (claim_key) on conflict do nothing;
  return found;
end;
$$;

revoke all on function public.push_claim(text) from public;
grant execute on function public.push_claim(text) to service_role;

-- ---------------------------------------------------------------------------
-- Calling the send-push function when something happens
-- ---------------------------------------------------------------------------
-- Where the function lives. Replace this function if the project moves.
create function public.push_function_url()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'https://bjpkhgfdymancqzsytlf.supabase.co/functions/v1/send-push'
$$;

-- The request is queued and sent after the change is saved. A problem with
-- notifications never stops an alert or report from being saved.
create function public.request_push(kind text, ref text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := public.push_function_url(),
    body := jsonb_build_object('type', kind, 'id', ref),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );
exception when others then
  raise warning 'LIGTAS could not request push notifications: %', sqlerrm;
end;
$$;

revoke all on function public.request_push(text, text) from public;

create function public.alerts_request_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.request_push('alert', new.id::text);
  return new;
end;
$$;

revoke all on function public.alerts_request_push() from public;

create trigger alerts_request_push
  after insert on public.alerts
  for each row execute procedure public.alerts_request_push();

-- Report changes are already logged in report_events; the ones people need to
-- hear about are sent on.
create function public.report_events_request_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.action in ('SOS sent', 'Submitted', 'Verified', 'Rejected', 'Resolved', 'Assigned', 'Unassigned', 'En route', 'On scene') then
    perform public.request_push('report_event', new.id::text);
  end if;
  return new;
end;
$$;

revoke all on function public.report_events_request_push() from public;

create trigger report_events_request_push
  after insert on public.report_events
  for each row execute procedure public.report_events_request_push();
