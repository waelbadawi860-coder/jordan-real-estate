-- =============================================================================
-- Real-estate offices (owner decision 2026-10-22):
--   * an account can open one office page (name, phone, governorate, about);
--   * monthly packages raise the number of active listings; an admin records
--     the package after the office pays (online payment comes later);
--   * "verified office" badge: the office uploads its documents (commercial
--     registration, office licence, ID), an admin reviews them, and the badge
--     lasts a year. The badge means "documents checked", not a guarantee.
-- Individuals keep a small limit of active listings (setting).
-- =============================================================================

insert into public.site_settings (key, value, is_public, description)
values ('max_active_listings_individual', '3', true, 'Active listings (pending or published) a person without an office package may have')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Packages (prices and limits editable by admins)
-- -----------------------------------------------------------------------------
create table public.office_plans (
  slug                  text primary key check (slug ~ '^[a-z0-9-]{2,30}$'),
  name_ar               text not null check (char_length(name_ar) between 2 and 40),
  name_en               text not null check (char_length(name_en) between 2 and 40),
  price_jod             numeric(10, 3) not null check (price_jod >= 0),
  max_active_listings   integer not null check (max_active_listings between 1 and 10000),
  featured_per_month    integer not null default 0 check (featured_per_month between 0 and 1000),
  includes_verification boolean not null default false,
  sort_order            smallint not null default 100,
  is_active             boolean not null default true
);
insert into public.office_plans (slug, name_ar, name_en, price_jod, max_active_listings, featured_per_month, includes_verification, sort_order) values
  ('basic',   'الأساسية', 'Basic',   20, 25,  1, false, 10),
  ('pro',     'المتقدمة', 'Pro',     45, 75,  3, true,  20),
  ('premium', 'المميزة',  'Premium', 90, 200, 8, true,  30);

alter table public.office_plans enable row level security;
grant select on public.office_plans to anon, authenticated;
grant update (name_ar, name_en, price_jod, max_active_listings, featured_per_month, includes_verification, sort_order, is_active)
  on public.office_plans to authenticated;
create policy "plans: everyone reads" on public.office_plans for select to anon, authenticated using (true);
create policy "plans: admins edit" on public.office_plans for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Offices
-- -----------------------------------------------------------------------------
create table public.offices (
  id             bigint generated always as identity primary key,
  owner_id       uuid not null unique references public.profiles (id) on delete cascade,
  name           text not null check (char_length(btrim(name)) between 2 and 80),
  phone          text check (phone ~ '^\+962[0-9]{8,9}$'),
  city_id        bigint references public.cities (id),
  about          text check (char_length(about) <= 1000),
  plan_slug      text references public.office_plans (slug),
  plan_until     timestamptz,
  verified_until timestamptz,
  status         text not null default 'active' check (status in ('active', 'suspended')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index offices_verified_idx on public.offices (verified_until) where status = 'active';

create trigger offices_set_updated_at before update on public.offices
  for each row execute function public.set_updated_at();

-- Owners can't touch the package, badge or status; renaming a verified office
-- removes the badge until the documents are checked again.
create function public.offices_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.plan_slug := null;
      new.plan_until := null;
      new.verified_until := null;
      new.status := 'active';
    elsif new.name is distinct from old.name and old.verified_until is not null then
      new.verified_until := null;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.offices_before_write() from public;
create trigger offices_before_write before insert or update on public.offices
  for each row execute function public.offices_before_write();

alter table public.offices enable row level security;
grant select on public.offices to anon, authenticated;
grant insert (owner_id, name, phone, city_id, about), update (name, phone, city_id, about) on public.offices to authenticated;
create policy "offices: public read active" on public.offices for select to anon, authenticated using (status = 'active');
create policy "offices: owners read own" on public.offices for select to authenticated using (owner_id = auth.uid());
create policy "offices: admins read all" on public.offices for select to authenticated using (public.is_admin());
create policy "offices: active users create own" on public.offices for insert to authenticated
  with check (owner_id = auth.uid() and public.is_active_user());
create policy "offices: owners edit own" on public.offices for update to authenticated
  using (owner_id = auth.uid() and public.is_active_user()) with check (owner_id = auth.uid());

-- Package history, kept permanently.
create table public.office_plan_history (
  id          bigint generated always as identity primary key,
  office_id   bigint not null,
  plan_slug   text,
  months      smallint check (months between 1 and 24),
  plan_until  timestamptz,
  amount      numeric(10, 3) check (amount >= 0 and amount <= 100000),
  payment_ref text check (char_length(payment_ref) <= 100),
  note        text check (char_length(note) <= 500),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.office_plan_history enable row level security;
grant select on public.office_plan_history to authenticated;
create policy "plan history: admins read" on public.office_plan_history for select to authenticated using (public.is_admin());
create policy "plan history: owners read own" on public.office_plan_history for select to authenticated
  using (exists (select 1 from public.offices o where o.id = office_id and o.owner_id = auth.uid()));
create trigger office_plan_history_permanent before update or delete on public.office_plan_history
  for each row execute function public.forbid_change_except_unlink('created_by');
create trigger office_plan_history_no_truncate before truncate on public.office_plan_history
  for each statement execute function public.forbid_truncate();

-- -----------------------------------------------------------------------------
-- Verification requests and their documents (private storage)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('office-documents', 'office-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "office documents: owners upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'office-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$'
    and (select public.is_active_user())
  );
create policy "office documents: owners and admins read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'office-documents'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );
-- No update or delete policy: documents are evidence and stay as uploaded.

create table public.office_verifications (
  id               bigint generated always as identity primary key,
  office_id        bigint not null references public.offices (id) on delete cascade,
  status           text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  commercial_reg_no text check (char_length(commercial_reg_no) <= 50),
  license_no       text check (char_length(license_no) <= 50),
  documents        text[] not null check (cardinality(documents) between 3 and 6),
  reason           text check (char_length(reason) <= 1000),
  reviewed_by      uuid references public.profiles (id) on delete set null,
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index office_verifications_status_idx on public.office_verifications (status, created_at);
create unique index office_verifications_one_pending on public.office_verifications (office_id) where status = 'pending';

alter table public.office_verifications enable row level security;
grant select on public.office_verifications to authenticated;
create policy "verifications: admins read" on public.office_verifications for select to authenticated using (public.is_admin());
create policy "verifications: owners read own" on public.office_verifications for select to authenticated
  using (exists (select 1 from public.offices o where o.id = office_id and o.owner_id = auth.uid()));

create function public.submit_office_verification(p_commercial_reg_no text, p_license_no text, p_documents text[])
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_office public.offices%rowtype;
  v_path   text;
  v_id     bigint;
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_office from public.offices where owner_id = auth.uid();
  if not found then
    raise exception 'office_required' using errcode = 'P0001';
  end if;
  if p_documents is null or cardinality(p_documents) not between 3 and 6 then
    raise exception 'documents_required' using errcode = '23514';
  end if;
  foreach v_path in array p_documents loop
    if split_part(v_path, '/', 1) <> auth.uid()::text
       or not exists (select 1 from storage.objects where bucket_id = 'office-documents' and name = v_path) then
      raise exception 'invalid_document' using errcode = '23514';
    end if;
  end loop;
  if exists (select 1 from public.office_verifications where office_id = v_office.id and status = 'pending') then
    raise exception 'already_pending' using errcode = 'P0001';
  end if;

  insert into public.office_verifications (office_id, commercial_reg_no, license_no, documents)
  values (v_office.id, nullif(btrim(p_commercial_reg_no), ''), nullif(btrim(p_license_no), ''), p_documents)
  returning id into v_id;
  perform public.notify_admins('office_verification_submitted', jsonb_build_object('office_id', v_office.id));
  return v_id;
end;
$$;
revoke execute on function public.submit_office_verification(text, text, text[]) from public;
grant execute on function public.submit_office_verification(text, text, text[]) to authenticated;

create function public.admin_review_office_verification(p_request_id bigint, p_approve boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req    public.office_verifications%rowtype;
  v_office public.offices%rowtype;
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_req from public.office_verifications where id = p_request_id for update;
  if not found or v_req.status <> 'pending' then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;
  if not p_approve and nullif(btrim(p_reason), '') is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  select * into v_office from public.offices where id = v_req.office_id;

  update public.office_verifications
  set status = case when p_approve then 'approved' else 'rejected' end,
      reason = nullif(btrim(p_reason), ''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id;
  if p_approve then
    update public.offices set verified_until = now() + interval '1 year' where id = v_office.id;
  end if;

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), case when p_approve then 'office_verified' else 'office_verification_rejected' end,
          'office', v_office.id::text, jsonb_build_object('request_id', p_request_id, 'reason', p_reason));
  insert into public.notifications (user_id, type, data)
  values (v_office.owner_id, case when p_approve then 'office_verified' else 'office_verification_rejected' end,
          jsonb_build_object('office_id', v_office.id, 'reason', p_reason));
end;
$$;
revoke execute on function public.admin_review_office_verification(bigint, boolean, text) from public;
grant execute on function public.admin_review_office_verification(bigint, boolean, text) to authenticated;

-- Removes the badge at once (e.g. after confirmed complaints) or suspends the office.
create function public.admin_set_office_status(p_office_id bigint, p_remove_badge boolean, p_suspend boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_office public.offices%rowtype;
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  select * into v_office from public.offices where id = p_office_id for update;
  if not found then
    raise exception 'office_not_found' using errcode = 'P0002';
  end if;
  update public.offices
  set verified_until = case when p_remove_badge then null else verified_until end,
      status = case when p_suspend then 'suspended' else 'active' end
  where id = p_office_id;
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'office_status_change', 'office', p_office_id::text,
          jsonb_build_object('remove_badge', p_remove_badge, 'suspend', p_suspend, 'reason', p_reason));
  if p_remove_badge and v_office.verified_until is not null then
    insert into public.notifications (user_id, type, data)
    values (v_office.owner_id, 'office_badge_removed', jsonb_build_object('office_id', p_office_id, 'reason', p_reason));
  end if;
end;
$$;
revoke execute on function public.admin_set_office_status(bigint, boolean, boolean, text) from public;
grant execute on function public.admin_set_office_status(bigint, boolean, boolean, text) to authenticated;

-- Records a paid package. Renewing the same package adds the months on top.
create function public.admin_set_office_plan(
  p_office_id bigint, p_plan_slug text, p_months integer,
  p_amount numeric default null, p_payment_ref text default null, p_note text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_office public.offices%rowtype;
  v_until  timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_office from public.offices where id = p_office_id for update;
  if not found then
    raise exception 'office_not_found' using errcode = 'P0002';
  end if;
  if p_plan_slug is null then
    v_until := null;
  else
    if not exists (select 1 from public.office_plans where slug = p_plan_slug and is_active) then
      raise exception 'invalid_plan' using errcode = '23514';
    end if;
    if p_months is null or p_months not between 1 and 24 then
      raise exception 'invalid_months' using errcode = '23514';
    end if;
    v_until := case when v_office.plan_slug = p_plan_slug and v_office.plan_until > now()
                    then v_office.plan_until else now() end + make_interval(months => p_months);
  end if;

  update public.offices set plan_slug = p_plan_slug, plan_until = v_until where id = p_office_id;
  insert into public.office_plan_history (office_id, plan_slug, months, plan_until, amount, payment_ref, note, created_by)
  values (p_office_id, p_plan_slug, case when p_plan_slug is not null then p_months end, v_until,
          p_amount, nullif(btrim(p_payment_ref), ''), nullif(btrim(p_note), ''), auth.uid());
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'office_plan_change', 'office', p_office_id::text,
          jsonb_build_object('plan', p_plan_slug, 'months', p_months, 'until', v_until, 'amount', p_amount, 'payment_ref', p_payment_ref));
  if p_plan_slug is not null then
    insert into public.notifications (user_id, type, data)
    values (v_office.owner_id, 'office_plan_active', jsonb_build_object('office_id', p_office_id, 'plan', p_plan_slug, 'until', v_until));
  end if;
  return v_until;
end;
$$;
revoke execute on function public.admin_set_office_plan(bigint, text, integer, numeric, text, text) from public;
grant execute on function public.admin_set_office_plan(bigint, text, integer, numeric, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Active listings limit: individuals get the setting, offices their package.
-- -----------------------------------------------------------------------------
create function public.active_listing_limit(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.max_active_listings
     from public.offices o join public.office_plans p on p.slug = o.plan_slug
     where o.owner_id = p_user_id and o.status = 'active' and o.plan_until > now()),
    public.setting_int('max_active_listings_individual', 3)
  );
$$;
revoke execute on function public.active_listing_limit(uuid) from public;
grant execute on function public.active_listing_limit(uuid) to authenticated;

create function public.listings_check_active_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
begin
  -- Trusted server code and admins are exempt; only moves into "live" count.
  if auth.uid() is null or public.is_admin()
     or new.status not in ('pending_approval', 'published')
     or old.status in ('pending_approval', 'published', 'on_hold') then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('listing_active:' || new.seller_id::text, 0));
  v_limit := public.active_listing_limit(new.seller_id);
  select count(*) into v_count from public.listings
  where seller_id = new.seller_id and id <> new.id and status in ('pending_approval', 'published', 'on_hold');
  if v_count >= v_limit then
    raise exception 'active_limit_reached'
      using errcode = 'P0001', detail = format('Limit is %s active listings.', v_limit);
  end if;
  return new;
end;
$$;
revoke execute on function public.listings_check_active_limit() from public;
create trigger listings_check_active_limit before update of status on public.listings
  for each row execute function public.listings_check_active_limit();
