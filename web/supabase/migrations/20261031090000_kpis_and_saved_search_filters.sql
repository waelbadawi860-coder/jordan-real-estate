-- 1) Management indicators for the admin dashboard, over the last N days:
--    how many ads were submitted, how fast they were reviewed, how many were
--    rejected, how many carried risk signals, and automatic holds.
-- 2) Saved searches also keep a maximum price and "direct from owner only",
--    so "flat for sale, from the owner, Dabouq, under 150,000" can be followed.

create function public.admin_kpis(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  return (
    with decisions as (
      -- Each review decision, with the submission it answered.
      select d.to_status,
             extract(epoch from d.created_at - s.created_at) / 3600.0 as hours
      from public.listing_status_history d
      cross join lateral (
        select h.created_at from public.listing_status_history h
        where h.listing_id = d.listing_id and h.to_status = 'pending_approval' and h.created_at <= d.created_at
        order by h.created_at desc limit 1
      ) s
      where d.from_status = 'pending_approval'
        and d.to_status in ('published', 'rejected')
        and d.created_at >= v_since
    ),
    submitted as (
      select distinct listing_id from public.listing_status_history
      where to_status = 'pending_approval' and created_at >= v_since
    ),
    flagged as (
      select r.listing_id, r.flags from public.listing_risk r join submitted s using (listing_id)
      where cardinality(r.flags) > 0
    )
    select jsonb_build_object(
      'days', greatest(1, least(coalesce(p_days, 30), 365)),
      'submitted', (select count(*) from submitted),
      'approved', (select count(*) from decisions where to_status = 'published'),
      'rejected', (select count(*) from decisions where to_status = 'rejected'),
      'review_hours_avg', (select round(avg(hours)::numeric, 1) from decisions),
      'review_hours_median', (select round((percentile_cont(0.5) within group (order by hours))::numeric, 1) from decisions),
      'review_hours_p90', (select round((percentile_cont(0.9) within group (order by hours))::numeric, 1) from decisions),
      'pending_now', (select count(*) from public.listings where status = 'pending_approval'),
      'oldest_pending_hours', (select round((extract(epoch from now() - min(submitted_at)) / 3600.0)::numeric, 1)
                               from public.listings where status = 'pending_approval'),
      'flagged', (select count(*) from flagged),
      'flags', (select coalesce(jsonb_object_agg(flag, n), '{}'::jsonb)
                from (select unnest(flags) as flag, count(*) as n from flagged group by 1) f),
      'auto_held', (select count(*) from public.listing_status_history
                    where to_status = 'on_hold' and reason = 'auto_hold_reports' and created_at >= v_since),
      'admin_held', (select count(*) from public.listing_status_history
                     where to_status = 'on_hold' and coalesce(reason, '') <> 'auto_hold_reports' and created_at >= v_since)
    )
  );
end;
$$;
revoke execute on function public.admin_kpis(integer) from public;
grant execute on function public.admin_kpis(integer) to authenticated;

-- Saved searches: maximum price and owner-only.
alter table public.saved_searches
  add column max_price  numeric(14, 3) check (max_price > 0),
  add column owner_only boolean not null default false;
grant insert (max_price, owner_only) on public.saved_searches to authenticated;

drop index public.saved_searches_unique;
create unique index saved_searches_unique on public.saved_searches
  (user_id, deal_type, property_type_id, city_id, neighborhood_id, max_price, owner_only) nulls not distinct;

create or replace function public.notify_saved_searches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'published' or old.status not in ('draft', 'pending_approval') then
    return null;
  end if;

  insert into public.saved_search_hits (saved_search_id, listing_id)
  select s.id, new.id
  from public.saved_searches s
  join public.profiles p on p.id = s.user_id and p.status = 'active'
  where s.user_id <> new.seller_id
    and s.email_enabled
    and (s.deal_type is null or s.deal_type = new.deal_type)
    and (s.property_type_id is null or s.property_type_id = new.property_type_id)
    and (s.city_id is null or s.city_id = new.city_id)
    and (s.neighborhood_id is null or s.neighborhood_id = new.neighborhood_id)
    and (s.max_price is null or new.price <= s.max_price)
    and (not s.owner_only or new.poster_type = 'owner')
  on conflict do nothing;

  insert into public.notifications (user_id, type, data)
  select distinct s.user_id, 'similar_listing', jsonb_build_object('listing_id', new.id)
  from public.saved_searches s
  join public.profiles p on p.id = s.user_id and p.status = 'active'
  where s.user_id <> new.seller_id
    and (s.deal_type is null or s.deal_type = new.deal_type)
    and (s.property_type_id is null or s.property_type_id = new.property_type_id)
    and (s.city_id is null or s.city_id = new.city_id)
    and (s.neighborhood_id is null or s.neighborhood_id = new.neighborhood_id)
    and (s.max_price is null or new.price <= s.max_price)
    and (not s.owner_only or new.poster_type = 'owner');
  return null;
end;
$$;
