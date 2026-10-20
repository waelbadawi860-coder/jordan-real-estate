-- Per-type fields, round 2 (owner review 2026-10-20):
--   apartment, other     : + bathrooms (already allowed)
--   villa                : no floor; + number of floors; bathrooms
--   residential/commercial land : no bedrooms, no floor (already so)
--   commercial property  : no floor, no bedrooms; + number of floors
--   office, shop         : no bedrooms; bathrooms
--   building, house      : no floor; + number of floors
-- "Number of floors" is a new searchable column; the database enforces it
-- like the other per-type fields.

alter table public.property_types add column has_floors_count boolean not null default false;
grant insert (has_floors_count), update (has_floors_count) on public.property_types to authenticated;

update public.property_types set has_floors_count = (slug in ('villa', 'house', 'building', 'commercial-property'));
update public.property_types set has_floor = (slug in ('apartment', 'office', 'shop'));
update public.property_types set has_bedrooms = (slug in ('apartment', 'villa', 'house'));
update public.property_types set has_bathrooms = true where slug in ('apartment', 'other', 'villa', 'office', 'shop');

alter table public.listings add column floors_count smallint check (floors_count between 1 and 100);
grant select (floors_count) on public.listings to anon, authenticated;
grant insert (floors_count), update (floors_count) on public.listings to authenticated;

-- Clear floors that no longer apply (commercial property).
update public.listings l set floor_level = null
  from public.property_types t
  where t.id = l.property_type_id and not t.has_floor and l.floor_level is not null;

create or replace function public.listings_check_type_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type public.property_types%rowtype;
begin
  if tg_op = 'UPDATE'
     and (new.deal_type, new.property_type_id, new.floor_level, new.bedrooms, new.bathrooms, new.floors_count, new.details -> 'furnished')
         is not distinct from
         (old.deal_type, old.property_type_id, old.floor_level, old.bedrooms, old.bathrooms, old.floors_count, old.details -> 'furnished') then
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
  if new.details ? 'furnished' and not v_type.has_furnished then
    raise exception 'furnished_not_allowed_for_type' using errcode = '23514';
  end if;
  return new;
end;
$$;

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
          new.latitude, new.longitude, new.poster_type, new.floor_level, new.floors_count)
         is distinct from
         (old.deal_type, old.property_type_id, old.city_id, old.neighborhood_id, old.title,
          old.description, old.price, old.area_sqm, old.bedrooms, old.bathrooms, old.details,
          old.latitude, old.longitude, old.poster_type, old.floor_level, old.floors_count)
  then
    new.status := 'pending_approval';
    new.submitted_at := now();
    new.status_changed_at := now();
    perform set_config('app.status_reason', 'edited_after_approval', true);
  -- With automatic publishing on, an edit that adds risky text (payment
  -- requests, links, phone numbers) still goes back to review.
  elsif auth.uid() is not null
     and not public.is_admin()
     and old.status = 'published'
     and new.status = old.status
     and (new.title, new.description) is distinct from (old.title, old.description)
     and cardinality(public.text_risk_flags(new.title || ' ' || new.description)) > 0
  then
    new.status := 'pending_approval';
    new.submitted_at := now();
    new.status_changed_at := now();
    perform set_config('app.status_reason', 'edited_risky_text', true);
  end if;

  return new;
end;
$$;

create or replace function public.record_listing_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb;
  v_old jsonb;
begin
  if tg_table_name = 'listings' then
    v_new := jsonb_build_object(
      'title', new.title, 'description', new.description, 'price', new.price,
      'deal_type', new.deal_type, 'property_type_id', new.property_type_id,
      'city_id', new.city_id, 'neighborhood_id', new.neighborhood_id,
      'area_sqm', new.area_sqm, 'bedrooms', new.bedrooms, 'bathrooms', new.bathrooms,
      'floor_level', new.floor_level, 'floors_count', new.floors_count, 'details', new.details, 'poster_type', new.poster_type,
      'latitude', new.latitude, 'longitude', new.longitude);
    if tg_op = 'UPDATE' then
      v_old := jsonb_build_object(
        'title', old.title, 'description', old.description, 'price', old.price,
        'deal_type', old.deal_type, 'property_type_id', old.property_type_id,
        'city_id', old.city_id, 'neighborhood_id', old.neighborhood_id,
        'area_sqm', old.area_sqm, 'bedrooms', old.bedrooms, 'bathrooms', old.bathrooms,
        'floor_level', old.floor_level, 'floors_count', old.floors_count, 'details', old.details, 'poster_type', old.poster_type,
        'latitude', old.latitude, 'longitude', old.longitude);
      if v_new = v_old then
        return null;
      end if;
    end if;
    insert into public.listing_versions (listing_id, kind, changed_by, data)
    values (new.id, 'content', auth.uid(), v_new);

  elsif tg_table_name = 'listing_contacts' then
    if tg_op = 'UPDATE' and (new.phone, new.allow_calls, new.allow_whatsapp)
                            is not distinct from (old.phone, old.allow_calls, old.allow_whatsapp) then
      return null;
    end if;
    insert into public.listing_versions (listing_id, kind, changed_by, data)
    values (new.listing_id, 'contact', auth.uid(),
            jsonb_build_object('phone', new.phone, 'allow_calls', new.allow_calls, 'allow_whatsapp', new.allow_whatsapp));

  elsif tg_table_name = 'listing_images' then
    if tg_op = 'INSERT' then
      insert into public.listing_versions (listing_id, kind, changed_by, data)
      values (new.listing_id, 'photo_added', auth.uid(), jsonb_build_object('path', new.storage_path));
    else
      insert into public.listing_versions (listing_id, kind, changed_by, data)
      values (old.listing_id, 'photo_removed', auth.uid(), jsonb_build_object('path', old.storage_path));
    end if;
  end if;
  return null;
end;
$$;
