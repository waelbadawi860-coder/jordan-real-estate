-- =============================================================================
-- When a user requests account deletion, their live listings are withdrawn
-- immediately (records are kept; personal data is handled by an admin later).
-- =============================================================================

create or replace function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  update public.profiles
  set status = 'deletion_requested', deletion_requested_at = now(), status_changed_at = now()
  where id = auth.uid() and status in ('active', 'suspended');

  perform set_config('app.status_reason', 'account_deletion_requested', true);
  update public.listings
  set status = 'withdrawn'
  where seller_id = auth.uid() and status in ('pending_approval', 'published', 'expired');
end;
$$;
