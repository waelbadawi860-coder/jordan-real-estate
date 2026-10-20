-- Floor as a searchable field, and per-type rules (which deals a property type
-- allows, and whether it has a floor). The database enforces both, so the
-- browser form and search are conveniences, not the only check.

-- -----------------------------------------------------------------------------
-- Property type rules
-- -----------------------------------------------------------------------------
alter table public.property_types
  add column has_floor boolean not null default false,
  add column allowed_deals public.deal_type[] not null default '{sale,rent}'
    check (cardinality(allowed_deals) between 1 and 2);

update public.property_types set has_floor = true
  where slug in ('apartment', 'office', 'shop', 'commercial-property');
update public.property_types set allowed_deals = '{sale}'
  where slug in ('residential-land', 'building');

grant insert (has_floor, allowed_deals), update (has_floor, allowed_deals)
  on public.property_types to authenticated;

-- -----------------------------------------------------------------------------
-- Floor column (replaces the free number kept in listings.details)
-- -----------------------------------------------------------------------------
create type public.floor_level as enum (
  'basement', 'ground', 'first', 'second', 'third', 'fourth', 'fifth_plus', 'last'
);

alter table public.listings add column floor_level public.floor_level;

-- Move existing numeric floors into the new column.
update public.listings
set floor_level = case
      when (details ->> 'floor')::numeric < 0 then 'basement'
      when (details ->> 'floor')::numeric = 0 then 'ground'
      when (details ->> 'floor')::numeric = 1 then 'first'
      when (details ->> 'floor')::numeric = 2 then 'second'
      when (details ->> 'floor')::numeric = 3 then 'third'
      when (details ->> 'floor')::numeric = 4 then 'fourth'
      else 'fifth_plus'
    end::public.floor_level,
    details = details - 'floor'
where jsonb_typeof(details -> 'floor') = 'number';

create index listings_public_floor_idx on public.listings (property_type_id, floor_level, published_at desc)
  where status = 'published' and floor_level is not null;

-- Public column list (exact latitude/longitude stay excluded).
grant select (floor_level) on public.listings to anon, authenticated;
grant insert (floor_level), update (floor_level) on public.listings to authenticated;

-- -----------------------------------------------------------------------------
-- Enforce the type rules when the deal, type or floor change
-- -----------------------------------------------------------------------------
create function public.listings_check_type_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.property_types%rowtype;
begin
  if tg_op = 'UPDATE'
     and (new.deal_type, new.property_type_id, new.floor_level)
         is not distinct from (old.deal_type, old.property_type_id, old.floor_level) then
    return new;
  end if;

  select * into v_type from public.property_types where id = new.property_type_id;
  if not (new.deal_type = any (v_type.allowed_deals)) then
    raise exception 'deal_not_allowed_for_type' using errcode = '23514';
  end if;
  if new.floor_level is not null and not v_type.has_floor then
    raise exception 'floor_not_allowed_for_type' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.listings_check_type_rules() from public;

create trigger listings_check_type_rules
  before insert or update on public.listings
  for each row execute function public.listings_check_type_rules();

-- -----------------------------------------------------------------------------
-- Editing a published listing (now including the floor) needs a new review
-- -----------------------------------------------------------------------------
create or replace function public.listings_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;

  -- A seller editing the content of a published or expired listing must not be
  -- able to swap in unreviewed content (bait-and-switch).
  if auth.uid() is not null
     and not public.is_admin()
     and old.status in ('published', 'expired')
     and new.status = old.status
     and public.setting_bool('require_listing_approval', true)
     and (new.deal_type, new.property_type_id, new.city_id, new.neighborhood_id, new.title,
          new.description, new.price, new.area_sqm, new.bedrooms, new.bathrooms, new.details,
          new.latitude, new.longitude, new.poster_type, new.floor_level)
         is distinct from
         (old.deal_type, old.property_type_id, old.city_id, old.neighborhood_id, old.title,
          old.description, old.price, old.area_sqm, old.bedrooms, old.bathrooms, old.details,
          old.latitude, old.longitude, old.poster_type, old.floor_level)
  then
    new.status := 'pending_approval';
    new.submitted_at := now();
    new.status_changed_at := now();
    perform set_config('app.status_reason', 'edited_after_approval', true);
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Which areas have listings, per deal and type (drives the linked search lists)
-- -----------------------------------------------------------------------------
create function public.listing_area_facets()
returns table (deal_type public.deal_type, property_type_id smallint, city_id smallint, neighborhood_id integer, listings bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.deal_type, l.property_type_id, l.city_id, l.neighborhood_id, count(*)
  from public.listings l
  where l.status = 'published' and l.expires_at > now()
  group by 1, 2, 3, 4;
$$;

revoke execute on function public.listing_area_facets() from public;
grant execute on function public.listing_area_facets() to anon, authenticated;
