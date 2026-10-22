-- Lists now sort by ranked_at (publication or last "move to top"), so the
-- search indexes follow it. Keeps search fast as the number of ads grows.
create index listings_public_search_ranked_idx on public.listings (city_id, deal_type, property_type_id, ranked_at desc, id desc)
  where status = 'published';
create index listings_public_hood_ranked_idx on public.listings (neighborhood_id, ranked_at desc, id desc)
  where status = 'published';
create index listings_public_seller_ranked_idx on public.listings (seller_id, ranked_at desc)
  where status = 'published';
drop index if exists public.listings_public_search_idx;
drop index if exists public.listings_public_neighborhood_idx;
