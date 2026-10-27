-- "Is the property mortgaged?" as the seller states it: details.mortgaged
-- 'yes' | 'no', for any property type, shown on the ad page only (not a
-- search filter). Same rule function as before, with the new key allowed.

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
             where not (k = any (array['rent_period', 'furnished', 'building_age', 'features', 'nearby', 'zoning', 'frontage_m', 'services', 'mortgaged']))) then
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
     or (v_d ? 'mortgaged' and (jsonb_typeof(v_d -> 'mortgaged') <> 'string' or not ((v_d ->> 'mortgaged') = any (array['yes', 'no']))))
  then
    raise exception 'invalid_detail' using errcode = '23514';
  end if;
  return new;
end;
$$;
