-- Temporary hold: an administrator can hide a published ad while a complaint
-- or suspected fraud is checked, then release it unchanged or take it down.
-- A reason is required and the seller is notified (as for other admin actions).

alter type public.listing_status add value if not exists 'on_hold' after 'published';

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
    if not public.setting_bool('require_listing_approval', true) then
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
