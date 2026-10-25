-- The draft terms, privacy policy and seller declaration were revised after
-- the preliminary legal review (2026-10-25); new acceptances are recorded
-- against the new wording. Still drafts until the lawyer signs off.
update public.site_settings set value = '"draft-2026-10-25"'
where key in ('terms_version', 'privacy_version', 'declaration_version');
