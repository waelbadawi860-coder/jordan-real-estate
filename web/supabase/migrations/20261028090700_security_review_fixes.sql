-- Fixes from the security review (2026-10-22).

-- 1. Two-step login for admins, in the database too: an admin who has set up
--    an authenticator app only counts as admin in a session confirmed with
--    the code (aal2), even when "require_admin_mfa" is still off. A stolen
--    password alone can then no longer use admin powers through the API.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  )
  and (
    coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    or (
      not public.setting_bool('require_admin_mfa', false)
      and not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
    )
  );
$$;

-- 2. Approved photos can't be swapped behind the reviewer's back: owners can
--    no longer delete storage files directly (the server deletes them after
--    the database row is removed), and a path already used by a photo can't
--    be uploaded again.
drop policy if exists "listing photos: owners and admins delete" on storage.objects;
create policy "listing photos: admins delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-photos' and (select public.is_admin()));

create or replace function public.can_upload_listing_photo(p_object_name text)
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
  if exists (select 1 from public.listing_images where storage_path = p_object_name or thumb_path = p_object_name) then
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

-- 3. The active-listings limit also applies when an edit sends an expired ad
--    back to review (that status change is made by another trigger, so the
--    check must run on every update, after it).
drop trigger if exists listings_check_active_limit on public.listings;
create trigger listings_check_active_limit before update on public.listings
  for each row execute function public.listings_check_active_limit();

-- 4. Office documents: only people with an office page can upload, at most
--    20 files each.
drop policy if exists "office documents: owners upload" on storage.objects;
create function public.can_upload_office_document(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and split_part(p_object_name, '/', 1) = auth.uid()::text
    and p_object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'
    and public.is_active_user()
    and exists (select 1 from public.offices where owner_id = auth.uid())
    and (select count(*) from storage.objects o
         where o.bucket_id = 'office-documents' and (storage.foldername(o.name))[1] = auth.uid()::text) < 20;
$$;
revoke execute on function public.can_upload_office_document(text) from public;
grant execute on function public.can_upload_office_document(text) to authenticated;
create policy "office documents: office owners upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'office-documents' and public.can_upload_office_document(name));

-- 5. Offices: visitors don't see which package an office bought. (The owner
--    id stays readable: it is the listings' public seller id, used for the
--    badge.) Signed-in pages read packages for the owner and admins; hiding
--    them from other signed-in users too would need a separate table, and is
--    accepted as low risk for now.
revoke select on public.offices from anon;
grant select (id, owner_id, name, phone, city_id, about, verified_until, status, created_at, updated_at) on public.offices to anon;
revoke execute on function public.active_listing_limit(uuid) from authenticated;

-- 6. Changing a verified office's phone also removes the badge until the
--    documents are checked again (the phone must match the documents).
create or replace function public.offices_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.plan_slug := null;
      new.plan_until := null;
      new.verified_until := null;
      new.status := 'active';
    elsif (new.name, new.phone) is distinct from (old.name, old.phone) and old.verified_until is not null then
      new.verified_until := null;
    end if;
  end if;
  return new;
end;
$$;
