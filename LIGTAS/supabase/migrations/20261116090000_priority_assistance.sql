-- Priority rescue: the people in a household who need help first (persons
-- with disability, pregnant women, children and senior citizens), each with a
-- proof that an administrator checks.
--
-- Disability and health details are sensitive personal information under the
-- Data Privacy Act (RA 10173). The account owner consents before adding
-- anyone, the proofs are visible only to the owner and administrators, and
-- rescuers see only the verified categories on a call, never the documents,
-- names or details.

-- ---------------------------------------------------------------------------
-- The question every citizen answers
-- ---------------------------------------------------------------------------
-- Not granted to users: set through the functions below.
alter table public.profiles
  add column priority_answered_at timestamptz,
  add column priority_consent_at timestamptz;

-- ---------------------------------------------------------------------------
-- Household members who need priority rescue
-- ---------------------------------------------------------------------------
create table public.priority_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category text not null check (category in ('pwd', 'pregnant', 'child', 'senior')),
  full_name text not null check (char_length(full_name) between 2 and 80),
  birth_year integer check (birth_year between 1900 and 2100),
  due_date date,
  details text check (details is null or char_length(details) <= 300),
  proof_path text not null check (char_length(proof_path) between 3 and 300),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  review_note text check (review_note is null or char_length(review_note) <= 300),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index priority_members_user_idx on public.priority_members (user_id);
create index priority_members_pending_idx on public.priority_members (created_at) where status = 'pending';

alter table public.priority_members enable row level security;

revoke all on table public.priority_members from anon, authenticated;
grant select, delete on table public.priority_members to authenticated;
grant insert (category, full_name, birth_year, due_date, details, proof_path)
  on table public.priority_members to authenticated;
-- Owners edit the details; admins set the review. The trigger below keeps each
-- to their own part.
grant update (category, full_name, birth_year, due_date, details, proof_path, status, review_note)
  on table public.priority_members to authenticated;

create policy "People can read their own priority members"
  on public.priority_members
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Admins can read priority members"
  on public.priority_members
  for select
  to authenticated
  using (public.current_user_role() = 'admin');

create policy "Citizens can add priority members after consenting"
  on public.priority_members
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.current_user_role() = 'citizen'
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and priority_consent_at is not null
    )
  );

create policy "People can edit their own priority members"
  on public.priority_members
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Admins can review priority members"
  on public.priority_members
  for update
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

create policy "People can remove their own priority members"
  on public.priority_members
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Checks each entry and keeps the review honest:
--   * a child is under 18 and a senior citizen is 60 or older (by birth year);
--   * a pregnancy has an expected due date that is not long past;
--   * the proof is in the owner's own folder;
--   * any change by the owner sends the entry back for review, so nobody can
--     verify themselves or change a verified entry;
--   * an admin reviewing someone else's entry can change only the review, and
--     a rejection needs a reason the person can act on;
--   * the service role (no signed-in user) is trusted as it is elsewhere.
create function public.priority_members_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  this_year integer := extract(year from now())::integer;
  content_changed boolean;
begin
  new.full_name := public.clean_text(new.full_name);
  new.details := nullif(public.clean_text(new.details), '');
  new.review_note := nullif(public.clean_text(new.review_note), '');
  new.updated_at := now();

  if tg_op = 'INSERT' then
    content_changed := true;
    new.created_at := now();
    if (select count(*) from public.priority_members where user_id = new.user_id) >= 15 then
      raise exception 'A household can list up to 15 people for priority rescue.';
    end if;
  else
    if new.user_id is distinct from old.user_id then
      raise exception 'Priority entries cannot be moved to another account.';
    end if;
    content_changed := (new.category, new.full_name, new.birth_year, new.due_date, new.details, new.proof_path)
      is distinct from (old.category, old.full_name, old.birth_year, old.due_date, old.details, old.proof_path);
  end if;

  if caller is null then
    -- The service role or the SQL editor: trusted, used for corrections.
    return new;
  elsif tg_op = 'INSERT' or new.user_id = caller then
    -- The owner (also an admin's own household: nobody reviews themselves).
    if content_changed then
      new.status := 'pending';
      new.review_note := null;
      new.reviewed_by := null;
      new.reviewed_at := null;
    else
      new.status := old.status;
      new.review_note := old.review_note;
    end if;
  elsif public.current_user_role() = 'admin' then
    if content_changed then
      raise exception 'Admins can only approve or reject priority entries.';
    end if;
    if new.status = 'rejected' and new.review_note is null then
      raise exception 'Give a reason so the household knows what to fix.';
    end if;
    if new.status is distinct from old.status or new.review_note is distinct from old.review_note then
      new.reviewed_by := caller;
      new.reviewed_at := now();
    end if;
  else
    raise exception 'You cannot change this priority entry.';
  end if;

  if not content_changed then
    return new;
  end if;

  if new.full_name is null or char_length(new.full_name) < 2 then
    raise exception 'Enter the person''s full name.';
  end if;
  if new.category = 'child' and (new.birth_year is null or this_year - new.birth_year not between 0 and 17) then
    raise exception 'A child must be under 18. Check the birth year.';
  end if;
  if new.category = 'senior' and (new.birth_year is null or this_year - new.birth_year < 60) then
    raise exception 'A senior citizen must be 60 or older. Check the birth year.';
  end if;
  if new.birth_year is not null and new.birth_year > this_year then
    raise exception 'The birth year cannot be in the future.';
  end if;
  if new.category = 'pregnant' then
    if new.due_date is null or new.due_date not between current_date - 30 and current_date + 300 then
      raise exception 'Enter the expected due date from the prenatal record.';
    end if;
  else
    new.due_date := null;
  end if;
  if split_part(new.proof_path, '/', 1) <> new.user_id::text then
    raise exception 'Upload the proof again.';
  end if;

  return new;
end;
$$;

revoke all on function public.priority_members_check() from public;

create trigger priority_members_check
  before insert or update on public.priority_members
  for each row execute procedure public.priority_members_check();

-- ---------------------------------------------------------------------------
-- Answering the question
-- ---------------------------------------------------------------------------
create function public.give_priority_consent()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_user_role() is distinct from 'citizen' then
    raise exception 'Only citizen accounts list people for priority rescue.';
  end if;
  update public.profiles
    set priority_consent_at = coalesce(priority_consent_at, now())
    where id = (select auth.uid());
end;
$$;

revoke all on function public.give_priority_consent() from public;
grant execute on function public.give_priority_consent() to authenticated;

-- "Yes" needs at least one person with a proof; "No" needs an empty list.
create function public.answer_priority_question(has_priority boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  listed integer;
begin
  if public.current_user_role() is distinct from 'citizen' then
    raise exception 'Only citizen accounts answer the priority question.';
  end if;
  select count(*) into listed from public.priority_members where user_id = (select auth.uid());
  if has_priority and listed = 0 then
    raise exception 'Add at least one person, with a proof, or answer No.';
  end if;
  if not has_priority and listed > 0 then
    raise exception 'Remove the people listed first, or answer Yes.';
  end if;
  update public.profiles
    set priority_answered_at = now()
    where id = (select auth.uid());
end;
$$;

revoke all on function public.answer_priority_question(boolean) from public;
grant execute on function public.answer_priority_question(boolean) to authenticated;

-- Withdraws consent: removes every entry and returns the proof files, which
-- the app then deletes from storage. The answer becomes "No".
create function public.clear_priority_information()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  proofs text[];
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.';
  end if;
  with removed as (
    delete from public.priority_members
    where user_id = (select auth.uid())
    returning proof_path
  )
  select coalesce(array_agg(proof_path), '{}') into proofs from removed;
  update public.profiles
    set priority_consent_at = null,
        priority_answered_at = now()
    where id = (select auth.uid());
  return proofs;
end;
$$;

revoke all on function public.clear_priority_information() from public;
grant execute on function public.clear_priority_information() to authenticated;

-- ---------------------------------------------------------------------------
-- Proofs (private bucket: images or PDF, up to 5 MB)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('priority-proofs', 'priority-proofs', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create function public.recent_proof_uploads()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from storage.objects
  where bucket_id = 'priority-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and created_at > now() - interval '10 minutes'
$$;

revoke all on function public.recent_proof_uploads() from public;
grant execute on function public.recent_proof_uploads() to authenticated;

create policy "Citizens can upload priority proofs to their own folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'priority-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.recent_proof_uploads() < 20
  );

-- Rescuers are deliberately left out.
create policy "Owners and admins can view priority proofs"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'priority-proofs'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.current_user_role() = 'admin'
    )
  );

create policy "Owners can delete their priority proofs"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'priority-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Priority on reports and SOS calls
-- ---------------------------------------------------------------------------
-- The categories (one entry per person, so two seniors appear twice) that
-- applied when the report was sent, kept up to date while it is open.
-- priority_needs: verified by an admin; priority_pending: still being checked.
alter table public.incident_reports
  add column priority_needs text[] not null default '{}'
    check (priority_needs <@ array['pwd', 'pregnant', 'child', 'senior']),
  add column priority_pending text[] not null default '{}'
    check (priority_pending <@ array['pwd', 'pregnant', 'child', 'senior']);

-- Entries that still apply: a child who has turned 18 or a pregnancy well past
-- its due date no longer counts.
create function public.priority_categories(target uuid, wanted_status text)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.category order by m.category), '{}')
  from public.priority_members m
  where m.user_id = target
    and m.status = wanted_status
    and (m.category <> 'child' or extract(year from now())::integer - m.birth_year <= 17)
    and (m.category <> 'pregnant' or m.due_date >= current_date - 60)
$$;

revoke all on function public.priority_categories(uuid, text) from public;

-- Set by the server, whatever the browser sent.
create function public.incident_reports_priority_needs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.priority_needs := public.priority_categories(new.reporter_id, 'verified');
  new.priority_pending := public.priority_categories(new.reporter_id, 'pending');
  new.vulnerable_people := new.vulnerable_people or cardinality(new.priority_needs) > 0;
  return new;
end;
$$;

revoke all on function public.incident_reports_priority_needs() from public;

create trigger incident_reports_priority_needs
  before insert on public.incident_reports
  for each row execute procedure public.incident_reports_priority_needs();

-- Open reports follow the household's list as it is reviewed or changed.
create function public.priority_members_refresh_reports()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  household uuid := coalesce(new.user_id, old.user_id);
  verified text[] := public.priority_categories(household, 'verified');
  pending text[] := public.priority_categories(household, 'pending');
begin
  update public.incident_reports
    set priority_needs = verified,
        priority_pending = pending,
        vulnerable_people = vulnerable_people or cardinality(verified) > 0
    where reporter_id = household
      and status in ('Pending', 'Verified')
      and (priority_needs is distinct from verified or priority_pending is distinct from pending);
  return null;
end;
$$;

revoke all on function public.priority_members_refresh_reports() from public;

create trigger priority_members_refresh_reports
  after insert or update or delete on public.priority_members
  for each row execute procedure public.priority_members_refresh_reports();

-- ---------------------------------------------------------------------------
-- Realtime (row level security still applies to every change event)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.priority_members;
