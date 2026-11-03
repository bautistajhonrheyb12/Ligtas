-- Philippine mobile numbers only (+63 followed by 9XXXXXXXXX), and names for
-- citizens who sign up with Google.
-- Requires 20261104090000_admin_two_step.sql.

-- Turns 0917 123 4567, 639171234567 or +63 917 123 4567 into +639171234567.
-- Anything that is not a Philippine mobile number becomes null.
create or replace function public.normalize_ph_mobile(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when digits ~ '^(63|0)?9[0-9]{9}$' then '+63' || right(digits, 10)
  end
  from (select regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g') as digits) as cleaned
$$;

-- Bring numbers saved in the older, looser format into the new one.
update public.profiles
set phone = public.normalize_ph_mobile(phone)
where phone is not null
  and phone is distinct from public.normalize_ph_mobile(phone);

alter table public.profiles drop constraint profiles_phone_check;

alter table public.profiles
  add constraint profiles_phone_check
    check (phone is null or phone ~ '^\+639[0-9]{9}$');

-- New accounts: the sign-up form sends display_name; Google sends full_name or
-- name. Values that would break the column checks are dropped instead of
-- failing the sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  name_value text := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), '')
  );
  barangay_value text := nullif(trim(new.raw_user_meta_data ->> 'barangay'), '');
begin
  insert into public.profiles (id, role, display_name, barangay, phone)
  values (
    new.id,
    'citizen',
    case when char_length(name_value) between 1 and 80 then name_value end,
    case when char_length(barangay_value) between 2 and 80 then barangay_value end,
    public.normalize_ph_mobile(new.raw_user_meta_data ->> 'phone')
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
