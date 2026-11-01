-- "Make admin / remove admin" button on the user's page in the admin panel
-- (before this, only scripts/make-admin.mjs could do it).
--  * The acting admin must have signed in with the two-step code (aal2),
--    even when the "require two-step for admins" setting is off.
--  * Nobody changes their own role (no accidental self-lockout).
--  * Only active accounts can become admins.
--  * Every change goes to the audit log.
create function public.admin_set_user_role(p_user_id uuid, p_role public.app_role, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.app_role;
  v_status public.account_status;
begin
  if not public.is_admin() or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot_change_own_status' using errcode = 'P0001';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  select role, status into v_old, v_status from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if p_role = 'admin' and v_status <> 'active' then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;
  if v_old = p_role then
    return;
  end if;

  update public.profiles set role = p_role where id = p_user_id;

  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), case when p_role = 'admin' then 'grant_admin' else 'revoke_admin' end, 'profile', p_user_id::text,
          jsonb_build_object('from', v_old, 'to', p_role, 'reason', left(p_reason, 500)));
end;
$$;

revoke execute on function public.admin_set_user_role(uuid, public.app_role, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, public.app_role, text) to authenticated;
