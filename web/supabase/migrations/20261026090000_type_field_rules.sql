-- Which detail fields make sense for each property type (e.g. land has no
-- bathrooms), and a separate "top floor with roof" choice. The database
-- enforces the rules, so a form can never save a field that doesn't apply.

alter type public.floor_level add value if not exists 'last_with_roof' after 'last';

alter table public.property_types
  add column has_bathrooms boolean not null default true,
  add column has_furnished boolean not null default false;

grant insert (has_bathrooms, has_furnished), update (has_bathrooms, has_furnished)
  on public.property_types to authenticated;

-- Field matrix (admins can change it later from the dashboard):
--                       bedrooms bathrooms floor furnished
--   apartment              ✓        ✓        ✓       ✓
--   villa, house           ✓        ✓        –       ✓
--   office                 –        ✓        ✓       ✓
--   shop, commercial prop. –        ✓        ✓       –
--   land (both), building  –        –        –       –
--   other                  –        ✓        –       –
update public.property_types set has_bathrooms = false
  where slug in ('residential-land', 'commercial-land', 'building');
update public.property_types set has_furnished = true
  where slug in ('apartment', 'villa', 'house', 'office');
update public.property_types set has_bedrooms = (slug in ('apartment', 'villa', 'house'));
update public.property_types set has_floor = (slug in ('apartment', 'office', 'shop', 'commercial-property'));

-- Clear values that no longer apply to their listing's type.
update public.listings l set bathrooms = null
  from public.property_types t
  where t.id = l.property_type_id and not t.has_bathrooms and l.bathrooms is not null;
update public.listings l set bedrooms = null
  from public.property_types t
  where t.id = l.property_type_id and not t.has_bedrooms and l.bedrooms is not null;
update public.listings l set floor_level = null
  from public.property_types t
  where t.id = l.property_type_id and not t.has_floor and l.floor_level is not null;
update public.listings l set details = l.details - 'furnished'
  from public.property_types t
  where t.id = l.property_type_id and not t.has_furnished and l.details ? 'furnished';

-- Enforce all type rules whenever the deal, type or one of the fields changes.
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
     and (new.deal_type, new.property_type_id, new.floor_level, new.bedrooms, new.bathrooms, new.details -> 'furnished')
         is not distinct from
         (old.deal_type, old.property_type_id, old.floor_level, old.bedrooms, old.bathrooms, old.details -> 'furnished') then
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
  if new.details ? 'furnished' and not v_type.has_furnished then
    raise exception 'furnished_not_allowed_for_type' using errcode = '23514';
  end if;
  return new;
end;
$$;
