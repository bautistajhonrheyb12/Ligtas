-- Family safety: citizens link their accounts into a family with a code and
-- see each other's safety, with a notification when one of them sends an SOS,
-- needs help or marks themselves safe.
--   * One person starts a family and shares its 8-character code; relatives
--     enter it on their own phones. At most 12 people; one family per person.
--   * Family members see each other's name, barangay, safety check-in and
--     whether an SOS was sent in the last 24 hours and how the response is
--     going. Never locations, report details or phone numbers.
--   * Anyone can leave at any time. The person who started the family can
--     remove members and replace the code (so an old code stops working).
-- All access goes through the functions below; the tables are not readable.
-- Requires 20261119110000_report_limits.sql.

create table public.families (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  owner_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.family_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  joined_at timestamptz not null default now()
);

create index family_members_family_idx on public.family_members (family_id);

-- Wrong codes are counted, so codes cannot be guessed.
create table public.family_join_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index family_join_attempts_user_idx on public.family_join_attempts (user_id, attempted_at desc);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_join_attempts enable row level security;
revoke all on table public.families, public.family_members, public.family_join_attempts from anon, authenticated;

-- An 8-character code without look-alike characters (no 0/O or 1/I), made
-- from random bytes: 32 symbols, about 10^12 possible codes.
create function public.make_family_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', get_byte(r.bytes, i.n) % 32 + 1, 1), '' order by i.n)
  from (select decode(replace(gen_random_uuid()::text, '-', ''), 'hex') as bytes) r,
       unnest(array[0, 1, 2, 3, 4, 5, 10, 11]) as i(n)
$$;

revoke all on function public.make_family_code() from public;

-- Only signed-in citizens use family safety.
create function public.family_caller()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(public.current_user_role(), '') <> 'citizen' then
    raise exception 'Sign in with your citizen account to use family safety.';
  end if;
  return (select auth.uid());
end;
$$;

revoke all on function public.family_caller() from public;

-- The caller's family: its code, whether they started it, and each member's
-- safety. Null when the caller is not in a family.
create function public.my_family()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public.family_caller();
  fam public.families;
begin
  select f.* into fam
  from public.families f
  join public.family_members m on m.family_id = f.id
  where m.user_id = me;
  if fam.id is null then
    return null;
  end if;

  return jsonb_build_object(
    'code', fam.code,
    'is_owner', fam.owner_id = me,
    'members', (
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'name', nullif(trim(p.display_name), ''),
        'barangay', nullif(trim(p.barangay), ''),
        'is_me', m.user_id = me,
        'is_owner', m.user_id = fam.owner_id,
        'status', c.status,
        'status_at', c.updated_at,
        'sos_at', s.created_at,
        'sos_status', s.status,
        'sos_stage', s.response_stage
      ) order by m.joined_at)
      from public.family_members m
      join public.profiles p on p.id = m.user_id
      left join public.safety_checkins c on c.user_id = m.user_id
      left join lateral (
        select r.created_at, r.status, r.response_stage
        from public.incident_reports r
        where r.reporter_id = m.user_id
          and r.report_type = 'SOS'
          and r.status in ('Verified', 'Resolved')
          and r.created_at > now() - interval '24 hours'
        order by r.created_at desc
        limit 1
      ) s on true
      where m.family_id = fam.id
    )
  );
end;
$$;

revoke all on function public.my_family() from public;
grant execute on function public.my_family() to authenticated;

create function public.create_family()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.family_caller();
  new_code text;
  new_id uuid;
begin
  if exists (select 1 from public.family_members where user_id = me) then
    raise exception 'You are already in a family. Leave it first to start a new one.';
  end if;
  loop
    new_code := public.make_family_code();
    insert into public.families (code, owner_id) values (new_code, me)
    on conflict (code) do nothing
    returning id into new_id;
    exit when new_id is not null;
  end loop;
  insert into public.family_members (user_id, family_id) values (me, new_id);
  return new_code;
end;
$$;

revoke all on function public.create_family() from public;
grant execute on function public.create_family() to authenticated;

-- Returns 'joined', 'not-found' or 'full'. A wrong code is answered, not
-- raised as an error, so the attempt stays counted (10 tries an hour).
create function public.join_family(join_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.family_caller();
  clean text := upper(regexp_replace(coalesce(join_code, ''), '[^A-Za-z0-9]', '', 'g'));
  fam_id uuid;
begin
  if exists (select 1 from public.family_members where user_id = me) then
    raise exception 'You are already in a family. Leave it first to join another.';
  end if;
  if (
    select count(*) from public.family_join_attempts
    where user_id = me and attempted_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Too many tries. Wait an hour, then try again.';
  end if;
  insert into public.family_join_attempts (user_id) values (me);
  delete from public.family_join_attempts where attempted_at < now() - interval '1 day';

  select id into fam_id from public.families where code = clean;
  if fam_id is null then
    return 'not-found';
  end if;
  if (select count(*) from public.family_members where family_id = fam_id) >= 12 then
    return 'full';
  end if;
  insert into public.family_members (user_id, family_id) values (me, fam_id);
  return 'joined';
end;
$$;

revoke all on function public.join_family(text) from public;
grant execute on function public.join_family(text) to authenticated;

-- Leaving: an empty family is deleted; if the person who started it leaves,
-- the longest-standing member takes over.
create function public.leave_family()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  fam_id uuid;
begin
  if me is null then
    raise exception 'Sign in first.';
  end if;
  delete from public.family_members where user_id = me returning family_id into fam_id;
  if fam_id is null then
    return;
  end if;
  if not exists (select 1 from public.family_members where family_id = fam_id) then
    delete from public.families where id = fam_id;
  else
    update public.families f
      set owner_id = (select user_id from public.family_members where family_id = fam_id order by joined_at limit 1)
      where f.id = fam_id
        and not exists (select 1 from public.family_members m where m.family_id = fam_id and m.user_id = f.owner_id);
  end if;
end;
$$;

revoke all on function public.leave_family() from public;
grant execute on function public.leave_family() to authenticated;

create function public.remove_family_member(member uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.family_caller();
  fam_id uuid;
begin
  select id into fam_id from public.families where owner_id = me;
  if fam_id is null then
    raise exception 'Only the person who started the family can remove members.';
  end if;
  if member = me then
    raise exception 'To leave the family, use Leave family.';
  end if;
  delete from public.family_members where user_id = member and family_id = fam_id;
end;
$$;

revoke all on function public.remove_family_member(uuid) from public;
grant execute on function public.remove_family_member(uuid) to authenticated;

-- A new code: the old one stops working (people already in stay).
create function public.renew_family_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := public.family_caller();
  fam_id uuid;
  new_code text;
begin
  select id into fam_id from public.families where owner_id = me;
  if fam_id is null then
    raise exception 'Only the person who started the family can make a new code.';
  end if;
  loop
    new_code := public.make_family_code();
    exit when not exists (select 1 from public.families where code = new_code);
  end loop;
  update public.families set code = new_code where id = fam_id;
  return new_code;
end;
$$;

revoke all on function public.renew_family_code() from public;
grant execute on function public.renew_family_code() to authenticated;

-- ---------------------------------------------------------------------------
-- Notifications to the family (send-push function)
-- ---------------------------------------------------------------------------
-- The other members of a person's family.
create function public.family_of(person uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(o.user_id), '{}')
  from public.family_members m
  join public.family_members o on o.family_id = m.family_id and o.user_id <> m.user_id
  where m.user_id = person
$$;

revoke all on function public.family_of(uuid) from public;
grant execute on function public.family_of(uuid) to service_role;

grant select on table public.safety_checkins to service_role;

-- A check-in by someone in a family tells the family: when the status changes,
-- or the same status is confirmed again after 30 minutes.
create function public.safety_checkins_request_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.family_members where user_id = new.user_id)
     and (tg_op = 'INSERT' or new.status is distinct from old.status or old.updated_at < now() - interval '30 minutes') then
    perform public.request_push('checkin', new.user_id::text);
  end if;
  return new;
end;
$$;

revoke all on function public.safety_checkins_request_push() from public;

create trigger safety_checkins_request_push
  after insert or update on public.safety_checkins
  for each row execute procedure public.safety_checkins_request_push();
