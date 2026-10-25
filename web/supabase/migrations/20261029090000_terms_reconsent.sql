-- Asking for agreement again when the terms or privacy policy change.
-- The admin raises "terms_version" or "privacy_version" in the settings only
-- for a material change; every user whose latest recorded agreement is for an
-- older version (or who has none) must accept the current text before using
-- their account pages or submitting an ad.

-- Same kind of evidence as seller declarations: an anonymous IP fingerprint
-- and the browser name.
alter table public.user_consents
  add column evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object');

-- Users no longer write consent rows directly (they could pick any version
-- label); the function below records the current versions for them.
revoke insert on public.user_consents from authenticated;
drop policy "consents: record own" on public.user_consents;

-- Documents the signed-in user still has to accept, with the current version.
create function public.pending_consents()
returns table (document text, version text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.document, d.version
  from (
    values
      ('terms',   coalesce((select value #>> '{}' from public.site_settings where key = 'terms_version'), 'unversioned')),
      ('privacy', coalesce((select value #>> '{}' from public.site_settings where key = 'privacy_version'), 'unversioned'))
  ) as d (document, version)
  where auth.uid() is not null
    and d.version is distinct from (
      select c.version from public.user_consents c
      where c.user_id = auth.uid() and c.document = d.document
      order by c.accepted_at desc, c.id desc
      limit 1
    );
$$;
revoke execute on function public.pending_consents() from public;
grant execute on function public.pending_consents() to authenticated;

-- Records agreement to the current versions of every pending document.
-- Returns how many documents were accepted (0 when already up to date).
create function public.accept_current_terms(p_evidence jsonb default '{}'::jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_evidence, '{}'::jsonb)) <> 'object' or pg_column_size(p_evidence) > 2048 then
    raise exception 'invalid_evidence' using errcode = '22023';
  end if;

  insert into public.user_consents (user_id, document, version, evidence)
  select v_uid, p.document, p.version, coalesce(p_evidence, '{}'::jsonb)
  from public.pending_consents() p;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.accept_current_terms(jsonb) from public;
grant execute on function public.accept_current_terms(jsonb) to authenticated;

-- A seller can't submit an ad while an agreement is outstanding.
create function public.listings_require_current_terms()
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
     and exists (select 1 from public.pending_consents())
  then
    raise exception 'terms_consent_required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.listings_require_current_terms() from public;

create trigger listings_require_current_terms
  before update of status on public.listings
  for each row execute function public.listings_require_current_terms();

update public.site_settings
set description = description || '. Raising it asks every user to accept the new text again'
where key in ('terms_version', 'privacy_version')
  and description not like '%accept the new text again%';
