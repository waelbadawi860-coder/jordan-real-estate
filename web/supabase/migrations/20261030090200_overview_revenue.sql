-- Admin dashboard: featured ads live now, and income from paid services
-- (featured / move to top, office packages) this month (Jordan time) and in total.
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Amman') at time zone 'Asia/Amman';
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'listings_by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                           from (select status, count(*) as n from public.listings group by status) s),
    'live_listings', (select count(*) from public.listings where status = 'published' and expires_at > now()),
    'new_listings_7d', (select count(*) from public.listings where created_at > now() - interval '7 days'),
    'users_by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                        from (select status, count(*) as n from public.profiles group by status) s),
    'new_users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'open_listing_reports', (select count(*) from public.listing_reports where status in ('open', 'reviewing')),
    'open_user_reports', (select count(*) from public.user_reports where status in ('open', 'reviewing')),
    'open_messages', (select count(*) from public.contact_messages where status in ('open', 'reviewing')),
    'featured_now', (select count(*) from public.listings
                     where status = 'published' and expires_at > now() and featured_until > now()),
    'revenue_month', (select coalesce(sum(amount), 0) from (
                        select amount from public.listing_promotions where created_at >= v_month_start
                        union all
                        select amount from public.office_plan_history where created_at >= v_month_start) r),
    'revenue_total', (select coalesce(sum(amount), 0) from (
                        select amount from public.listing_promotions
                        union all
                        select amount from public.office_plan_history) r)
  );
end;
$$;
