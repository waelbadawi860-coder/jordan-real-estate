-- =============================================================================
-- Stage 7
-- 1) Location privacy: a listing's exact map pin is readable only by its owner
--    and admins. Everyone else sees a rounded position (2 decimals ≈ 1 km).
-- 2) In-site notifications: listing submitted / reported / contact message
--    (admins), listing expiring soon / expired (sellers).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Location privacy
-- ---------------------------------------------------------------------------
alter table public.listings
  add column approx_latitude numeric(5, 2) generated always as (round(latitude, 2)) stored,
  add column approx_longitude numeric(5, 2) generated always as (round(longitude, 2)) stored;

-- Replace table-wide read access with a column list that leaves out the exact
-- latitude/longitude. NOTE: any column added to listings later must be added
-- to this grant explicitly.
revoke select on public.listings from anon, authenticated;
grant select (
  id, seller_id, status, deal_type, property_type_id, city_id, neighborhood_id, title, description,
  price, currency, area_sqm, bedrooms, bathrooms, details, poster_type, rejection_reason,
  submitted_at, published_at, expires_at, status_changed_at, created_at, updated_at,
  approx_latitude, approx_longitude
) on public.listings to anon, authenticated;

-- Exact pin for the owner (to edit it) and admins.
create function public.get_listing_location(p_listing_id bigint)
returns table (latitude numeric, longitude numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select l.latitude, l.longitude
  from public.listings l
  where l.id = p_listing_id
    and (l.seller_id = auth.uid() or public.is_admin());
$$;
grant execute on function public.get_listing_location(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Notifications
-- ---------------------------------------------------------------------------

-- Status history trigger: also tell admins when a listing awaits review.
create or replace function public.listings_after_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.listing_status_history (listing_id, from_status, to_status, changed_by, reason)
  values (new.id, old.status, new.status, auth.uid(), nullif(current_setting('app.status_reason', true), ''));

  if new.status = 'pending_approval' then
    perform public.notify_admins('listing_submitted', jsonb_build_object('listing_id', new.id));
  end if;
  return null;
end;
$$;

create function public.notify_admins_on_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'listing_reports' then
    perform public.notify_admins('listing_reported', jsonb_build_object('listing_id', new.listing_id, 'report_id', new.id));
  elsif tg_table_name = 'user_reports' then
    perform public.notify_admins('user_reported', jsonb_build_object('user_id', new.reported_user_id, 'report_id', new.id));
  else
    perform public.notify_admins('contact_message', jsonb_build_object('message_id', new.id));
  end if;
  return null;
end;
$$;

create trigger listing_reports_notify after insert on public.listing_reports
  for each row execute function public.notify_admins_on_report();
create trigger user_reports_notify after insert on public.user_reports
  for each row execute function public.notify_admins_on_report();
create trigger contact_messages_notify after insert on public.contact_messages
  for each row execute function public.notify_admins_on_report();

-- Expiry job now also tells each seller their listing expired.
create or replace function public.expire_listings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform set_config('app.status_reason', 'expired_automatically', true);
  with expired as (
    update public.listings
    set status = 'expired'
    where status = 'published' and expires_at <= now()
    returning id, seller_id
  ), notified as (
    insert into public.notifications (user_id, type, data)
    select seller_id, 'listing_expired', jsonb_build_object('listing_id', id) from expired
    returning 1
  )
  select count(*) into v_count from notified;
  return v_count;
end;
$$;

-- Daily reminder 3 days before expiry (once per publication period).
create function public.notify_expiring_listings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notifications (user_id, type, data)
  select l.seller_id, 'listing_expiring', jsonb_build_object('listing_id', l.id, 'expires_at', l.expires_at)
  from public.listings l
  where l.status = 'published'
    and l.expires_at > now()
    and l.expires_at <= now() + interval '3 days'
    and not exists (
      select 1 from public.notifications n
      where n.user_id = l.seller_id
        and n.type = 'listing_expiring'
        and n.data ->> 'listing_id' = l.id::text
        and n.created_at > coalesce(l.published_at, l.created_at)
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

select cron.schedule('notify-expiring-listings', '0 6 * * *', $$select public.notify_expiring_listings();$$);

create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;
