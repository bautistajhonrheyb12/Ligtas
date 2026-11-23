-- Optional profile photos.
-- Everyone starts with their initials; a photo is only added if the person
-- chooses one in Profile. The photo is a small square JPEG (made in the app)
-- in the private "avatars" bucket, in a folder named after its owner. Only the
-- owner can see, add or remove it. profiles.avatar_path names the current one.

-- ---------------------------------------------------------------------------
-- Which photo is current
-- ---------------------------------------------------------------------------
-- Always a file in the person's own folder.
alter table public.profiles
  add column if not exists avatar_path text
    constraint profiles_avatar_path_check
    check (avatar_path is null or (char_length(avatar_path) <= 200 and starts_with(avatar_path, id::text || '/')));

grant update (avatar_path) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- The bucket (private: JPEG only, up to 512 KB; the app sends about 30 KB)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 524288, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Photos this person added in the last 10 minutes.
create function public.recent_avatar_uploads()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from storage.objects
  where bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and created_at > now() - interval '10 minutes'
$$;

revoke all on function public.recent_avatar_uploads() from public;
grant execute on function public.recent_avatar_uploads() to authenticated;

-- At most 10 photos every 10 minutes, and only from a sign-in that is still
-- active (current_user_role() is empty for one ended elsewhere).
create policy "People can add their own profile photo"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.current_user_role() is not null
    and public.recent_avatar_uploads() < 10
  );

-- No one else, staff included, can see a person's photo.
create policy "People can see their own profile photo"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "People can remove their own profile photo"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
