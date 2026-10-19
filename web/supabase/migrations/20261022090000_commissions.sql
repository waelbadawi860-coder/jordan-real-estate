-- =============================================================================
-- Stage 6: commission agreements, rules, commission records, payments.
--
-- Principles
--  * Agreement texts and commission rules are versioned and never edited in
--    place; a seller's acceptance points at the exact version and rule.
--  * Amounts are exact decimals (numeric), calculated in the database.
--  * Sellers can only REPORT (a transaction, a payment, a dispute). Only an
--    administrator can confirm, verify payments, adjust or waive.
--  * Every change is recorded in commission_events (and admin_audit_logs).
--  * The whole feature is OFF unless site setting commission_enabled = true.
-- =============================================================================

create type public.commission_status as enum (
  'reported',          -- seller reported the sale/rent; awaiting admin confirmation
  'not_yet_due',       -- confirmed; due date in the future
  'pending',           -- due and unpaid
  'payment_reported',  -- seller says they paid; awaiting verification
  'payment_verified',  -- admin verified full payment
  'disputed',          -- seller disputes the claim
  'waived'             -- admin waived it, with a reason
);
create type public.commission_basis as enum ('sale_price', 'annual_rent', 'monthly_rent', 'fixed_amount');
create type public.payment_status as enum ('reported', 'verified', 'rejected');

-- -----------------------------------------------------------------------------
-- Agreement versions (immutable texts)
-- -----------------------------------------------------------------------------
create table public.agreement_versions (
  id               integer generated always as identity primary key,
  version_label    text not null unique check (char_length(version_label) between 1 and 40),
  title_ar         text not null check (char_length(title_ar) between 3 and 200),
  title_en         text not null check (char_length(title_en) between 3 and 200),
  body_ar          text not null check (char_length(body_ar) between 20 and 20000),
  body_en          text not null check (char_length(body_en) between 20 and 20000),
  -- true until a qualified Jordanian lawyer has reviewed the text
  is_draft         boolean not null default true,
  legal_review_note text check (char_length(legal_review_note) <= 500),
  is_current       boolean not null default false,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);
create unique index agreement_versions_one_current on public.agreement_versions (is_current) where is_current;

-- -----------------------------------------------------------------------------
-- Commission rules (one active rule per deal type; never edited, only replaced)
-- -----------------------------------------------------------------------------
create table public.commission_rules (
  id                   integer generated always as identity primary key,
  deal_type            public.deal_type not null,
  basis                public.commission_basis not null,
  percentage           numeric(6, 3) check (percentage > 0 and percentage <= 100),
  fixed_amount         numeric(14, 3) check (fixed_amount > 0),
  min_amount           numeric(14, 3) check (min_amount >= 0),
  max_amount           numeric(14, 3) check (max_amount > 0),
  currency             char(3) not null default 'JOD' check (currency = 'JOD'),
  trigger_event        text not null default 'transaction_completed'
                       check (trigger_event in ('transaction_completed', 'contract_signed')),
  due_days             integer not null default 7 check (due_days between 0 and 365),
  agreement_version_id integer not null references public.agreement_versions (id),
  is_active            boolean not null default true,
  effective_from       timestamptz not null default now(),
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  check ((basis = 'fixed_amount') = (fixed_amount is not null)),
  check ((basis = 'fixed_amount') or percentage is not null),
  check (min_amount is null or max_amount is null or min_amount <= max_amount)
);
create unique index commission_rules_one_active on public.commission_rules (deal_type) where is_active;

-- -----------------------------------------------------------------------------
-- Acceptances (durable record of what each seller agreed to, per listing)
-- -----------------------------------------------------------------------------
create table public.accepted_agreements (
  id                   bigint generated always as identity primary key,
  user_id              uuid not null references public.profiles (id) on delete restrict,
  listing_id           bigint references public.listings (id) on delete set null,
  listing_title        text not null,
  agreement_version_id integer not null references public.agreement_versions (id) on delete restrict,
  agreement_text_sha256 text not null,
  rule_id              integer not null references public.commission_rules (id) on delete restrict,
  rule_snapshot        jsonb not null,
  evidence             jsonb not null default '{}'::jsonb,
  accepted_at          timestamptz not null default now(),
  unique (listing_id, agreement_version_id)
);
create index accepted_agreements_user_idx on public.accepted_agreements (user_id, accepted_at desc);

-- -----------------------------------------------------------------------------
-- Commission records
-- -----------------------------------------------------------------------------
create table public.commission_records (
  id                    bigint generated always as identity primary key,
  reference             text not null unique,
  listing_id            bigint not null unique references public.listings (id) on delete restrict,
  seller_id             uuid not null references public.profiles (id) on delete restrict,
  accepted_agreement_id bigint not null references public.accepted_agreements (id) on delete restrict,
  rule_id               integer not null references public.commission_rules (id) on delete restrict,
  deal_type             public.deal_type not null,
  basis                 public.commission_basis not null,
  percentage            numeric(6, 3),
  transaction_date      date not null,
  transaction_value     numeric(14, 3) check (transaction_value > 0),
  calculated_amount     numeric(14, 3) not null check (calculated_amount >= 0),
  amount_due            numeric(14, 3) not null check (amount_due >= 0),
  amount_verified       numeric(14, 3) not null default 0 check (amount_verified >= 0),
  currency              char(3) not null default 'JOD' check (currency = 'JOD'),
  status                public.commission_status not null default 'reported',
  due_date              date not null,
  seller_confirmed_at   timestamptz not null,
  dispute_reason        text check (char_length(dispute_reason) <= 2000),
  admin_note            text check (char_length(admin_note) <= 2000),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index commission_records_status_idx on public.commission_records (status, due_date);
create index commission_records_seller_idx on public.commission_records (seller_id, created_at desc);

create trigger commission_records_set_updated_at before update on public.commission_records
  for each row execute function public.set_updated_at();

create table public.payment_records (
  id               bigint generated always as identity primary key,
  commission_id    bigint not null references public.commission_records (id) on delete restrict,
  reported_by      uuid references public.profiles (id) on delete set null,
  method           text not null check (method in ('cliq', 'bank_transfer', 'other')),
  amount_reported  numeric(14, 3) not null check (amount_reported > 0),
  paid_on          date not null,
  payer_reference  text check (char_length(payer_reference) <= 100),
  status           public.payment_status not null default 'reported',
  verified_amount  numeric(14, 3) check (verified_amount > 0),
  verified_on      date,
  bank_reference   text check (char_length(bank_reference) <= 100),
  verified_by      uuid references public.profiles (id) on delete set null,
  verified_at      timestamptz,
  rejection_reason text check (char_length(rejection_reason) <= 1000),
  created_at       timestamptz not null default now()
);
create index payment_records_commission_idx on public.payment_records (commission_id, created_at);
create index payment_records_status_idx on public.payment_records (status, created_at);

create table public.commission_events (
  id            bigint generated always as identity primary key,
  commission_id bigint not null references public.commission_records (id) on delete restrict,
  actor_id      uuid references public.profiles (id) on delete set null,
  event         text not null check (char_length(event) between 2 and 40),
  from_status   public.commission_status,
  to_status     public.commission_status,
  amount        numeric(14, 3),
  note          text check (char_length(note) <= 2000),
  created_at    timestamptz not null default now()
);
create index commission_events_commission_idx on public.commission_events (commission_id, created_at);

-- -----------------------------------------------------------------------------
-- Security: read access only; every write goes through the functions below.
-- -----------------------------------------------------------------------------
alter table public.agreement_versions  enable row level security;
alter table public.commission_rules    enable row level security;
alter table public.accepted_agreements enable row level security;
alter table public.commission_records  enable row level security;
alter table public.payment_records     enable row level security;
alter table public.commission_events   enable row level security;

grant select on public.agreement_versions, public.commission_rules to anon, authenticated;
grant select on public.accepted_agreements, public.commission_records, public.payment_records, public.commission_events to authenticated;

create policy "agreements: everyone reads" on public.agreement_versions for select to anon, authenticated using (true);
create policy "rules: everyone reads active, admins all" on public.commission_rules
  for select to anon, authenticated using (is_active or (select public.is_admin()));
create policy "acceptances: own or admin" on public.accepted_agreements
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "commissions: own or admin" on public.commission_records
  for select to authenticated using (seller_id = (select auth.uid()) or (select public.is_admin()));
create policy "payments: own or admin" on public.payment_records
  for select to authenticated using (
    (select public.is_admin())
    or exists (select 1 from public.commission_records c where c.id = commission_id and c.seller_id = (select auth.uid()))
  );
create policy "commission events: own or admin" on public.commission_events
  for select to authenticated using (
    (select public.is_admin())
    or exists (select 1 from public.commission_records c where c.id = commission_id and c.seller_id = (select auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- The commission for a transaction value under a rule (exact decimal math).
create function public.commission_amount(
  p_basis public.commission_basis,
  p_percentage numeric,
  p_fixed numeric,
  p_min numeric,
  p_max numeric,
  p_value numeric
)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v numeric;
begin
  if p_basis = 'fixed_amount' then
    v := p_fixed;
  else
    if p_value is null or p_value <= 0 then
      raise exception 'transaction_value_required' using errcode = 'P0001';
    end if;
    v := round(p_value * p_percentage / 100, 3);
  end if;
  if p_min is not null and v < p_min then v := p_min; end if;
  if p_max is not null and v > p_max then v := p_max; end if;
  return v;
end;
$$;
grant execute on function public.commission_amount(public.commission_basis, numeric, numeric, numeric, numeric, numeric) to anon, authenticated;

create function public.notify_admins(p_type text, p_data jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, data)
  select id, p_type, p_data from public.profiles where role = 'admin' and status = 'active';
$$;

create function public.log_commission_event(
  p_commission_id bigint, p_event text, p_from public.commission_status, p_to public.commission_status, p_amount numeric, p_note text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.commission_events (commission_id, actor_id, event, from_status, to_status, amount, note)
  values (p_commission_id, auth.uid(), p_event, p_from, p_to, p_amount, p_note);
$$;

-- Due-date based status for a confirmed, unpaid commission.
create function public.commission_due_status(p_due_date date)
returns public.commission_status
language sql
stable
set search_path = ''
as $$
  select case when p_due_date <= (now() at time zone 'Asia/Amman')::date
              then 'pending'::public.commission_status
              else 'not_yet_due'::public.commission_status end;
$$;

-- -----------------------------------------------------------------------------
-- Seller actions
-- -----------------------------------------------------------------------------

-- Records the seller's acceptance of the CURRENT agreement for one listing.
create function public.accept_agreement(p_listing_id bigint, p_evidence jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
  v_version public.agreement_versions%rowtype;
  v_rule public.commission_rules%rowtype;
  v_id bigint;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_active_user() then
    raise exception 'account_not_active' using errcode = '42501';
  end if;
  if not public.setting_bool('commission_enabled', false) then
    raise exception 'commission_disabled' using errcode = 'P0001';
  end if;

  select * into v_listing from public.listings where id = p_listing_id and seller_id = auth.uid();
  if not found then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;
  if v_listing.status not in ('draft', 'rejected', 'withdrawn', 'expired', 'pending_approval') then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;

  select * into v_version from public.agreement_versions where is_current;
  if not found then
    raise exception 'no_current_agreement' using errcode = 'P0001';
  end if;
  select * into v_rule from public.commission_rules where is_active and deal_type = v_listing.deal_type;
  if not found then
    raise exception 'no_active_rule' using errcode = 'P0001';
  end if;

  insert into public.accepted_agreements (
    user_id, listing_id, listing_title, agreement_version_id, agreement_text_sha256, rule_id, rule_snapshot, evidence
  )
  values (
    auth.uid(), v_listing.id, v_listing.title, v_version.id,
    encode(sha256(convert_to(v_version.body_ar || E'\n---\n' || v_version.body_en, 'UTF8')), 'hex'),
    v_rule.id, to_jsonb(v_rule), coalesce(p_evidence, '{}'::jsonb) - 'user_id'
  )
  on conflict (listing_id, agreement_version_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.accepted_agreements
    where listing_id = v_listing.id and agreement_version_id = v_version.id;
  end if;
  return v_id;
end;
$$;

-- Seller reports that the property was sold/rented. Creates the commission
-- record (if the listing was published under a commission agreement) and
-- marks the listing sold/rented.
create function public.report_transaction(
  p_listing_id bigint,
  p_completed_on date,
  p_transaction_value numeric,
  p_confirm boolean
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
  v_acceptance public.accepted_agreements%rowtype;
  v_rule public.commission_rules%rowtype;
  v_amount numeric;
  v_id bigint;
  v_reference text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not public.is_active_user() then
    raise exception 'account_not_active' using errcode = '42501';
  end if;
  if p_confirm is not true then
    raise exception 'confirmation_required' using errcode = 'P0001';
  end if;
  if p_completed_on is null
     or p_completed_on > (now() at time zone 'Asia/Amman')::date
     or p_completed_on < (now() at time zone 'Asia/Amman')::date - 730 then
    raise exception 'invalid_date' using errcode = 'P0001';
  end if;

  select * into v_listing from public.listings where id = p_listing_id and seller_id = auth.uid() for update;
  if not found then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;
  if v_listing.status not in ('published', 'expired') then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;

  select * into v_acceptance from public.accepted_agreements
  where listing_id = v_listing.id order by accepted_at desc limit 1;
  if not found then
    raise exception 'no_agreement' using errcode = 'P0001';
  end if;
  select * into v_rule from public.commission_rules where id = v_acceptance.rule_id;

  v_amount := public.commission_amount(v_rule.basis, v_rule.percentage, v_rule.fixed_amount,
                                       v_rule.min_amount, v_rule.max_amount, p_transaction_value);
  v_reference := 'CM-' || v_listing.id || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));

  insert into public.commission_records (
    reference, listing_id, seller_id, accepted_agreement_id, rule_id, deal_type, basis, percentage,
    transaction_date, transaction_value, calculated_amount, amount_due, currency, status, due_date, seller_confirmed_at
  )
  values (
    v_reference, v_listing.id, auth.uid(), v_acceptance.id, v_rule.id, v_listing.deal_type, v_rule.basis, v_rule.percentage,
    p_completed_on, case when v_rule.basis = 'fixed_amount' then null else p_transaction_value end,
    v_amount, v_amount, 'JOD', 'reported', p_completed_on + v_rule.due_days, now()
  )
  returning id into v_id;

  perform set_config('app.status_reason', 'transaction_reported', true);
  update public.listings
  set status = case when v_listing.deal_type = 'sale' then 'sold'::public.listing_status else 'rented'::public.listing_status end
  where id = v_listing.id;

  perform public.log_commission_event(v_id, 'transaction_reported', null, 'reported', v_amount, null);
  perform public.notify_admins('commission_reported', jsonb_build_object('commission_id', v_id, 'listing_id', v_listing.id));
  return v_id;
end;
$$;

create function public.report_payment(
  p_commission_id bigint,
  p_method text,
  p_amount numeric,
  p_paid_on date,
  p_reference text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.commission_records%rowtype;
  v_id bigint;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into v_c from public.commission_records where id = p_commission_id and seller_id = auth.uid() for update;
  if not found then
    raise exception 'commission_not_found' using errcode = 'P0002';
  end if;
  if v_c.status not in ('reported', 'not_yet_due', 'pending', 'payment_reported') then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;
  if p_paid_on is null or p_paid_on > (now() at time zone 'Asia/Amman')::date then
    raise exception 'invalid_date' using errcode = 'P0001';
  end if;
  if (select count(*) from public.payment_records where commission_id = v_c.id and status = 'reported') >= 3 then
    raise exception 'too_many_open_payments' using errcode = 'P0001';
  end if;

  insert into public.payment_records (commission_id, reported_by, method, amount_reported, paid_on, payer_reference)
  values (v_c.id, auth.uid(), p_method, p_amount, p_paid_on, nullif(btrim(coalesce(p_reference, '')), ''))
  returning id into v_id;

  -- A report is only a claim: the status says "payment reported", never "paid".
  update public.commission_records set status = 'payment_reported' where id = v_c.id;
  perform public.log_commission_event(v_c.id, 'payment_reported', v_c.status, 'payment_reported', p_amount, p_method);
  perform public.notify_admins('payment_reported', jsonb_build_object('commission_id', v_c.id, 'payment_id', v_id));
  return v_id;
end;
$$;

create function public.open_commission_dispute(p_commission_id bigint, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.commission_records%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  select * into v_c from public.commission_records where id = p_commission_id and seller_id = auth.uid() for update;
  if not found then
    raise exception 'commission_not_found' using errcode = 'P0002';
  end if;
  if v_c.status in ('payment_verified', 'waived', 'disputed') then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;

  update public.commission_records set status = 'disputed', dispute_reason = left(btrim(p_reason), 2000) where id = v_c.id;
  perform public.log_commission_event(v_c.id, 'dispute_opened', v_c.status, 'disputed', null, left(btrim(p_reason), 2000));
  perform public.notify_admins('commission_disputed', jsonb_build_object('commission_id', v_c.id));
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin actions
-- -----------------------------------------------------------------------------
create function public.admin_commission_action(
  p_commission_id bigint,
  p_action text,             -- confirm | adjust | waive | resolve_dispute
  p_amount numeric default null,
  p_note text default null
)
returns public.commission_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.commission_records%rowtype;
  v_to public.commission_status;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_c from public.commission_records where id = p_commission_id for update;
  if not found then
    raise exception 'commission_not_found' using errcode = 'P0002';
  end if;

  if p_action = 'confirm' then
    if v_c.status <> 'reported' then
      raise exception 'invalid_status_transition' using errcode = 'P0001';
    end if;
    v_to := public.commission_due_status(v_c.due_date);
    update public.commission_records set status = v_to, admin_note = coalesce(v_note, admin_note) where id = v_c.id;

  elsif p_action = 'adjust' then
    if v_note is null then raise exception 'reason_required' using errcode = 'P0001'; end if;
    if p_amount is null or p_amount < 0 then raise exception 'invalid_amount' using errcode = 'P0001'; end if;
    if v_c.status in ('waived') then raise exception 'invalid_status_transition' using errcode = 'P0001'; end if;
    v_to := case
      when v_c.amount_verified >= round(p_amount, 3) then 'payment_verified'::public.commission_status
      when v_c.status = 'payment_reported' then 'payment_reported'::public.commission_status
      when v_c.status = 'reported' then 'reported'::public.commission_status
      else public.commission_due_status(v_c.due_date) end;
    update public.commission_records set amount_due = round(p_amount, 3), status = v_to, admin_note = v_note where id = v_c.id;

  elsif p_action = 'waive' then
    if v_note is null then raise exception 'reason_required' using errcode = 'P0001'; end if;
    if v_c.status in ('payment_verified', 'waived') then raise exception 'invalid_status_transition' using errcode = 'P0001'; end if;
    v_to := 'waived';
    update public.commission_records set status = v_to, admin_note = v_note where id = v_c.id;

  elsif p_action = 'resolve_dispute' then
    if v_c.status <> 'disputed' then raise exception 'invalid_status_transition' using errcode = 'P0001'; end if;
    if v_note is null then raise exception 'reason_required' using errcode = 'P0001'; end if;
    v_to := case when v_c.amount_verified >= v_c.amount_due and v_c.amount_due > 0
                 then 'payment_verified'::public.commission_status
                 else public.commission_due_status(v_c.due_date) end;
    update public.commission_records set status = v_to, admin_note = v_note where id = v_c.id;

  else
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;

  perform public.log_commission_event(v_c.id, 'admin_' || p_action, v_c.status, v_to,
                                      case when p_action = 'adjust' then round(p_amount, 3) else null end, v_note);
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'commission_' || p_action, 'commission', v_c.id::text,
          jsonb_build_object('from', v_c.status, 'to', v_to, 'old_amount', v_c.amount_due, 'new_amount', p_amount, 'note', v_note));
  insert into public.notifications (user_id, type, data)
  values (v_c.seller_id, 'commission_updated', jsonb_build_object('commission_id', v_c.id, 'status', v_to));
  return v_to;
end;
$$;

create function public.admin_review_payment(
  p_payment_id bigint,
  p_decision text,            -- verify | reject
  p_verified_amount numeric default null,
  p_verified_on date default null,
  p_bank_reference text default null,
  p_reason text default null
)
returns public.commission_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.payment_records%rowtype;
  v_c public.commission_records%rowtype;
  v_to public.commission_status;
  v_total numeric;
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_p from public.payment_records where id = p_payment_id for update;
  if not found or v_p.status <> 'reported' then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;
  select * into v_c from public.commission_records where id = v_p.commission_id for update;

  if p_decision = 'verify' then
    if p_verified_amount is null or p_verified_amount <= 0 then raise exception 'invalid_amount' using errcode = 'P0001'; end if;
    if p_verified_on is null then raise exception 'invalid_date' using errcode = 'P0001'; end if;
    if nullif(btrim(coalesce(p_bank_reference, '')), '') is null then raise exception 'reference_required' using errcode = 'P0001'; end if;
    update public.payment_records
    set status = 'verified', verified_amount = round(p_verified_amount, 3), verified_on = p_verified_on,
        bank_reference = btrim(p_bank_reference), verified_by = auth.uid(), verified_at = now()
    where id = v_p.id;
    v_total := v_c.amount_verified + round(p_verified_amount, 3);
  elsif p_decision = 'reject' then
    if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason_required' using errcode = 'P0001'; end if;
    update public.payment_records
    set status = 'rejected', rejection_reason = left(btrim(p_reason), 1000), verified_by = auth.uid(), verified_at = now()
    where id = v_p.id;
    v_total := v_c.amount_verified;
  else
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;

  v_to := case
    when v_total >= v_c.amount_due then 'payment_verified'::public.commission_status
    when v_c.status = 'disputed' then 'disputed'::public.commission_status
    when exists (select 1 from public.payment_records where commission_id = v_c.id and status = 'reported') then 'payment_reported'::public.commission_status
    else public.commission_due_status(v_c.due_date) end;
  update public.commission_records set amount_verified = v_total, status = v_to where id = v_c.id;

  perform public.log_commission_event(v_c.id, 'payment_' || p_decision || 'ed', v_c.status, v_to,
                                      case when p_decision = 'verify' then round(p_verified_amount, 3) else null end,
                                      coalesce(p_bank_reference, p_reason));
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'payment_' || p_decision, 'payment', v_p.id::text,
          jsonb_build_object('commission_id', v_c.id, 'amount', p_verified_amount, 'reference', p_bank_reference, 'reason', p_reason));
  insert into public.notifications (user_id, type, data)
  values (v_c.seller_id, 'payment_' || p_decision || 'ed', jsonb_build_object('commission_id', v_c.id));
  return v_to;
end;
$$;

-- New agreement text version (old versions are never changed).
create function public.admin_publish_agreement(
  p_version_label text, p_title_ar text, p_title_en text, p_body_ar text, p_body_en text,
  p_is_draft boolean, p_legal_review_note text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id integer;
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_is_draft is false and nullif(btrim(coalesce(p_legal_review_note, '')), '') is null then
    raise exception 'legal_review_note_required' using errcode = 'P0001';
  end if;
  update public.agreement_versions set is_current = false where is_current;
  insert into public.agreement_versions (version_label, title_ar, title_en, body_ar, body_en, is_draft, legal_review_note, is_current, created_by)
  values (btrim(p_version_label), btrim(p_title_ar), btrim(p_title_en), btrim(p_body_ar), btrim(p_body_en),
          p_is_draft, nullif(btrim(coalesce(p_legal_review_note, '')), ''), true, auth.uid())
  returning id into v_id;
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'agreement_published', 'agreement_version', v_id::text,
          jsonb_build_object('label', p_version_label, 'is_draft', p_is_draft, 'legal_review_note', p_legal_review_note));
  return v_id;
end;
$$;

-- New commission rule for a deal type (the previous active rule is retired;
-- listings already accepted under it keep it).
create function public.admin_create_commission_rule(
  p_deal_type public.deal_type, p_basis public.commission_basis, p_percentage numeric, p_fixed_amount numeric,
  p_min_amount numeric, p_max_amount numeric, p_due_days integer, p_trigger_event text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id integer;
  v_version integer;
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select id into v_version from public.agreement_versions where is_current;
  if v_version is null then
    raise exception 'no_current_agreement' using errcode = 'P0001';
  end if;
  update public.commission_rules set is_active = false where is_active and deal_type = p_deal_type;
  insert into public.commission_rules (deal_type, basis, percentage, fixed_amount, min_amount, max_amount, due_days,
                                       trigger_event, agreement_version_id, created_by)
  values (p_deal_type, p_basis,
          case when p_basis = 'fixed_amount' then null else p_percentage end,
          case when p_basis = 'fixed_amount' then p_fixed_amount else null end,
          p_min_amount, p_max_amount, p_due_days, coalesce(p_trigger_event, 'transaction_completed'), v_version, auth.uid())
  returning id into v_id;
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'commission_rule_created', 'commission_rule', v_id::text,
          jsonb_build_object('deal_type', p_deal_type, 'basis', p_basis, 'percentage', p_percentage,
                             'fixed', p_fixed_amount, 'min', p_min_amount, 'max', p_max_amount, 'due_days', p_due_days));
  return v_id;
end;
$$;

create function public.admin_retire_commission_rule(p_rule_id integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.commission_rules set is_active = false where id = p_rule_id;
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'commission_rule_retired', 'commission_rule', p_rule_id::text, '{}'::jsonb);
end;
$$;

create function public.admin_commission_totals()
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
    'by_status', (select coalesce(jsonb_object_agg(status, jsonb_build_object('count', n, 'due', due)), '{}'::jsonb)
                  from (select status, count(*) as n, sum(amount_due) as due from public.commission_records group by status) s),
    -- Cash actually verified by an admin. Never mixed with estimates.
    'verified_total', (select coalesce(sum(verified_amount), 0) from public.payment_records where status = 'verified'),
    'reported_unverified_total', (select coalesce(sum(amount_reported), 0) from public.payment_records where status = 'reported'),
    'outstanding_estimate', (select coalesce(sum(greatest(amount_due - amount_verified, 0)), 0)
                             from public.commission_records where status in ('reported', 'not_yet_due', 'pending', 'payment_reported', 'disputed'))
  );
end;
$$;

-- Daily: confirmed commissions become "pending" on their due date.
create function public.advance_due_commissions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select id from public.commission_records
    where status = 'not_yet_due' and due_date <= (now() at time zone 'Asia/Amman')::date
    for update
  loop
    update public.commission_records set status = 'pending' where id = r.id;
    insert into public.commission_events (commission_id, event, from_status, to_status) values (r.id, 'became_due', 'not_yet_due', 'pending');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
select cron.schedule('advance-due-commissions', '10 0 * * *', $$select public.advance_due_commissions();$$);

-- -----------------------------------------------------------------------------
-- Listing workflow hooks
-- -----------------------------------------------------------------------------

-- When commissions are on, submitting needs acceptance of the current agreement;
-- and a listing published under an agreement must be marked sold/rented via
-- report_transaction (so the commission record is created).
create function public.listing_commission_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only user-initiated changes are checked (admins/system are exempt).
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.status = 'pending_approval' and old.status in ('draft', 'rejected', 'withdrawn', 'expired')
     and public.setting_bool('commission_enabled', false)
     and not exists (
       select 1 from public.accepted_agreements a
       join public.agreement_versions v on v.id = a.agreement_version_id and v.is_current
       where a.listing_id = new.id
     ) then
    raise exception 'agreement_required' using errcode = 'P0001';
  end if;

  if new.status in ('sold', 'rented') and old.status in ('published', 'expired')
     and coalesce(current_setting('app.status_reason', true), '') <> 'transaction_reported'
     and exists (select 1 from public.accepted_agreements a where a.listing_id = new.id) then
    raise exception 'transaction_details_required' using errcode = 'P0001';
  end if;

  if new.deal_type is distinct from old.deal_type
     and exists (select 1 from public.accepted_agreements a where a.listing_id = new.id) then
    raise exception 'deal_type_locked' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger listings_commission_guard
  before update on public.listings
  for each row execute function public.listing_commission_guard();

-- -----------------------------------------------------------------------------
-- Grants (functions check permissions themselves)
-- -----------------------------------------------------------------------------
grant execute on function public.accept_agreement(bigint, jsonb) to authenticated;
grant execute on function public.report_transaction(bigint, date, numeric, boolean) to authenticated;
grant execute on function public.report_payment(bigint, text, numeric, date, text) to authenticated;
grant execute on function public.open_commission_dispute(bigint, text) to authenticated;
grant execute on function public.admin_commission_action(bigint, text, numeric, text) to authenticated;
grant execute on function public.admin_review_payment(bigint, text, numeric, date, text, text) to authenticated;
grant execute on function public.admin_publish_agreement(text, text, text, text, text, boolean, text) to authenticated;
grant execute on function public.admin_create_commission_rule(public.deal_type, public.commission_basis, numeric, numeric, numeric, numeric, integer, text) to authenticated;
grant execute on function public.admin_retire_commission_rule(integer) to authenticated;
grant execute on function public.admin_commission_totals() to authenticated;
grant execute on function public.commission_due_status(date) to authenticated;

-- -----------------------------------------------------------------------------
-- Settings: payment instructions (shown to sellers who owe a commission)
-- -----------------------------------------------------------------------------
insert into public.site_settings (key, value, is_public, description) values
  ('payment_cliq_alias',        '""', true, 'CliQ alias for commission payments'),
  ('payment_cliq_holder',       '""', true, 'Name shown for the CliQ alias'),
  ('payment_bank_name',         '""', true, 'Bank name for transfers'),
  ('payment_bank_account_name', '""', true, 'Account holder name'),
  ('payment_iban',              '""', true, 'IBAN for transfers'),
  ('payment_note_ar',           '""', true, 'Extra payment instructions (Arabic)'),
  ('payment_note_en',           '""', true, 'Extra payment instructions (English)')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Initial DRAFT agreement (not legally reviewed) — placeholder rules are NOT
-- created: the administrator sets real rules from the dashboard.
-- -----------------------------------------------------------------------------
insert into public.agreement_versions (version_label, title_ar, title_en, body_ar, body_en, is_draft, is_current)
values (
  'draft-2026-10',
  'إقرار وتعهد بالعمولة (مسودة)',
  'Commission acknowledgement and undertaking (draft)',
  'أقرّ باطلاعي على شروط الإعلان والعمولة الخاصة بالموقع وموافقتي عليها، وأتعهد بسداد العمولة المستحقة وفقاً للشروط المتفق عليها، إذا تحقق سبب استحقاقها المحدد في الاتفاقية. وأقرّ بأنني اطلعت على أساس احتساب العمولة وموعد استحقاقها وآلية سدادها.

ملاحظة: هذا نص مسودة لأغراض الاختبار فقط، ولم تتم مراجعته من مستشار قانوني أردني.',
  'I confirm that I have read and accept the website''s listing and commission terms, and I undertake to pay the commission due under the agreed terms if the event that makes it payable, as defined in the agreement, occurs. I confirm that I have read how the commission is calculated, when it becomes due, and how it is paid.

Note: this is draft wording for testing only and has not been reviewed by a Jordanian legal advisor.',
  true,
  true
);
