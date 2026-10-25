-- "Follow similar listings" (owner request 2026-10-25): a signed-in user
-- follows a deal / property type / governorate / area combination. When a
-- matching listing is published for the first time they get an in-site
-- notification at once, and (when e-mail is set up) a daily e-mail digest.
-- Every e-mail carries a one-click unsubscribe link (unsubscribe_token).

create table public.saved_searches (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  deal_type         public.deal_type,
  property_type_id  bigint references public.property_types (id) on delete cascade,
  city_id           bigint references public.cities (id) on delete cascade,
  neighborhood_id   bigint references public.neighborhoods (id) on delete cascade,
  email_enabled     boolean not null default true,
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  created_at        timestamptz not null default now()
);
-- One follow per combination ("any" = null counts as a value here).
create unique index saved_searches_unique on public.saved_searches
  (user_id, deal_type, property_type_id, city_id, neighborhood_id) nulls not distinct;
create index saved_searches_match_idx on public.saved_searches (city_id, property_type_id);

alter table public.saved_searches enable row level security;
grant select, delete on public.saved_searches to authenticated;
grant insert (user_id, deal_type, property_type_id, city_id, neighborhood_id, email_enabled),
      update (email_enabled) on public.saved_searches to authenticated;
create policy "saved searches: owners read" on public.saved_searches for select to authenticated using (user_id = auth.uid());
create policy "saved searches: owners create" on public.saved_searches for insert to authenticated
  with check (
    user_id = auth.uid() and public.is_active_user()
    and (select count(*) from public.saved_searches s where s.user_id = auth.uid()) < 20
  );
create policy "saved searches: owners change" on public.saved_searches for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "saved searches: owners delete" on public.saved_searches for delete to authenticated using (user_id = auth.uid());

-- New matching listings waiting for the e-mail digest (server code only).
create table public.saved_search_hits (
  saved_search_id bigint not null references public.saved_searches (id) on delete cascade,
  listing_id      bigint not null,
  created_at      timestamptz not null default now(),
  emailed_at      timestamptz,
  primary key (saved_search_id, listing_id)
);
create index saved_search_hits_pending_idx on public.saved_search_hits (created_at) where emailed_at is null;
alter table public.saved_search_hits enable row level security; -- no policies: service role only

-- On first publication: notify followers (once per user) and queue the digest.
create function public.notify_saved_searches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'published' or old.status not in ('draft', 'pending_approval') then
    return null;
  end if;

  insert into public.saved_search_hits (saved_search_id, listing_id)
  select s.id, new.id
  from public.saved_searches s
  join public.profiles p on p.id = s.user_id and p.status = 'active'
  where s.user_id <> new.seller_id
    and s.email_enabled
    and (s.deal_type is null or s.deal_type = new.deal_type)
    and (s.property_type_id is null or s.property_type_id = new.property_type_id)
    and (s.city_id is null or s.city_id = new.city_id)
    and (s.neighborhood_id is null or s.neighborhood_id = new.neighborhood_id)
  on conflict do nothing;

  insert into public.notifications (user_id, type, data)
  select distinct s.user_id, 'similar_listing', jsonb_build_object('listing_id', new.id)
  from public.saved_searches s
  join public.profiles p on p.id = s.user_id and p.status = 'active'
  where s.user_id <> new.seller_id
    and (s.deal_type is null or s.deal_type = new.deal_type)
    and (s.property_type_id is null or s.property_type_id = new.property_type_id)
    and (s.city_id is null or s.city_id = new.city_id)
    and (s.neighborhood_id is null or s.neighborhood_id = new.neighborhood_id);
  return null;
end;
$$;
revoke execute on function public.notify_saved_searches() from public;
create trigger listings_notify_saved_searches
  after update of status on public.listings
  for each row execute function public.notify_saved_searches();

-- One-click unsubscribe from an e-mail link (no sign-in needed).
create function public.unsubscribe_saved_search(p_token uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with gone as (delete from public.saved_searches where unsubscribe_token = p_token returning 1)
  select exists (select 1 from gone);
$$;
revoke execute on function public.unsubscribe_saved_search(uuid) from public;
grant execute on function public.unsubscribe_saved_search(uuid) to anon, authenticated;
