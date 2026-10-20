-- Photo match tolerance: measured on test images, re-compressed and resized
-- copies differ by up to 7 of 64 bits and different photos by 18 or more.
create or replace function public.listing_risk_flags(p_listing_id bigint)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
  v_flags   text[];
  v_median  numeric;
  v_samples integer;
  v_phone   text;
begin
  select * into v_listing from public.listings where id = p_listing_id;
  if not found then
    return '{}';
  end if;
  v_flags := public.text_risk_flags(v_listing.title || ' ' || v_listing.description);

  -- Account younger than 7 days.
  if exists (select 1 from public.profiles where id = v_listing.seller_id and created_at > now() - interval '7 days') then
    v_flags := array_append(v_flags, 'new_account');
  end if;

  -- Open reports against the seller, or against two or more of their ads.
  if exists (select 1 from public.user_reports where reported_user_id = v_listing.seller_id and status in ('open', 'reviewing'))
     or (select count(distinct r.listing_id) from public.listing_reports r join public.listings l on l.id = r.listing_id
         where l.seller_id = v_listing.seller_id and r.status in ('open', 'reviewing')) >= 2 then
    v_flags := array_append(v_flags, 'reported_seller');
  end if;

  -- Price far below similar ads (same type, deal and city; at least 5 to compare).
  select percentile_cont(0.5) within group (order by price), count(*)
    into v_median, v_samples
  from public.listings
  where status = 'published' and id <> p_listing_id
    and property_type_id = v_listing.property_type_id
    and deal_type = v_listing.deal_type
    and city_id = v_listing.city_id;
  if v_samples >= 5 and v_listing.price < v_median * 0.3 then
    v_flags := array_append(v_flags, 'price_far_below_similar');
  end if;

  -- The same (or nearly the same) photo in another ad.
  if exists (
    select 1
    from public.listing_images mine
    join public.listing_images other on other.listing_id <> mine.listing_id and other.phash is not null
    where mine.listing_id = p_listing_id and mine.phash is not null
      and bit_count(mine.phash # other.phash) <= 8
  ) then
    v_flags := array_append(v_flags, 'duplicate_photo');
  end if;

  -- Phone or photo of an ad rejected or taken down in the last year.
  select phone into v_phone from public.listing_contacts where listing_id = p_listing_id;
  if exists (
    select 1 from public.listings removed
    where removed.status = 'rejected' and removed.id <> p_listing_id
      and removed.status_changed_at > now() - interval '365 days'
      and (
        exists (select 1 from public.listing_contacts c where c.listing_id = removed.id and c.phone = v_phone)
        or exists (
          select 1 from public.listing_images ri
          join public.listing_images mi on mi.listing_id = p_listing_id and mi.phash is not null
          where ri.listing_id = removed.id and ri.phash is not null and bit_count(ri.phash # mi.phash) <= 8
        )
      )
  ) then
    v_flags := array_append(v_flags, 'matches_removed_ad');
  end if;

  -- The same phone on ads of two or more other accounts.
  if v_phone is not null and (
    select count(distinct l.seller_id) from public.listing_contacts c join public.listings l on l.id = c.listing_id
    where c.phone = v_phone and l.seller_id <> v_listing.seller_id
  ) >= 2 then
    v_flags := array_append(v_flags, 'shared_phone');
  end if;

  return v_flags;
end;
$$;
