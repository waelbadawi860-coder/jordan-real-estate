-- Seller declaration: before an ad goes to review (or straight to publication)
-- the seller confirms the information is true and that they have the right to
-- advertise it. Each confirmation is kept as permanent evidence: which
-- listing, which account, which version of the wording, and when.

insert into public.site_settings (key, value, is_public, description)
values ('declaration_version', '"draft-2026-10"', true, 'Version of the seller declaration wording shown when submitting an ad')
on conflict (key) do nothing;

create table public.listing_declarations (
  id         bigint generated always as identity primary key,
  listing_id bigint not null,               -- no foreign key: the evidence outlives the listing
  seller_id  uuid not null,
  version    text not null check (char_length(version) between 1 and 40),
  evidence   jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  created_at timestamptz not null default now()
);
create index listing_declarations_listing_idx on public.listing_declarations (listing_id, created_at desc);

alter table public.listing_declarations enable row level security;
grant select on public.listing_declarations to authenticated;
create policy "declarations: sellers read own" on public.listing_declarations
  for select to authenticated using (seller_id = (select auth.uid()));
create policy "declarations: admins read all" on public.listing_declarations
  for select to authenticated using ((select public.is_admin()));

-- Evidence is append-only: nobody (not even admins or the service key) can
-- change or delete a declaration.
create function public.forbid_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'record_is_permanent' using errcode = '42501';
end;
$$;
revoke execute on function public.forbid_change() from public;

create trigger listing_declarations_permanent
  before update or delete on public.listing_declarations
  for each row execute function public.forbid_change();

-- The only way to record a declaration: the seller, for their own listing.
create function public.declare_listing(p_listing_id bigint, p_evidence jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  bigint;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'account_not_active' using errcode = '42501';
  end if;
  if not exists (select 1 from public.listings where id = p_listing_id and seller_id = v_uid) then
    raise exception 'listing_not_found' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_evidence, '{}'::jsonb)) <> 'object' or pg_column_size(p_evidence) > 2048 then
    raise exception 'invalid_evidence' using errcode = '22023';
  end if;

  insert into public.listing_declarations (listing_id, seller_id, version, evidence)
  values (
    p_listing_id,
    v_uid,
    coalesce((select value #>> '{}' from public.site_settings where key = 'declaration_version'), 'unversioned'),
    coalesce(p_evidence, '{}'::jsonb)
  )
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.declare_listing(bigint, jsonb) from public;
grant execute on function public.declare_listing(bigint, jsonb) to authenticated;

-- A seller's submission needs a declaration made in the last 30 minutes for
-- the current wording. (Renewing an unchanged ad does not.)
create function public.listings_require_declaration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and auth.uid() = new.seller_id
     and not public.is_admin()
     and old.status in ('draft', 'rejected', 'withdrawn', 'expired')
     and new.status in ('pending_approval', 'published')
     and coalesce(current_setting('app.status_reason', true), '') <> 'renewed'
     and not exists (
       select 1 from public.listing_declarations d
       where d.listing_id = new.id
         and d.seller_id = new.seller_id
         and d.version = coalesce((select value #>> '{}' from public.site_settings where key = 'declaration_version'), 'unversioned')
         and d.created_at > now() - interval '30 minutes'
     )
  then
    raise exception 'declaration_required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.listings_require_declaration() from public;

create trigger listings_require_declaration
  before update of status on public.listings
  for each row execute function public.listings_require_declaration();
