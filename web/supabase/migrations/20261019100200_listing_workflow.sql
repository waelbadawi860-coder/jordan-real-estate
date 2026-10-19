-- =============================================================================
-- Listing workflow: posting limits, status transitions, re-approval after
-- edits, expiry job, admin account actions, report handling and audit logging.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- New listing checks: daily limit and duplicate protection (server-enforced)
-- -----------------------------------------------------------------------------
create function public.listings_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
begin
  -- Fields a user can never choose on creation.
  new.status := 'draft';
  new.rejection_reason := null;
  new.submitted_at := null;
  new.published_at := null;
  new.expires_at := null;
  new.status_changed_at := now();

  -- Trusted server code (no logged-in user) and admins are exempt from limits.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  -- Serialise concurrent inserts by the same seller so the limit can't be raced.
  perform pg_advisory_xact_lock(hashtextextended('listing_insert:' || new.seller_id::text, 0));

  if exists (
    select 1 from public.listings
    where seller_id = new.seller_id
      and lower(btrim(title)) = lower(btrim(new.title))
      and created_at > now() - interval '10 minutes'
  ) then
    raise exception 'duplicate_listing' using errcode = 'P0001';
  end if;

  v_limit := public.setting_int('max_new_listings_per_24h', 3);
  select count(*) into v_count
  from public.listings
  where seller_id = new.seller_id and created_at > now() - interval '24 hours';

  if v_count >= v_limit then
    raise exception 'listing_limit_reached'
      using errcode = 'P0001', detail = format('Limit is %s new listings per 24 hours.', v_limit);
  end if;

  return new;
end;
$$;

create trigger listings_before_insert
  before insert on public.listings
  for each row execute function public.listings_before_insert();

-- -----------------------------------------------------------------------------
-- Before update: send edited, already-approved listings back for re-approval.
-- -----------------------------------------------------------------------------
create function public.listings_before_update()
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
          new.latitude, new.longitude, new.poster_type)
         is distinct from
         (old.deal_type, old.property_type_id, old.city_id, old.neighborhood_id, old.title,
          old.description, old.price, old.area_sqm, old.bedrooms, old.bathrooms, old.details,
          old.latitude, old.longitude, old.poster_type)
  then
    new.status := 'pending_approval';
    new.submitted_at := now();
    new.status_changed_at := now();
    perform set_config('app.status_reason', 'edited_after_approval', true);
  end if;

  return new;
end;
$$;

create trigger listings_before_update
  before update on public.listings
  for each row execute function public.listings_before_update();

-- After update: record every status change in the history table.
create function public.listings_after_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.listing_status_history (listing_id, from_status, to_status, changed_by, reason)
  values (
    new.id,
    old.status,
    new.status,
    auth.uid(),
    nullif(current_setting('app.status_reason', true), '')
  );
  return null;
end;
$$;

create trigger listings_after_status_change
  after update of status on public.listings
  for each row
  when (old.status is distinct from new.status)
  execute function public.listings_after_status_change();

-- Record the initial "draft" state too.
create function public.listings_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.listing_status_history (listing_id, from_status, to_status, changed_by)
  values (new.id, null, new.status, auth.uid());
  return null;
end;
$$;

create trigger listings_after_insert
  after insert on public.listings
  for each row execute function public.listings_after_insert();

-- -----------------------------------------------------------------------------
-- Photo count limit per listing
-- -----------------------------------------------------------------------------
create function public.listing_images_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('listing_images:' || new.listing_id::text, 0));
  select count(*) into v_count from public.listing_images where listing_id = new.listing_id;
  if v_count >= public.setting_int('max_images_per_listing', 20) then
    raise exception 'image_limit_reached' using errcode = 'P0001';
  end if;
  new.public_copied_at := null;
  return new;
end;
$$;

create trigger listing_images_before_insert
  before insert on public.listing_images
  for each row execute function public.listing_images_before_insert();

-- -----------------------------------------------------------------------------
-- Status transitions (the ONLY way a user or admin changes listing status)
-- -----------------------------------------------------------------------------
create function public.change_listing_status(
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
      'draft>archived', 'rejected>archived', 'withdrawn>archived',
      'expired>archived', 'sold>archived', 'rented>archived'
    ]);
  end if;

  if not v_allowed and v_is_admin then
    v_allowed := v_transition = any (array[
      'pending_approval>published', 'expired>published',
      'pending_approval>rejected', 'published>rejected',
      'published>expired'
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
  if p_new_status = 'rejected' and v_reason is null then
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
    if not public.setting_bool('require_listing_approval', true) then
      v_target := 'published';
    end if;
  end if;

  perform set_config('app.status_reason', coalesce(v_reason, ''), true);

  update public.listings
  set status           = v_target,
      submitted_at     = case when p_new_status = 'pending_approval' then now() else submitted_at end,
      published_at     = case when v_target = 'published' then now() else published_at end,
      expires_at       = case when v_target = 'published'
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

grant execute on function public.change_listing_status(bigint, public.listing_status, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Renewal: owner extends a published listing near its expiry, or republishes
-- an expired one whose content was already approved.
-- -----------------------------------------------------------------------------
create function public.renew_listing(p_listing_id bigint)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
  v_days    integer := public.setting_int('listing_expiry_days', 30);
  v_window  integer := public.setting_int('renewal_window_days', 7);
  v_expires timestamptz := now() + make_interval(days => v_days);
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_active_user() then
    raise exception 'account_not_active' using errcode = '42501';
  end if;

  select * into v_listing from public.listings
  where id = p_listing_id and seller_id = auth.uid()
  for update;
  if not found then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;

  if v_listing.status = 'published' then
    if v_listing.expires_at > now() + make_interval(days => v_window) then
      raise exception 'renewal_not_yet_available' using errcode = 'P0001';
    end if;
  elsif v_listing.status <> 'expired' then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;

  perform set_config('app.status_reason', 'renewed', true);
  update public.listings
  set status = 'published',
      expires_at = v_expires,
      published_at = case when v_listing.status = 'expired' then now() else published_at end
  where id = p_listing_id;

  return v_expires;
end;
$$;

grant execute on function public.renew_listing(bigint) to authenticated;

-- -----------------------------------------------------------------------------
-- Expiry job (run hourly by pg_cron; not callable from the browser)
-- -----------------------------------------------------------------------------
create function public.expire_listings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform set_config('app.status_reason', 'expired_automatically', true);
  update public.listings
  set status = 'expired'
  where status = 'published' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create extension if not exists pg_cron;
select cron.schedule('expire-listings', '5 * * * *', $$select public.expire_listings();$$);

-- -----------------------------------------------------------------------------
-- Contact details: server-only lookup for published listings.
-- The server applies rate limits before calling this with the secret key.
-- -----------------------------------------------------------------------------
create function public.get_listing_contact(p_listing_id bigint)
returns table (phone text, allow_calls boolean, allow_whatsapp boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select c.phone, c.allow_calls, c.allow_whatsapp
  from public.listing_contacts c
  join public.listings l on l.id = c.listing_id
  where c.listing_id = p_listing_id
    and l.status = 'published'
    and l.expires_at > now();
$$;

grant execute on function public.get_listing_contact(bigint) to service_role;

-- Public seller name (no email or phone).
create function public.public_seller_info(p_seller_id uuid)
returns table (display_name text, member_since date)
language sql
stable
security definer
set search_path = ''
as $$
  select p.display_name, p.created_at::date
  from public.profiles p
  where p.id = p_seller_id and p.status = 'active';
$$;

grant execute on function public.public_seller_info(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Account actions
-- -----------------------------------------------------------------------------
create function public.admin_set_user_status(
  p_user_id uuid,
  p_status public.account_status,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.account_status;
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot_change_own_status' using errcode = 'P0001';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'unsupported_status' using errcode = 'P0001';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select status into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  update public.profiles
  set status = p_status, status_reason = left(p_reason, 500), status_changed_at = now()
  where id = p_user_id;

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'user_status_change', 'profile', p_user_id::text,
          jsonb_build_object('from', v_old, 'to', p_status, 'reason', p_reason));
end;
$$;

grant execute on function public.admin_set_user_status(uuid, public.account_status, text) to authenticated;

create function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  update public.profiles
  set status = 'deletion_requested', deletion_requested_at = now(), status_changed_at = now()
  where id = auth.uid() and status in ('active', 'suspended');
end;
$$;

grant execute on function public.request_account_deletion() to authenticated;

-- -----------------------------------------------------------------------------
-- Reports: daily limit for reporters; record who resolved them.
-- -----------------------------------------------------------------------------
create function public.reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    return new;
  end if;
  select (select count(*) from public.listing_reports
          where reporter_id = auth.uid() and created_at > now() - interval '24 hours')
       + (select count(*) from public.user_reports
          where reporter_id = auth.uid() and created_at > now() - interval '24 hours')
  into v_count;
  if v_count >= public.setting_int('max_reports_per_24h', 10) then
    raise exception 'report_limit_reached' using errcode = 'P0001';
  end if;
  new.status := 'open';
  return new;
end;
$$;

create trigger listing_reports_before_insert before insert on public.listing_reports
  for each row execute function public.reports_before_insert();
create trigger user_reports_before_insert before insert on public.user_reports
  for each row execute function public.reports_before_insert();

create function public.reports_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('resolved', 'dismissed') and old.status not in ('resolved', 'dismissed') then
    new.resolved_by := auth.uid();
    new.resolved_at := now();
  elsif new.status in ('open', 'reviewing') then
    new.resolved_by := null;
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

create trigger listing_reports_before_update before update on public.listing_reports
  for each row execute function public.reports_before_update();
create trigger user_reports_before_update before update on public.user_reports
  for each row execute function public.reports_before_update();

-- -----------------------------------------------------------------------------
-- Generic audit trigger for admin-managed tables
-- -----------------------------------------------------------------------------
create function public.audit_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  if auth.uid() is not null then
    insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
    values (
      auth.uid(),
      lower(tg_op),
      tg_table_name,
      coalesce(v_row ->> 'id', v_row ->> 'key'),
      jsonb_build_object(
        'old', case when tg_op = 'INSERT' then null else to_jsonb(old) end,
        'new', case when tg_op = 'DELETE' then null else to_jsonb(new) end
      )
    );
  end if;
  return null;
end;
$$;

create function public.site_settings_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger site_settings_before_write before insert or update on public.site_settings
  for each row execute function public.site_settings_before_write();

create trigger site_settings_audit after insert or update or delete on public.site_settings
  for each row execute function public.audit_admin_change();
create trigger cities_audit after insert or update or delete on public.cities
  for each row execute function public.audit_admin_change();
create trigger neighborhoods_audit after insert or update or delete on public.neighborhoods
  for each row execute function public.audit_admin_change();
create trigger property_types_audit after insert or update or delete on public.property_types
  for each row execute function public.audit_admin_change();
create trigger listing_reports_audit after update on public.listing_reports
  for each row execute function public.audit_admin_change();
create trigger user_reports_audit after update on public.user_reports
  for each row execute function public.audit_admin_change();
