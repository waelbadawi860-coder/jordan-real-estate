-- =============================================================================
-- Stage 4: small thumbnails for listing photos, and the versions of the
-- terms/privacy documents that users accept at registration.
-- =============================================================================

-- A ~480px thumbnail uploaded alongside each photo (used in listing cards).
alter table public.listing_images
  add column thumb_path text unique
  check (thumb_path ~ '^[0-9a-f-]{36}/[0-9]{1,18}/[0-9a-f-]{36}\.(webp|jpg|png)$');

grant insert (thumb_path) on public.listing_images to authenticated;

drop policy "images: owners add" on public.listing_images;
create policy "images: owners add" on public.listing_images
  for insert to authenticated
  with check (
    (select public.listing_is_editable_by_owner(listing_id))
    and (select public.is_active_user())
    and storage_path like ((select auth.uid())::text || '/' || listing_id::text || '/%')
    and (thumb_path is null or thumb_path like ((select auth.uid())::text || '/' || listing_id::text || '/%'))
  );

-- Document versions shown at registration. They are DRAFTS until a Jordanian
-- lawyer approves them; the version label says so, so records stay honest.
insert into public.site_settings (key, value, is_public, description) values
  ('terms_version',   '"draft-2026-10"', true, 'Version label of the terms users accept at registration'),
  ('privacy_version', '"draft-2026-10"', true, 'Version label of the privacy policy users accept at registration')
on conflict (key) do nothing;
