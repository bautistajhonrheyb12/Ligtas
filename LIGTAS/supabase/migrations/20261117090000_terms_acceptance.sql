-- Records who accepted the Terms of Use and Privacy Policy, which version and
-- when. The version is the date the documents were last updated
-- (src/lib/legal.js); a new version asks everyone to accept again.

-- Not granted to users: set through the functions below.
alter table public.profiles
  add column terms_version text
    check (terms_version is null or terms_version ~ '^\d{4}-\d{2}-\d{2}$'),
  add column terms_accepted_at timestamptz;

-- A version is a date that has already come (no accepting future documents).
create function public.is_terms_version(version text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select version ~ '^\d{4}-\d{2}-\d{2}$'
$$;

create function public.accept_terms(version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.';
  end if;
  if not coalesce(public.is_terms_version(version), false) or version::date > current_date + 1 then
    raise exception 'Unknown version of the Terms of Use.';
  end if;
  update public.profiles
    set terms_version = version,
        terms_accepted_at = now()
    where id = (select auth.uid());
end;
$$;

revoke all on function public.accept_terms(text) from public;
grant execute on function public.accept_terms(text) to authenticated;

-- The box ticked on the sign-up form is saved with the account. Runs after
-- on_auth_user_created (triggers run in name order), so the profile exists.
create function public.record_terms_at_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  version text := new.raw_user_meta_data ->> 'terms_version';
begin
  if coalesce(public.is_terms_version(version), false) and version::date <= current_date + 1 then
    update public.profiles
      set terms_version = version,
          terms_accepted_at = now()
      where id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.record_terms_at_signup() from public;

create trigger on_auth_user_terms
  after insert on auth.users
  for each row execute procedure public.record_terms_at_signup();
