-- Permanent records: the admin audit log, the listing status history and a new
-- version history of every listing's content can no longer be edited or
-- deleted through the database API, by anyone. The only change allowed is the
-- automatic unlinking of a deleted account (its id becomes empty), which the
-- database itself performs.
--
-- Limits (documented in docs/OPERATIONS.md): the database owner can still
-- remove these triggers, so a copy of the records also goes into the daily
-- encrypted off-site backup.

create function public.forbid_change_except_unlink()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_new jsonb;
  v_old jsonb;
  v_col text;
begin
  if tg_op <> 'UPDATE' then
    raise exception 'record_is_permanent' using errcode = '42501';
  end if;
  v_new := to_jsonb(new);
  v_old := to_jsonb(old);
  -- tg_argv lists the account-reference columns that may be emptied.
  foreach v_col in array tg_argv loop
    if v_new -> v_col <> 'null'::jsonb and v_new -> v_col is distinct from v_old -> v_col then
      raise exception 'record_is_permanent' using errcode = '42501';
    end if;
    v_new := v_new - v_col;
    v_old := v_old - v_col;
  end loop;
  if v_new is distinct from v_old then
    raise exception 'record_is_permanent' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.forbid_change_except_unlink() from public;

create function public.forbid_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'record_is_permanent' using errcode = '42501';
end;
$$;
revoke execute on function public.forbid_truncate() from public;

-- History must survive the deletion of a draft listing, so it no longer
-- cascades from the listing.
alter table public.listing_status_history drop constraint listing_status_history_listing_id_fkey;

create trigger admin_audit_logs_permanent
  before update or delete on public.admin_audit_logs
  for each row execute function public.forbid_change_except_unlink('actor_id');
create trigger admin_audit_logs_no_truncate
  before truncate on public.admin_audit_logs
  for each statement execute function public.forbid_truncate();

create trigger listing_status_history_permanent
  before update or delete on public.listing_status_history
  for each row execute function public.forbid_change_except_unlink('changed_by');
create trigger listing_status_history_no_truncate
  before truncate on public.listing_status_history
  for each statement execute function public.forbid_truncate();

create trigger listing_declarations_no_truncate
  before truncate on public.listing_declarations
  for each statement execute function public.forbid_truncate();

-- -----------------------------------------------------------------------------
-- Version history of listing content, contact details and photos
-- -----------------------------------------------------------------------------
create table public.listing_versions (
  id         bigint generated always as identity primary key,
  listing_id bigint not null,               -- no foreign key: kept after the listing is gone
  kind       text not null check (kind in ('content', 'contact', 'photo_added', 'photo_removed')),
  changed_by uuid,                          -- empty when the change was made by the system
  data       jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now()
);
create index listing_versions_listing_idx on public.listing_versions (listing_id, created_at, id);

alter table public.listing_versions enable row level security;
grant select on public.listing_versions to authenticated;
-- Only administrators read it (it includes exact map positions and phone numbers).
create policy "listing versions: admins read" on public.listing_versions
  for select to authenticated using ((select public.is_admin()));

create trigger listing_versions_permanent
  before update or delete on public.listing_versions
  for each row execute function public.forbid_change_except_unlink('changed_by');
create trigger listing_versions_no_truncate
  before truncate on public.listing_versions
  for each statement execute function public.forbid_truncate();

create function public.record_listing_version()
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
      'floor_level', new.floor_level, 'details', new.details, 'poster_type', new.poster_type,
      'latitude', new.latitude, 'longitude', new.longitude);
    if tg_op = 'UPDATE' then
      v_old := jsonb_build_object(
        'title', old.title, 'description', old.description, 'price', old.price,
        'deal_type', old.deal_type, 'property_type_id', old.property_type_id,
        'city_id', old.city_id, 'neighborhood_id', old.neighborhood_id,
        'area_sqm', old.area_sqm, 'bedrooms', old.bedrooms, 'bathrooms', old.bathrooms,
        'floor_level', old.floor_level, 'details', old.details, 'poster_type', old.poster_type,
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
revoke execute on function public.record_listing_version() from public;

create trigger listings_record_version
  after insert or update on public.listings
  for each row execute function public.record_listing_version();
create trigger listing_contacts_record_version
  after insert or update on public.listing_contacts
  for each row execute function public.record_listing_version();
create trigger listing_images_record_version
  after insert or delete on public.listing_images
  for each row execute function public.record_listing_version();

-- Starting point for listings that already exist.
insert into public.listing_versions (listing_id, kind, changed_by, data)
select l.id, 'content', null, jsonb_build_object(
  'title', l.title, 'description', l.description, 'price', l.price,
  'deal_type', l.deal_type, 'property_type_id', l.property_type_id,
  'city_id', l.city_id, 'neighborhood_id', l.neighborhood_id,
  'area_sqm', l.area_sqm, 'bedrooms', l.bedrooms, 'bathrooms', l.bathrooms,
  'floor_level', l.floor_level, 'details', l.details, 'poster_type', l.poster_type,
  'latitude', l.latitude, 'longitude', l.longitude)
from public.listings l;
