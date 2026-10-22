-- Prices for featured listings and "move to top" (whole Jordanian dinars),
-- shown on the public prices page and editable in the dashboard settings.
insert into public.site_settings (key, value, is_public, description) values
  ('price_feature_7_days',  '5',  true, 'Price (JOD) to feature a listing for 7 days'),
  ('price_feature_14_days', '9',  true, 'Price (JOD) to feature a listing for 14 days'),
  ('price_feature_30_days', '15', true, 'Price (JOD) to feature a listing for 30 days'),
  ('price_bump',            '2',  true, 'Price (JOD) to move a listing to the top once')
on conflict (key) do nothing;
