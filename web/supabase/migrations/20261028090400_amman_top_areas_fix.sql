-- Follow-up: «أم أذينة» fills the 20th place after the owner's 19 areas.
-- Every other Amman area is renumbered behind them: the original 40 areas
-- in their previous order, then the areas added on 2026-10-22 by name.
update public.neighborhoods n
set sort_order = 20
from public.cities c
where c.id = n.city_id and c.slug = 'amman' and n.slug = 'um-uthaina';

update public.neighborhoods n
set sort_order = 100 + r.rn
from (
  select n2.id,
         row_number() over (order by (n2.created_at >= '2026-10-22'), case when n2.created_at < '2026-10-22' then n2.sort_order end, n2.name_ar) as rn
  from public.neighborhoods n2
  join public.cities c on c.id = n2.city_id
  where c.slug = 'amman' and n2.sort_order > 20
) r
where n.id = r.id;
