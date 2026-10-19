-- Fix: when admin approval is switched off, submitting publishes directly
-- (draft → published), which skipped the agreement check. Renewals of an
-- already-accepted listing are still allowed without re-accepting.
create or replace function public.listing_commission_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.status in ('pending_approval', 'published')
     and old.status in ('draft', 'rejected', 'withdrawn', 'expired')
     and coalesce(current_setting('app.status_reason', true), '') <> 'renewed'
     and public.setting_bool('commission_enabled', false)
     and not exists (
       select 1 from public.accepted_agreements a
       join public.agreement_versions v on v.id = a.agreement_version_id and v.is_current
       where a.listing_id = new.id
     ) then
    raise exception 'agreement_required' using errcode = 'P0001';
  end if;

  if new.status in ('sold', 'rented') and old.status in ('published', 'expired')
     and coalesce(current_setting('app.status_reason', true), '') <> 'transaction_reported'
     and exists (select 1 from public.accepted_agreements a where a.listing_id = new.id) then
    raise exception 'transaction_details_required' using errcode = 'P0001';
  end if;

  if new.deal_type is distinct from old.deal_type
     and exists (select 1 from public.accepted_agreements a where a.listing_id = new.id) then
    raise exception 'deal_type_locked' using errcode = 'P0001';
  end if;

  return new;
end;
$$;
