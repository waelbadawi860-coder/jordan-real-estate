-- =============================================================================
-- Core schema: enums, profiles, reference data, listings and supporting tables.
-- Security (RLS policies and grants) is in the next migration.
-- Commission tables are added in Stage 6.
-- =============================================================================

-- Secure by default: new tables and functions created by migrations are NOT
-- automatically usable by browser clients (anon / authenticated). Every grant
-- must be explicit.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('user', 'admin');
create type public.account_status as enum ('active', 'suspended', 'deletion_requested', 'deleted');
create type public.deal_type as enum ('sale', 'rent');
create type public.poster_type as enum ('owner', 'agent');
create type public.listing_status as enum (
  'draft', 'pending_approval', 'published', 'rejected', 'expired',
  'sold', 'rented', 'withdrawn', 'archived'
);
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

-- -----------------------------------------------------------------------------
-- Generic updated_at trigger
-- -----------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Profiles (one row per Supabase Auth user; email stays in auth.users only)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  display_name          text not null check (char_length(btrim(display_name)) between 2 and 60),
  -- Private. Jordanian numbers in international format, e.g. +962791234567.
  phone                 text check (phone ~ '^\+962[0-9]{8,9}$'),
  preferred_language    text not null default 'ar' check (preferred_language in ('ar', 'en')),
  role                  public.app_role not null default 'user',
  status                public.account_status not null default 'active',
  status_reason         text check (char_length(status_reason) <= 500),
  status_changed_at     timestamptz,
  deletion_requested_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically when someone registers.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 60);
  v_lang text := coalesce(new.raw_user_meta_data ->> 'preferred_language', 'ar');
begin
  if char_length(v_name) < 2 then
    v_name := 'مستخدم';
  end if;
  if v_lang not in ('ar', 'en') then
    v_lang := 'ar';
  end if;

  insert into public.profiles (id, display_name, preferred_language)
  values (new.id, v_name, v_lang);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Consent records (terms, privacy policy, ...). Append-only.
create table public.user_consents (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  document    text not null check (document in ('terms', 'privacy', 'marketing')),
  version     text not null check (char_length(version) between 1 and 40),
  accepted_at timestamptz not null default now()
);
create index user_consents_user_idx on public.user_consents (user_id, document, accepted_at desc);

-- -----------------------------------------------------------------------------
-- Site settings (editable by admins; values are JSON)
-- -----------------------------------------------------------------------------
create table public.site_settings (
  key         text primary key check (key ~ '^[a-z0-9_]{2,64}$'),
  value       jsonb not null,
  is_public   boolean not null default false,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null
);

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Reference data: cities, neighborhoods, property types
-- -----------------------------------------------------------------------------
create table public.cities (
  id           smallint generated always as identity primary key,
  country_code char(2) not null default 'JO' check (country_code ~ '^[A-Z]{2}$'),
  slug         text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name_ar      text not null check (char_length(btrim(name_ar)) between 2 and 80),
  name_en      text not null check (char_length(btrim(name_en)) between 2 and 80),
  sort_order   smallint not null default 100,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.neighborhoods (
  id         integer generated always as identity primary key,
  city_id    smallint not null references public.cities (id) on delete restrict,
  slug       text not null check (slug ~ '^[a-z0-9-]{2,60}$'),
  name_ar    text not null check (char_length(btrim(name_ar)) between 2 and 80),
  name_en    text not null check (char_length(btrim(name_en)) between 2 and 80),
  sort_order smallint not null default 100,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, slug),
  -- Lets listings guarantee that the neighborhood belongs to the chosen city.
  unique (id, city_id)
);

create table public.property_types (
  id           smallint generated always as identity primary key,
  slug         text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name_ar      text not null check (char_length(btrim(name_ar)) between 2 and 80),
  name_en      text not null check (char_length(btrim(name_en)) between 2 and 80),
  -- Controls whether the listing form asks for bedrooms/bathrooms.
  has_bedrooms boolean not null default true,
  sort_order   smallint not null default 100,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger cities_set_updated_at before update on public.cities
  for each row execute function public.set_updated_at();
create trigger neighborhoods_set_updated_at before update on public.neighborhoods
  for each row execute function public.set_updated_at();
create trigger property_types_set_updated_at before update on public.property_types
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Listings
-- -----------------------------------------------------------------------------
create table public.listings (
  id                bigint generated always as identity (start with 100001) primary key,
  seller_id         uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  status            public.listing_status not null default 'draft',
  deal_type         public.deal_type not null,
  property_type_id  smallint not null references public.property_types (id) on delete restrict,
  city_id           smallint not null references public.cities (id) on delete restrict,
  neighborhood_id   integer,
  title             text not null check (char_length(btrim(title)) between 5 and 120),
  description       text not null default '' check (char_length(description) <= 5000),
  -- JOD has 3 decimal places (fils). Never floating point.
  price             numeric(14, 3) not null check (price > 0 and price < 1000000000),
  currency          char(3) not null default 'JOD' check (currency = 'JOD'),
  area_sqm          numeric(10, 2) check (area_sqm > 0 and area_sqm < 10000000),
  bedrooms          smallint check (bedrooms between 0 and 50),
  bathrooms         smallint check (bathrooms between 0 and 50),
  details           jsonb not null default '{}'::jsonb
                    check (jsonb_typeof(details) = 'object' and pg_column_size(details) < 8192),
  -- Optional pin, restricted to Jordan's bounding box. Shown approximately to the public.
  latitude          numeric(8, 6) check (latitude between 29.0 and 33.5),
  longitude         numeric(9, 6) check (longitude between 34.8 and 39.4),
  poster_type       public.poster_type not null default 'owner',
  rejection_reason  text check (char_length(rejection_reason) <= 1000),
  submitted_at      timestamptz,
  published_at      timestamptz,
  expires_at        timestamptz,
  status_changed_at timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (neighborhood_id, city_id) references public.neighborhoods (id, city_id),
  check ((latitude is null) = (longitude is null))
);

create trigger listings_set_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

-- Public feed and search (only published rows are indexed for these).
create index listings_public_feed_idx on public.listings (published_at desc, id desc)
  where status = 'published';
create index listings_public_search_idx on public.listings (city_id, deal_type, property_type_id, published_at desc)
  where status = 'published';
create index listings_public_neighborhood_idx on public.listings (neighborhood_id, published_at desc)
  where status = 'published';
create index listings_public_price_idx on public.listings (deal_type, price)
  where status = 'published';
create index listings_expiry_idx on public.listings (expires_at)
  where status = 'published';
-- Seller dashboard and admin queues.
create index listings_seller_idx on public.listings (seller_id, created_at desc);
create index listings_status_idx on public.listings (status, status_changed_at desc);

-- Seller contact details per listing. Private: only readable by the owner,
-- admins, and the server (which applies rate limits before revealing).
create table public.listing_contacts (
  listing_id     bigint primary key references public.listings (id) on delete cascade,
  phone          text not null check (phone ~ '^\+962[0-9]{8,9}$'),
  allow_calls    boolean not null default true,
  allow_whatsapp boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (allow_calls or allow_whatsapp)
);

create trigger listing_contacts_set_updated_at before update on public.listing_contacts
  for each row execute function public.set_updated_at();

-- Photos. Files live in Storage at "<user id>/<listing id>/<uuid>.<ext>".
create table public.listing_images (
  id               uuid primary key default gen_random_uuid(),
  listing_id       bigint not null references public.listings (id) on delete cascade,
  storage_path     text not null unique
                   check (storage_path ~ '^[0-9a-f-]{36}/[0-9]{1,18}/[0-9a-f-]{36}\.(webp|jpg|png)$'),
  position         smallint not null default 0 check (position between 0 and 49),
  width            integer check (width between 1 and 10000),
  height           integer check (height between 1 and 10000),
  -- Set by the server when the photo is copied to the public bucket on publication.
  public_copied_at timestamptz,
  created_at       timestamptz not null default now()
);
create index listing_images_listing_idx on public.listing_images (listing_id, position);

-- History of every listing status change (audit trail).
create table public.listing_status_history (
  id          bigint generated always as identity primary key,
  listing_id  bigint not null references public.listings (id) on delete cascade,
  from_status public.listing_status,
  to_status   public.listing_status not null,
  changed_by  uuid references public.profiles (id) on delete set null,
  reason      text check (char_length(reason) <= 1000),
  created_at  timestamptz not null default now()
);
create index listing_status_history_listing_idx on public.listing_status_history (listing_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Favourites
-- -----------------------------------------------------------------------------
create table public.favourites (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  listing_id bigint not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index favourites_listing_idx on public.favourites (listing_id);

-- -----------------------------------------------------------------------------
-- Reports (listings and users)
-- -----------------------------------------------------------------------------
create table public.listing_reports (
  id              bigint generated always as identity primary key,
  listing_id      bigint not null references public.listings (id) on delete cascade,
  reporter_id     uuid default auth.uid() references public.profiles (id) on delete set null,
  reason          text not null
                  check (reason in ('fraud', 'wrong_info', 'duplicate', 'already_sold', 'inappropriate', 'other')),
  details         text check (char_length(details) <= 1000),
  status          public.report_status not null default 'open',
  resolution_note text check (char_length(resolution_note) <= 1000),
  resolved_by     uuid references public.profiles (id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index listing_reports_status_idx on public.listing_reports (status, created_at desc);
create index listing_reports_listing_idx on public.listing_reports (listing_id);
-- One open report per user per listing.
create unique index listing_reports_one_open_idx on public.listing_reports (listing_id, reporter_id)
  where status in ('open', 'reviewing') and reporter_id is not null;

create table public.user_reports (
  id               bigint generated always as identity primary key,
  reported_user_id uuid not null references public.profiles (id) on delete cascade,
  reporter_id      uuid default auth.uid() references public.profiles (id) on delete set null,
  reason           text not null check (reason in ('fraud', 'spam', 'harassment', 'impersonation', 'other')),
  details          text check (char_length(details) <= 1000),
  status           public.report_status not null default 'open',
  resolution_note  text check (char_length(resolution_note) <= 1000),
  resolved_by      uuid references public.profiles (id) on delete set null,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now(),
  check (reported_user_id <> reporter_id)
);
create index user_reports_status_idx on public.user_reports (status, created_at desc);
create unique index user_reports_one_open_idx on public.user_reports (reported_user_id, reporter_id)
  where status in ('open', 'reviewing') and reporter_id is not null;

-- -----------------------------------------------------------------------------
-- In-site notifications
-- -----------------------------------------------------------------------------
create table public.notifications (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null check (type ~ '^[a-z_]{2,64}$'),
  data       jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Admin audit log (append-only)
-- -----------------------------------------------------------------------------
create table public.admin_audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null check (char_length(action) between 2 and 64),
  entity_type text not null check (char_length(entity_type) between 2 and 64),
  entity_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index admin_audit_logs_entity_idx on public.admin_audit_logs (entity_type, entity_id, created_at desc);
create index admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
