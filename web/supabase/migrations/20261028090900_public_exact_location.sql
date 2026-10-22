-- Owner decision 2026-10-22: the map position the seller adds is shown to
-- visitors as entered (the form tells the seller so; the listing page says
-- the position is as set by the advertiser and may not be exact). Before,
-- only a rounded (≈1 km) position was public.
grant select (latitude, longitude) on public.listings to anon, authenticated;
