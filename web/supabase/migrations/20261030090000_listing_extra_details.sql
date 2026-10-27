-- Extra ad details shown on the listing page only (not searchable): building
-- age, "partly furnished", property features, nearby places, and for land the
-- zoning, street frontage and connected services. They live in
-- listings.details (already readable, writable and versioned), and the
-- database accepts only the known keys and values, for the types they fit.
--
-- details keys:
--   rent_period  'monthly' | 'yearly'                    (rent only, unchanged)
--   furnished    'yes' | 'no' | 'partly'                 (types with has_furnished; was a boolean)
--   building_age see listing_building_ages()             (has_building_age)
--   features     array of listing_feature_keys()         (has_amenities)
--   nearby       array of listing_nearby_keys()          (any type)
--   zoning       see listing_zoning_keys()               (has_land_details)
--   frontage_m   whole metres, 1..10000                  (has_land_details)
--   services     array of 'electricity' | 'water' | 'sewage' (has_land_details)

alter table public.property_types
  add column has_building_age boolean not null default false,
  add column has_amenities    boolean not null default false,
  add column has_land_details boolean not null default false;
grant insert (has_building_age, has_amenities, has_land_details), update (has_building_age, has_amenities, has_land_details)
  on public.property_types to authenticated;

update public.property_types set
  has_building_age = slug not in ('residential-land', 'commercial-land'),
  has_amenities    = slug not in ('residential-land', 'commercial-land'),
  has_land_details = slug in ('residential-land', 'commercial-land');

-- "furnished" becomes a word so it can say "partly".
update public.listings
set details = jsonb_set(details, '{furnished}', to_jsonb(case when (details ->> 'furnished')::boolean then 'yes' else 'no' end))
where jsonb_typeof(details -> 'furnished') = 'boolean';

create function public.listing_building_ages() returns text[] language sql immutable set search_path = '' as $$
  select array['under_construction', 'under_1', '1_5', '6_9', '10_19', '20_plus']
$$;
create function public.listing_feature_keys() returns text[] language sql immutable set search_path = '' as $$
  select array[
    -- inside the unit
    'central_heating', 'air_conditioning', 'underfloor_heating', 'maid_room', 'laundry_room',
    'built_in_kitchen', 'balcony', 'double_glazing', 'wardrobes',
    -- the building
    'elevator', 'parking', 'storage', 'garden', 'solar_heater', 'solar_panels',
    'backup_power', 'security', 'pool', 'accessibility']
$$;
create function public.listing_nearby_keys() returns text[] language sql immutable set search_path = '' as $$
  select array['school', 'university', 'mosque', 'hospital', 'pharmacy', 'supermarket', 'mall', 'public_transport', 'main_road']
$$;
create function public.listing_zoning_keys() returns text[] language sql immutable set search_path = '' as $$
  select array['res_a', 'res_b', 'res_c', 'res_d', 'rural', 'commercial', 'industrial', 'agricultural']
$$;

-- True when the value is a JSON array of distinct strings, all from p_allowed.
create function public.jsonb_is_key_list(p_value jsonb, p_allowed text[]) returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_value) = 'array'
     and not exists (
       select 1 from jsonb_array_elements(p_value) e
       where jsonb_typeof(e) <> 'string' or not ((e #>> '{}') = any (p_allowed)))
     and jsonb_array_length(p_value) = (select count(distinct e) from jsonb_array_elements(p_value) e)
$$;

revoke execute on function public.listing_building_ages() from public;
revoke execute on function public.listing_feature_keys() from public;
revoke execute on function public.listing_nearby_keys() from public;
revoke execute on function public.listing_zoning_keys() from public;
revoke execute on function public.jsonb_is_key_list(jsonb, text[]) from public;

create or replace function public.listings_check_type_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.property_types%rowtype;
  v_d jsonb := new.details;
begin
  if tg_op = 'UPDATE'
     and (new.deal_type, new.property_type_id, new.floor_level, new.bedrooms, new.bathrooms, new.floors_count, new.details)
         is not distinct from
         (old.deal_type, old.property_type_id, old.floor_level, old.bedrooms, old.bathrooms, old.floors_count, old.details) then
    return new;
  end if;

  select * into v_type from public.property_types where id = new.property_type_id;
  if not (new.deal_type = any (v_type.allowed_deals)) then
    raise exception 'deal_not_allowed_for_type' using errcode = '23514';
  end if;
  if new.floor_level is not null and not v_type.has_floor then
    raise exception 'floor_not_allowed_for_type' using errcode = '23514';
  end if;
  if new.bedrooms is not null and not v_type.has_bedrooms then
    raise exception 'bedrooms_not_allowed_for_type' using errcode = '23514';
  end if;
  if new.bathrooms is not null and not v_type.has_bathrooms then
    raise exception 'bathrooms_not_allowed_for_type' using errcode = '23514';
  end if;
  if new.floors_count is not null and not v_type.has_floors_count then
    raise exception 'floors_count_not_allowed_for_type' using errcode = '23514';
  end if;

  if exists (select 1 from jsonb_object_keys(v_d) k
             where not (k = any (array['rent_period', 'furnished', 'building_age', 'features', 'nearby', 'zoning', 'frontage_m', 'services']))) then
    raise exception 'unknown_detail' using errcode = '23514';
  end if;
  if v_d ? 'furnished' and not v_type.has_furnished then
    raise exception 'furnished_not_allowed_for_type' using errcode = '23514';
  end if;
  if v_d ? 'building_age' and not v_type.has_building_age then
    raise exception 'building_age_not_allowed_for_type' using errcode = '23514';
  end if;
  if v_d ? 'features' and not v_type.has_amenities then
    raise exception 'amenities_not_allowed_for_type' using errcode = '23514';
  end if;
  if (v_d ? 'zoning' or v_d ? 'frontage_m' or v_d ? 'services') and not v_type.has_land_details then
    raise exception 'land_details_not_allowed_for_type' using errcode = '23514';
  end if;

  if (v_d ? 'rent_period' and (jsonb_typeof(v_d -> 'rent_period') <> 'string' or not ((v_d ->> 'rent_period') = any (array['monthly', 'yearly']))))
     or (v_d ? 'furnished' and (jsonb_typeof(v_d -> 'furnished') <> 'string' or not ((v_d ->> 'furnished') = any (array['yes', 'no', 'partly']))))
     or (v_d ? 'building_age' and (jsonb_typeof(v_d -> 'building_age') <> 'string' or not ((v_d ->> 'building_age') = any (public.listing_building_ages()))))
     or (v_d ? 'zoning' and (jsonb_typeof(v_d -> 'zoning') <> 'string' or not ((v_d ->> 'zoning') = any (public.listing_zoning_keys()))))
     or (v_d ? 'frontage_m' and (jsonb_typeof(v_d -> 'frontage_m') <> 'number' or (v_d ->> 'frontage_m')::numeric not between 1 and 10000
                                 or (v_d ->> 'frontage_m')::numeric <> trunc((v_d ->> 'frontage_m')::numeric)))
     or (v_d ? 'features' and not public.jsonb_is_key_list(v_d -> 'features', public.listing_feature_keys()))
     or (v_d ? 'nearby' and not public.jsonb_is_key_list(v_d -> 'nearby', public.listing_nearby_keys()))
     or (v_d ? 'services' and not public.jsonb_is_key_list(v_d -> 'services', array['electricity', 'water', 'sewage']))
  then
    raise exception 'invalid_detail' using errcode = '23514';
  end if;
  return new;
end;
$$;
