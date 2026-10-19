-- =============================================================================
-- Photo storage
--
--   listing-photos         PRIVATE. Sellers upload here. Only the owner and
--                          admins can read. Drafts/pending photos stay private.
--   listing-photos-public  PUBLIC (served by CDN). Only trusted server code
--                          (secret key) copies photos here when a listing is
--                          published, and removes them when it is withdrawn.
--
-- Path format: <user id>/<listing id>/<random uuid>.<webp|jpg|png>
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-photos', 'listing-photos', false, 5242880, array['image/webp', 'image/jpeg', 'image/png']),
  ('listing-photos-public', 'listing-photos-public', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- True when the object path belongs to a listing the current user owns and can still edit.
create function public.can_upload_listing_photo(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[] := string_to_array(p_object_name, '/');
begin
  if auth.uid() is null or array_length(v_parts, 1) <> 3 then
    return false;
  end if;
  if v_parts[1] <> auth.uid()::text
     or v_parts[2] !~ '^[0-9]{1,18}$'
     or v_parts[3] !~ '^[0-9a-f-]{36}\.(webp|jpg|png)$' then
    return false;
  end if;
  return exists (
    select 1 from public.listings
    where id = v_parts[2]::bigint
      and seller_id = auth.uid()
      and status in ('draft', 'pending_approval', 'rejected', 'published', 'expired')
  ) and public.is_active_user();
end;
$$;

grant execute on function public.can_upload_listing_photo(text) to authenticated;

create policy "listing photos: owners upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-photos' and public.can_upload_listing_photo(name));

create policy "listing photos: owners and admins read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'listing-photos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

create policy "listing photos: owners and admins delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

-- No update policy: photos are replaced by deleting and uploading a new file.
-- No policies at all on 'listing-photos-public': only the server writes there.
