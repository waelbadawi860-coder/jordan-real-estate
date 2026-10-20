-- Basic fraud checks.
--
-- 1. A block list of phone numbers and e-mail addresses (admin-managed).
--    Blocked phones can't be used on ads; blocked e-mails can't register.
-- 2. A fingerprint of every photo, so the same picture in another ad is found
--    even after resizing or re-compression.
-- 3. Risk signals worked out when an ad is submitted. Any signal sends the ad
--    to manual review, even when automatic publishing is switched on. The
--    signals are shown to administrators only; nothing is decided
--    automatically against the seller.

-- -----------------------------------------------------------------------------
-- 1. Block list
-- -----------------------------------------------------------------------------
create table public.blocked_identifiers (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('phone', 'email')),
  value      text not null check (char_length(value) between 3 and 254),
  reason     text not null check (char_length(btrim(reason)) between 2 and 500),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (kind, value),
  check (kind <> 'phone' or value ~ '^\+962[0-9]{8,9}$'),
  check (kind <> 'email' or value = lower(btrim(value)))
);
alter table public.blocked_identifiers enable row level security;
grant select, insert (kind, value, reason), delete on public.blocked_identifiers to authenticated;
create policy "block list: admins read" on public.blocked_identifiers
  for select to authenticated using ((select public.is_admin()));
create policy "block list: admins add" on public.blocked_identifiers
  for insert to authenticated with check ((select public.is_admin()));
create policy "block list: admins remove" on public.blocked_identifiers
  for delete to authenticated using ((select public.is_admin()));
create trigger blocked_identifiers_audit after insert or update or delete on public.blocked_identifiers
  for each row execute function public.audit_admin_change();

create function public.is_blocked(p_kind text, p_value text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocked_identifiers
    where kind = p_kind and value = case when p_kind = 'email' then lower(btrim(p_value)) else p_value end
  );
$$;
revoke execute on function public.is_blocked(text, text) from public;

create function public.contacts_check_blocked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_blocked('phone', new.phone) then
    raise exception 'phone_blocked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.contacts_check_blocked() from public;
create trigger listing_contacts_check_blocked
  before insert or update of phone on public.listing_contacts
  for each row execute function public.contacts_check_blocked();

create function public.auth_users_check_blocked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null and public.is_blocked('email', new.email) then
    raise exception 'email_blocked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.auth_users_check_blocked() from public;
create trigger auth_users_check_blocked
  before insert on auth.users
  for each row execute function public.auth_users_check_blocked();

-- -----------------------------------------------------------------------------
-- 2. Photo fingerprints (64-bit difference hash, written by the server)
-- -----------------------------------------------------------------------------
alter table public.listing_images add column phash bit(64);
revoke update (phash) on public.listing_images from authenticated;

-- -----------------------------------------------------------------------------
-- 3. Risk signals
-- -----------------------------------------------------------------------------
create table public.listing_risk (
  listing_id bigint primary key references public.listings (id) on delete cascade,
  flags      text[] not null default '{}',
  checked_at timestamptz not null default now()
);
alter table public.listing_risk enable row level security;
grant select on public.listing_risk to authenticated;
create policy "listing risk: admins read" on public.listing_risk
  for select to authenticated using ((select public.is_admin()));

-- Signals that can be read from the text alone (also used when a live ad is edited).
create function public.text_risk_flags(p_text text)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text   text := lower(coalesce(p_text, ''));
  v_digits text;
  v_flags  text[] := '{}';
begin
  -- Arabic-Indic and Persian digits to 0-9, then drop spaces and dashes between digits.
  v_text := translate(v_text, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');
  v_digits := regexp_replace(v_text, '[\s\-\.\(\)]', '', 'g');

  if v_text ~ '(عربون|دفعة مقدمة|دفعه مقدمه|مقدم الحجز|حوالة|حواله|تحويل (مبلغ|المبلغ|بنكي)|حوّل|ويسترن|موني ?جرام|زين ?كاش|كليك|محفظة الكترونية|محفظة إلكترونية|western ?union|money ?gram|cliq|zain ?cash|deposit|wire transfer|bank transfer|send (the )?money)' then
    v_flags := v_flags || 'payment_request';
  end if;
  if v_text ~ '(https?://|www\.|wa\.me|t\.me|bit\.ly|\.(com|net|org|jo|me|ly|io|info)([^a-z]|$))' then
    v_flags := v_flags || 'external_link';
  end if;
  if v_digits ~ '((\+|00)?962|0)?7[789][0-9]{7}' then
    v_flags := v_flags || 'phone_in_text';
  end if;
  if v_text ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
    v_flags := v_flags || 'email_in_text';
  end if;
  return v_flags;
end;
$$;
revoke execute on function public.text_risk_flags(text) from public;

create function public.listing_risk_flags(p_listing_id bigint)
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
    v_flags := v_flags || 'new_account';
  end if;

  -- Open reports against the seller, or against two or more of their ads.
  if exists (select 1 from public.user_reports where reported_user_id = v_listing.seller_id and status in ('open', 'reviewing'))
     or (select count(distinct r.listing_id) from public.listing_reports r join public.listings l on l.id = r.listing_id
         where l.seller_id = v_listing.seller_id and r.status in ('open', 'reviewing')) >= 2 then
    v_flags := v_flags || 'reported_seller';
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
    v_flags := v_flags || 'price_far_below_similar';
  end if;

  -- The same (or nearly the same) photo in another ad.
  if exists (
    select 1
    from public.listing_images mine
    join public.listing_images other on other.listing_id <> mine.listing_id and other.phash is not null
    where mine.listing_id = p_listing_id and mine.phash is not null
      and bit_count(mine.phash # other.phash) <= 6
  ) then
    v_flags := v_flags || 'duplicate_photo';
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
          where ri.listing_id = removed.id and ri.phash is not null and bit_count(ri.phash # mi.phash) <= 6
        )
      )
  ) then
    v_flags := v_flags || 'matches_removed_ad';
  end if;

  -- The same phone on ads of two or more other accounts.
  if v_phone is not null and (
    select count(distinct l.seller_id) from public.listing_contacts c join public.listings l on l.id = c.listing_id
    where c.phone = v_phone and l.seller_id <> v_listing.seller_id
  ) >= 2 then
    v_flags := v_flags || 'shared_phone';
  end if;

  return v_flags;
end;
$$;
revoke execute on function public.listing_risk_flags(bigint) from public;

-- Administrators can re-run the check from the dashboard.
create function public.admin_recheck_listing_risk(p_listing_id bigint)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_flags text[];
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_flags := public.listing_risk_flags(p_listing_id);
  insert into public.listing_risk (listing_id, flags, checked_at) values (p_listing_id, v_flags, now())
  on conflict (listing_id) do update set flags = excluded.flags, checked_at = excluded.checked_at;
  return v_flags;
end;
$$;
revoke execute on function public.admin_recheck_listing_risk(bigint) from public;
grant execute on function public.admin_recheck_listing_risk(bigint) to authenticated;

-- Submission: save the signals; automatic publishing only when there are none.
create or replace function public.change_listing_status(
  p_listing_id bigint,
  p_new_status public.listing_status,
  p_reason text default null
)
returns public.listing_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid               uuid := auth.uid();
  v_is_admin          boolean := public.is_admin();
  v_listing           public.listings%rowtype;
  v_is_owner          boolean;
  v_transition        text;
  v_allowed           boolean := false;
  v_target            public.listing_status := p_new_status;
  v_reason            text := nullif(btrim(coalesce(p_reason, '')), '');
  v_flags             text[];
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if v_reason is not null and char_length(v_reason) > 1000 then
    raise exception 'reason_too_long' using errcode = '22001';
  end if;

  select * into v_listing from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;

  v_is_owner := v_listing.seller_id = v_uid;
  if not v_is_owner and not v_is_admin then
    -- Same error as "not found" so other users' listing IDs can't be probed.
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;
  if not v_is_admin and not public.is_active_user() then
    raise exception 'account_not_active' using errcode = '42501';
  end if;

  v_transition := v_listing.status::text || '>' || p_new_status::text;

  if v_is_owner then
    v_allowed := v_transition = any (array[
      'draft>pending_approval',
      'rejected>pending_approval',
      'withdrawn>pending_approval',
      'expired>pending_approval',
      'pending_approval>draft',
      'published>sold', 'published>rented', 'published>withdrawn',
      'expired>sold', 'expired>rented', 'expired>withdrawn',
      'pending_approval>withdrawn',
      'on_hold>withdrawn',
      'draft>archived', 'rejected>archived', 'withdrawn>archived',
      'expired>archived', 'sold>archived', 'rented>archived'
    ]);
  end if;

  if not v_allowed and v_is_admin then
    v_allowed := v_transition = any (array[
      'pending_approval>published', 'expired>published',
      'pending_approval>rejected', 'published>rejected',
      'published>expired',
      'published>on_hold', 'on_hold>published', 'on_hold>rejected'
    ]) or (p_new_status = 'archived' and v_listing.status <> 'archived');
  end if;

  if not v_allowed then
    raise exception 'invalid_status_transition'
      using errcode = 'P0001', detail = v_transition;
  end if;

  if p_new_status = 'sold' and v_listing.deal_type <> 'sale' then
    raise exception 'sold_requires_sale_listing' using errcode = 'P0001';
  end if;
  if p_new_status = 'rented' and v_listing.deal_type <> 'rent' then
    raise exception 'rented_requires_rent_listing' using errcode = 'P0001';
  end if;
  if p_new_status in ('rejected', 'on_hold') and v_reason is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  -- Submitting for review: check the listing is complete.
  if p_new_status = 'pending_approval' then
    if not exists (select 1 from public.listing_contacts where listing_id = p_listing_id) then
      raise exception 'contact_required' using errcode = 'P0001';
    end if;
    if (select count(*) from public.listing_images where listing_id = p_listing_id)
       < public.setting_int('min_images_per_listing', 1) then
      raise exception 'images_required' using errcode = 'P0001';
    end if;
    -- Risk signals are saved for the reviewers; any signal means manual review.
    v_flags := public.listing_risk_flags(p_listing_id);
    insert into public.listing_risk (listing_id, flags, checked_at) values (p_listing_id, v_flags, now())
    on conflict (listing_id) do update set flags = excluded.flags, checked_at = excluded.checked_at;
    if not public.setting_bool('require_listing_approval', true) and cardinality(v_flags) = 0 then
      v_target := 'published';
    end if;
  end if;

  perform set_config('app.status_reason', coalesce(v_reason, ''), true);

  update public.listings
  set status           = v_target,
      submitted_at     = case when p_new_status = 'pending_approval' then now() else submitted_at end,
      -- Releasing a held ad keeps its original dates (with at least 3 days left).
      published_at     = case when v_target = 'published' and v_listing.status <> 'on_hold' then now() else published_at end,
      expires_at       = case when v_target = 'published' and v_listing.status = 'on_hold'
                              then greatest(expires_at, now() + interval '3 days')
                              when v_target = 'published'
                              then now() + make_interval(days => public.setting_int('listing_expiry_days', 30))
                              else expires_at end,
      rejection_reason = case when v_target = 'rejected' then v_reason
                              when v_target in ('pending_approval', 'published') then null
                              else rejection_reason end
  where id = p_listing_id;

  -- Admin acting on someone else's listing: audit + tell the owner.
  if v_is_admin and not v_is_owner then
    insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
    values (v_uid, 'listing_status_change', 'listing', p_listing_id::text,
            jsonb_build_object('from', v_listing.status, 'to', v_target, 'reason', v_reason));

    insert into public.notifications (user_id, type, data)
    values (v_listing.seller_id, 'listing_status_changed',
            jsonb_build_object('listing_id', p_listing_id, 'status', v_target, 'reason', v_reason));
  end if;

  return v_target;
end;
$$;

-- Edits to a live ad.
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
