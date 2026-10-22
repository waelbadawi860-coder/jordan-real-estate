-- Amman: the owner's own order for the most popular areas (2026-10-22).
-- The search row shows areas in this order; admins can change it later
-- in the dashboard (sort order). Every other Amman area moves after them.

update public.neighborhoods n
set sort_order = n.sort_order + 1000
from public.cities c
where c.id = n.city_id and c.slug = 'amman' and n.sort_order < 1000;

update public.neighborhoods n
set sort_order = v.ord
from (values
  ('abdoun', 1), ('dahiet-al-nakheel', 2), ('dhuhair', 3), ('deir-ghbar', 4), ('5th-circle', 5),
  ('khalda', 6), ('dabouq', 7), ('sweifieh', 8), ('abdali', 9), ('rabieh', 10),
  ('shmeisani', 11), ('um-al-summaq', 12), ('tla-al-ali', 13), ('gardens', 14), ('6th-circle', 15),
  ('kursi', 16), ('jabal-amman', 17), ('hummar', 18), ('medina-riyadiya', 19)
) as v (slug, ord), public.cities c
where c.slug = 'amman' and n.city_id = c.id and n.slug = v.slug;
