-- Photo file clean-up, run once a day by /api/cron/cleanup (server only).
--
-- * Orphans: uploaded files that no ad refers to (an upload that failed half
--   way, a deleted draft whose file removal failed), after one day.
-- * Public copies of ads that are no longer public.
-- * Retention: photo files of ads that have been off the site (withdrawn,
--   rejected, archived, sold, rented, expired) for longer than the retention
--   period. The photo rows stay, with their fingerprints, so a removed ad's
--   photos are still recognised if they are posted again.

insert into public.site_settings (key, value, is_public, description)
values ('removed_photo_retention_days', '365', false, 'Days photo files of an ad stay stored after it leaves the site')
on conflict (key) do nothing;

alter table public.listing_images add column files_removed_at timestamptz;

create function public.photo_cleanup_candidates(p_limit integer default 1000)
returns table (bucket text, path text, reason text, image_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  (
    select o.bucket_id, o.name, 'orphan', null::uuid
    from storage.objects o
    where o.bucket_id = 'listing-photos'
      and o.created_at < now() - interval '1 day'
      and not exists (select 1 from public.listing_images i where i.storage_path = o.name or i.thumb_path = o.name)
    limit p_limit
  )
  union all
  (
    select o.bucket_id, o.name, 'not_public', null::uuid
    from storage.objects o
    where o.bucket_id = 'listing-photos-public'
      and not exists (
        select 1 from public.listing_images i join public.listings l on l.id = i.listing_id
        where (i.storage_path = o.name or i.thumb_path = o.name) and l.status = 'published'
      )
    limit p_limit
  )
  union all
  (
    select 'listing-photos', p.path, 'retention', i.id
    from public.listing_images i
    join public.listings l on l.id = i.listing_id
    cross join lateral (values (i.storage_path), (i.thumb_path)) p(path)
    where i.files_removed_at is null
      and p.path is not null
      and l.status in ('withdrawn', 'rejected', 'archived', 'sold', 'rented', 'expired')
      and l.status_changed_at < now() - make_interval(days => public.setting_int('removed_photo_retention_days', 365))
    limit p_limit
  );
$$;
revoke execute on function public.photo_cleanup_candidates(integer) from public;
grant execute on function public.photo_cleanup_candidates(integer) to service_role;
