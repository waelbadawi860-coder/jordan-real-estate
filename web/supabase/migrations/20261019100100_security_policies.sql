-- =============================================================================
-- Security: helper functions, Row Level Security (RLS) policies and grants.
--
-- Model:
--   anon          = visitor who is not logged in
--   authenticated = logged-in user (may also be an admin; checked by is_admin())
--   service_role  = trusted server code only (bypasses RLS; never in the browser)
--
-- Users can never change role, status, listing status, or protected fields
-- directly: those columns are not granted, and status changes go through the
-- SECURITY DEFINER functions in the workflow migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper functions used inside policies
-- -----------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

create function public.owns_listing(p_listing_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.listings
    where id = p_listing_id and seller_id = auth.uid()
  );
$$;

-- True when the listing is visible to the public.
create function public.listing_is_public(p_listing_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.listings
    where id = p_listing_id and status = 'published' and expires_at > now()
  );
$$;

-- Statuses in which the owner may still edit listing content.
create function public.listing_is_editable_by_owner(p_listing_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.listings
    where id = p_listing_id
      and seller_id = auth.uid()
      and status in ('draft', 'pending_approval', 'rejected', 'published', 'expired')
  );
$$;

create function public.setting_int(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (value #>> '{}')::integer from public.site_settings where key = p_key),
    p_default
  );
$$;

create function public.setting_bool(p_key text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (value #>> '{}')::boolean from public.site_settings where key = p_key),
    p_default
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_active_user() to anon, authenticated;
grant execute on function public.owns_listing(bigint) to anon, authenticated;
grant execute on function public.listing_is_public(bigint) to anon, authenticated;
grant execute on function public.listing_is_editable_by_owner(bigint) to authenticated;
grant execute on function public.setting_int(text, integer) to anon, authenticated;
grant execute on function public.setting_bool(text, boolean) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Start from zero privileges, then grant exactly what each role needs.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on all sequences in schema public to authenticated;

-- Enable RLS on every table.
alter table public.profiles               enable row level security;
alter table public.user_consents          enable row level security;
alter table public.site_settings          enable row level security;
alter table public.cities                 enable row level security;
alter table public.neighborhoods          enable row level security;
alter table public.property_types         enable row level security;
alter table public.listings               enable row level security;
alter table public.listing_contacts       enable row level security;
alter table public.listing_images         enable row level security;
alter table public.listing_status_history enable row level security;
alter table public.favourites             enable row level security;
alter table public.listing_reports        enable row level security;
alter table public.user_reports           enable row level security;
alter table public.notifications          enable row level security;
alter table public.admin_audit_logs       enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (display_name, phone, preferred_language) on public.profiles to authenticated;

create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: admins read all" on public.profiles
  for select to authenticated using ((select public.is_admin()));
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- user_consents (append-only)
-- -----------------------------------------------------------------------------
grant select on public.user_consents to authenticated;
grant insert (document, version) on public.user_consents to authenticated;

create policy "consents: read own" on public.user_consents
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "consents: record own" on public.user_consents
  for insert to authenticated with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- site_settings
-- -----------------------------------------------------------------------------
grant select on public.site_settings to anon, authenticated;
grant insert (key, value, is_public, description), update (value, is_public, description), delete
  on public.site_settings to authenticated;

create policy "settings: public read" on public.site_settings
  for select to anon, authenticated using (is_public or (select public.is_admin()));
create policy "settings: admins insert" on public.site_settings
  for insert to authenticated with check ((select public.is_admin()));
create policy "settings: admins update" on public.site_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "settings: admins delete" on public.site_settings
  for delete to authenticated using ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Reference data: cities, neighborhoods, property_types
-- -----------------------------------------------------------------------------
grant select on public.cities, public.neighborhoods, public.property_types to anon, authenticated;
grant insert (country_code, slug, name_ar, name_en, sort_order, is_active),
      update (slug, name_ar, name_en, sort_order, is_active)
  on public.cities to authenticated;
grant insert (city_id, slug, name_ar, name_en, sort_order, is_active),
      update (slug, name_ar, name_en, sort_order, is_active)
  on public.neighborhoods to authenticated;
grant insert (slug, name_ar, name_en, has_bedrooms, sort_order, is_active),
      update (slug, name_ar, name_en, has_bedrooms, sort_order, is_active)
  on public.property_types to authenticated;

create policy "cities: read active" on public.cities
  for select to anon, authenticated using (is_active or (select public.is_admin()));
create policy "cities: admins insert" on public.cities
  for insert to authenticated with check ((select public.is_admin()));
create policy "cities: admins update" on public.cities
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "neighborhoods: read active" on public.neighborhoods
  for select to anon, authenticated using (is_active or (select public.is_admin()));
create policy "neighborhoods: admins insert" on public.neighborhoods
  for insert to authenticated with check ((select public.is_admin()));
create policy "neighborhoods: admins update" on public.neighborhoods
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "property types: read active" on public.property_types
  for select to anon, authenticated using (is_active or (select public.is_admin()));
create policy "property types: admins insert" on public.property_types
  for insert to authenticated with check ((select public.is_admin()));
create policy "property types: admins update" on public.property_types
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- listings
-- -----------------------------------------------------------------------------
grant select on public.listings to anon, authenticated;
grant insert (deal_type, property_type_id, city_id, neighborhood_id, title, description, price,
              area_sqm, bedrooms, bathrooms, details, latitude, longitude, poster_type),
      update (deal_type, property_type_id, city_id, neighborhood_id, title, description, price,
              area_sqm, bedrooms, bathrooms, details, latitude, longitude, poster_type),
      delete
  on public.listings to authenticated;

create policy "listings: public read published" on public.listings
  for select to anon, authenticated
  using (status = 'published' and expires_at > now());
create policy "listings: owners read own" on public.listings
  for select to authenticated using (seller_id = (select auth.uid()));
create policy "listings: admins read all" on public.listings
  for select to authenticated using ((select public.is_admin()));

create policy "listings: active users create own" on public.listings
  for insert to authenticated
  with check (seller_id = (select auth.uid()) and status = 'draft' and (select public.is_active_user()));

create policy "listings: owners edit own" on public.listings
  for update to authenticated
  using (
    seller_id = (select auth.uid())
    and status in ('draft', 'pending_approval', 'rejected', 'published', 'expired')
    and (select public.is_active_user())
  )
  with check (seller_id = (select auth.uid()));
create policy "listings: admins edit" on public.listings
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Only unsubmitted drafts can be deleted; everything else is archived instead.
create policy "listings: owners delete drafts" on public.listings
  for delete to authenticated
  using (seller_id = (select auth.uid()) and status = 'draft');

-- -----------------------------------------------------------------------------
-- listing_contacts (never readable by the public through the API)
-- -----------------------------------------------------------------------------
grant select on public.listing_contacts to authenticated;
grant insert (listing_id, phone, allow_calls, allow_whatsapp),
      update (phone, allow_calls, allow_whatsapp)
  on public.listing_contacts to authenticated;

create policy "contacts: owners and admins read" on public.listing_contacts
  for select to authenticated
  using ((select public.owns_listing(listing_id)) or (select public.is_admin()));
create policy "contacts: owners create" on public.listing_contacts
  for insert to authenticated
  with check ((select public.listing_is_editable_by_owner(listing_id)) and (select public.is_active_user()));
create policy "contacts: owners update" on public.listing_contacts
  for update to authenticated
  using ((select public.listing_is_editable_by_owner(listing_id)) and (select public.is_active_user()))
  with check ((select public.listing_is_editable_by_owner(listing_id)));

-- -----------------------------------------------------------------------------
-- listing_images
-- -----------------------------------------------------------------------------
grant select on public.listing_images to anon, authenticated;
grant insert (listing_id, storage_path, position, width, height),
      update (position),
      delete
  on public.listing_images to authenticated;

create policy "images: public read for published listings" on public.listing_images
  for select to anon, authenticated using ((select public.listing_is_public(listing_id)));
create policy "images: owners and admins read" on public.listing_images
  for select to authenticated
  using ((select public.owns_listing(listing_id)) or (select public.is_admin()));
create policy "images: owners add" on public.listing_images
  for insert to authenticated
  with check (
    (select public.listing_is_editable_by_owner(listing_id))
    and (select public.is_active_user())
    and storage_path like ((select auth.uid())::text || '/' || listing_id::text || '/%')
  );
create policy "images: owners reorder" on public.listing_images
  for update to authenticated
  using ((select public.listing_is_editable_by_owner(listing_id)) and (select public.is_active_user()))
  with check ((select public.listing_is_editable_by_owner(listing_id)));
create policy "images: owners and admins delete" on public.listing_images
  for delete to authenticated
  using ((select public.listing_is_editable_by_owner(listing_id)) or (select public.is_admin()));

-- -----------------------------------------------------------------------------
-- listing_status_history (written only by triggers)
-- -----------------------------------------------------------------------------
grant select on public.listing_status_history to authenticated;

create policy "status history: owners and admins read" on public.listing_status_history
  for select to authenticated
  using ((select public.owns_listing(listing_id)) or (select public.is_admin()));

-- -----------------------------------------------------------------------------
-- favourites
-- -----------------------------------------------------------------------------
grant select, delete on public.favourites to authenticated;
grant insert (listing_id) on public.favourites to authenticated;

create policy "favourites: read own" on public.favourites
  for select to authenticated using (user_id = (select auth.uid()));
create policy "favourites: add own" on public.favourites
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.listing_is_public(listing_id)));
create policy "favourites: remove own" on public.favourites
  for delete to authenticated using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Reports
-- -----------------------------------------------------------------------------
grant select on public.listing_reports, public.user_reports to authenticated;
grant insert (listing_id, reason, details) on public.listing_reports to authenticated;
grant insert (reported_user_id, reason, details) on public.user_reports to authenticated;
grant update (status, resolution_note) on public.listing_reports, public.user_reports to authenticated;

create policy "listing reports: read own or admin" on public.listing_reports
  for select to authenticated using (reporter_id = (select auth.uid()) or (select public.is_admin()));
create policy "listing reports: active users report public listings" on public.listing_reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and (select public.is_active_user())
    and (select public.listing_is_public(listing_id))
  );
create policy "listing reports: admins resolve" on public.listing_reports
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "user reports: read own or admin" on public.user_reports
  for select to authenticated using (reporter_id = (select auth.uid()) or (select public.is_admin()));
create policy "user reports: active users report" on public.user_reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()) and (select public.is_active_user()));
create policy "user reports: admins resolve" on public.user_reports
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- -----------------------------------------------------------------------------
-- notifications (created by server/trigger code; users may only mark as read)
-- -----------------------------------------------------------------------------
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "notifications: read own" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notifications: mark own read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- admin_audit_logs (append-only; written by triggers/functions)
-- -----------------------------------------------------------------------------
grant select on public.admin_audit_logs to authenticated;

create policy "audit log: admins read" on public.admin_audit_logs
  for select to authenticated using ((select public.is_admin()));
