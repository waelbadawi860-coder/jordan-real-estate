-- Paid promotions (owner decision 2026-10-22, no sales commission):
--   * featured: shown in a "featured" block at the top of matching searches
--     until featured_until;
--   * bump ("move to top"): the listing sorts as if it was just published.
-- Until online payment exists, an admin records each promotion after the
-- seller has paid (CliQ, eFAWATEERcom, cash). Sellers cannot set these
-- columns: listings updates are column-level grants and these are not
-- granted, so only admin_promote_listing() writes them.

alter table public.listings
  add column featured_until timestamptz,
  add column bumped_at timestamptz,
  -- The date lists sort by ("newest"): publication, or the last move to top.
  add column ranked_at timestamptz generated always as (greatest(published_at, bumped_at)) stored;

grant select (featured_until, bumped_at, ranked_at) on public.listings to anon, authenticated;

create index listings_public_ranked_idx on public.listings (ranked_at desc, id desc)
  where status = 'published';
create index listings_public_featured_idx on public.listings (featured_until)
  where status = 'published' and featured_until is not null;

-- Every promotion, kept permanently (what was sold, when, by whom, paid how).
create table public.listing_promotions (
  id             bigint generated always as identity primary key,
  listing_id     bigint not null references public.listings (id) on delete restrict,
  kind           text not null check (kind in ('feature', 'bump', 'unfeature')),
  days           smallint check (days between 1 and 90),
  featured_until timestamptz,
  amount         numeric(10, 3) check (amount >= 0 and amount <= 100000),
  payment_ref    text check (char_length(payment_ref) <= 100),
  note           text check (char_length(note) <= 500),
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index listing_promotions_listing_idx on public.listing_promotions (listing_id, created_at desc);

alter table public.listing_promotions enable row level security;
grant select on public.listing_promotions to authenticated;
create policy "promotions: admins read" on public.listing_promotions
  for select to authenticated using (public.is_admin());
create policy "promotions: owners read own" on public.listing_promotions
  for select to authenticated using (
    exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
  );

create trigger listing_promotions_permanent
  before update or delete on public.listing_promotions
  for each row execute function public.forbid_change_except_unlink('created_by');
create trigger listing_promotions_no_truncate
  before truncate on public.listing_promotions
  for each statement execute function public.forbid_truncate();

-- The only way to promote a listing. Returns featured_until after the change.
create function public.admin_promote_listing(
  p_listing_id  bigint,
  p_kind        text,
  p_days        integer default null,
  p_amount      numeric default null,
  p_payment_ref text default null,
  p_note        text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing public.listings%rowtype;
  v_until   timestamptz;
begin
  if not public.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('feature', 'bump', 'unfeature') then
    raise exception 'invalid_kind' using errcode = '23514';
  end if;
  select * into v_listing from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'listing_not_found' using errcode = 'P0002';
  end if;
  if p_kind in ('feature', 'bump') and v_listing.status <> 'published' then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;

  if p_kind = 'feature' then
    if p_days is null or p_days not between 1 and 90 then
      raise exception 'invalid_days' using errcode = '23514';
    end if;
    -- Buying again while still featured adds the days on top.
    v_until := greatest(coalesce(v_listing.featured_until, now()), now()) + make_interval(days => p_days);
    update public.listings set featured_until = v_until where id = p_listing_id;
  elsif p_kind = 'bump' then
    v_until := v_listing.featured_until;
    update public.listings set bumped_at = now() where id = p_listing_id;
  else
    v_until := null;
    update public.listings set featured_until = null where id = p_listing_id;
  end if;

  insert into public.listing_promotions (listing_id, kind, days, featured_until, amount, payment_ref, note, created_by)
  values (p_listing_id, p_kind, case when p_kind = 'feature' then p_days end, v_until,
          p_amount, nullif(btrim(p_payment_ref), ''), nullif(btrim(p_note), ''), auth.uid());

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'listing_promotion', 'listing', p_listing_id::text,
          jsonb_build_object('kind', p_kind, 'days', p_days, 'featured_until', v_until,
                             'amount', p_amount, 'payment_ref', p_payment_ref));

  if p_kind in ('feature', 'bump') then
    insert into public.notifications (user_id, type, data)
    values (v_listing.seller_id, case when p_kind = 'feature' then 'listing_featured' else 'listing_bumped' end,
            jsonb_build_object('listing_id', p_listing_id, 'until', v_until));
  end if;

  return v_until;
end;
$$;
revoke execute on function public.admin_promote_listing(bigint, text, integer, numeric, text, text) from public;
grant execute on function public.admin_promote_listing(bigint, text, integer, numeric, text, text) to authenticated;
