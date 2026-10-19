-- =============================================================================
-- Stage 5: administrator dashboard support.
-- Every function here checks is_admin() itself, so calling it from a browser
-- as a normal user fails even though authenticated users may execute it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Contact / "report a problem" messages (written only by trusted server code)
-- -----------------------------------------------------------------------------
create table public.contact_messages (
  id              bigint generated always as identity primary key,
  user_id         uuid references public.profiles (id) on delete set null,
  name            text check (char_length(name) <= 80),
  email           text check (char_length(email) <= 254),
  topic           text not null check (topic in ('general', 'problem', 'privacy', 'account')),
  message         text not null check (char_length(btrim(message)) between 5 and 3000),
  status          public.report_status not null default 'open',
  resolution_note text check (char_length(resolution_note) <= 1000),
  resolved_by     uuid references public.profiles (id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index contact_messages_status_idx on public.contact_messages (status, created_at desc);

alter table public.contact_messages enable row level security;
grant select on public.contact_messages to authenticated;
grant update (status, resolution_note) on public.contact_messages to authenticated;

create policy "contact messages: admins read" on public.contact_messages
  for select to authenticated using ((select public.is_admin()));
create policy "contact messages: admins resolve" on public.contact_messages
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create trigger contact_messages_before_update before update on public.contact_messages
  for each row execute function public.reports_before_update();
create trigger contact_messages_audit after update on public.contact_messages
  for each row execute function public.audit_admin_change();

-- -----------------------------------------------------------------------------
-- Dashboard numbers
-- -----------------------------------------------------------------------------
create function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'listings_by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                           from (select status, count(*) as n from public.listings group by status) s),
    'live_listings', (select count(*) from public.listings where status = 'published' and expires_at > now()),
    'new_listings_7d', (select count(*) from public.listings where created_at > now() - interval '7 days'),
    'users_by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
                        from (select status, count(*) as n from public.profiles group by status) s),
    'new_users_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'open_listing_reports', (select count(*) from public.listing_reports where status in ('open', 'reviewing')),
    'open_user_reports', (select count(*) from public.user_reports where status in ('open', 'reviewing')),
    'open_messages', (select count(*) from public.contact_messages where status in ('open', 'reviewing'))
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- User search (emails live in auth.users, which the browser can never read)
-- -----------------------------------------------------------------------------
create function public.admin_search_users(
  p_query text default null,
  p_status public.account_status default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  email text,
  display_name text,
  phone text,
  role public.app_role,
  status public.account_status,
  status_reason text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  deletion_requested_at timestamptz,
  listing_count bigint,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
  v_like text := '%' || replace(replace(replace(coalesce(v_q, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  select p.id, u.email::text, p.display_name, p.phone, p.role, p.status, p.status_reason, p.created_at,
         u.last_sign_in_at, p.deletion_requested_at,
         (select count(*) from public.listings l where l.seller_id = p.id),
         count(*) over ()
  from public.profiles p
  join auth.users u on u.id = p.id
  where (v_q is null
         or u.email ilike v_like
         or p.display_name ilike v_like
         or coalesce(p.phone, '') like v_like
         or p.id::text = v_q)
    and (p_status is null or p.status = p_status)
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$$;

-- -----------------------------------------------------------------------------
-- Expiry control: extend a published/expired listing or end it now.
-- -----------------------------------------------------------------------------
create function public.admin_set_listing_expiry(p_listing_id bigint, p_expires_at timestamptz)
returns public.listing_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
  v_status public.listing_status;
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_listing from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;
  if v_listing.status not in ('published', 'expired') then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;
  if p_expires_at > now() + interval '365 days' then
    raise exception 'expiry_too_far' using errcode = 'P0001';
  end if;

  v_status := case when p_expires_at > now() then 'published'::public.listing_status else 'expired'::public.listing_status end;
  perform set_config('app.status_reason', 'admin_changed_expiry', true);
  update public.listings set expires_at = p_expires_at, status = v_status where id = p_listing_id;

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'listing_expiry_change', 'listing', p_listing_id::text,
          jsonb_build_object('from', v_listing.expires_at, 'to', p_expires_at, 'status', v_status));
  return v_status;
end;
$$;

-- -----------------------------------------------------------------------------
-- Completing an account deletion: removes personal data but keeps the
-- records that may be needed legally (listings, audit and commission history).
-- The server also anonymizes the login email and blocks sign-in.
-- -----------------------------------------------------------------------------
create function public.admin_anonymize_user(p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot_change_own_status' using errcode = 'P0001';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  perform set_config('app.status_reason', 'account_deleted', true);
  update public.listings set status = 'withdrawn'
  where seller_id = p_user_id and status in ('pending_approval', 'published', 'expired');

  delete from public.listing_contacts c using public.listings l
  where c.listing_id = l.id and l.seller_id = p_user_id;
  delete from public.favourites where user_id = p_user_id;
  delete from public.notifications where user_id = p_user_id;

  update public.profiles
  set display_name = 'مستخدم محذوف',
      phone = null,
      status = 'deleted',
      status_reason = left(p_reason, 500),
      status_changed_at = now()
  where id = p_user_id;

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'user_anonymized', 'profile', p_user_id::text, jsonb_build_object('reason', p_reason));
end;
$$;

-- Generic audit entry for actions done by trusted server code on an admin's
-- behalf (e.g. CSV exports, auth changes). Server-only.
create function public.record_admin_action(p_actor uuid, p_action text, p_entity_type text, p_entity_id text, p_details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values (p_actor, p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_search_users(text, public.account_status, integer, integer) to authenticated;
grant execute on function public.admin_set_listing_expiry(bigint, timestamptz) to authenticated;
grant execute on function public.admin_anonymize_user(uuid, text) to authenticated;
grant execute on function public.record_admin_action(uuid, text, text, text, jsonb) to service_role;

-- Admins may also mark listing reports while reviewing (already allowed);
-- index to list a listing's reports quickly in the dashboard.
create index if not exists listing_reports_listing_status_idx on public.listing_reports (listing_id, status);
