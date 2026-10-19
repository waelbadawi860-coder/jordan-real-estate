-- =============================================================================
-- Adding a photo to an already-approved (published or expired) listing sends
-- it back for review, exactly like editing its text, so unreviewed photos can
-- never go public. Removing or reordering photos does not need review.
-- =============================================================================

create function public.listing_images_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and public.setting_bool('require_listing_approval', true)
  then
    perform set_config('app.status_reason', 'photos_added_after_approval', true);
    update public.listings
    set status = 'pending_approval', submitted_at = now()
    where id = new.listing_id and status in ('published', 'expired');
  end if;
  return null;
end;
$$;

create trigger listing_images_after_insert
  after insert on public.listing_images
  for each row execute function public.listing_images_after_insert();
