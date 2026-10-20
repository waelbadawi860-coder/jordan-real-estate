-- The brand is «عقار» in both languages (owner decision, 2026-10-20).
-- Admins can still change both names in the dashboard settings.
update public.site_settings set value = '"عقار"' where key = 'site_name_en' and value = '"Aqar"';
