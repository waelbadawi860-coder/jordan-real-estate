-- =============================================================================
-- Stage 8 security review (Supabase advisors):
-- * setting_int / setting_bool are only needed inside trusted database code;
--   remove direct API access so private settings can't be read.
-- * public_seller_info returns a name only for sellers who currently have a
--   public listing (it is shown on those listings anyway).
-- =============================================================================

revoke execute on function public.setting_int(text, integer) from anon, authenticated;
revoke execute on function public.setting_bool(text, boolean) from anon, authenticated;

create or replace function public.public_seller_info(p_seller_id uuid)
returns table (display_name text, member_since date)
language sql
stable
security definer
set search_path = ''
as $$
  select p.display_name, p.created_at::date
  from public.profiles p
  where p.id = p_seller_id
    and p.status = 'active'
    and exists (
      select 1 from public.listings l
      where l.seller_id = p.id and l.status = 'published' and l.expires_at > now()
    );
$$;
