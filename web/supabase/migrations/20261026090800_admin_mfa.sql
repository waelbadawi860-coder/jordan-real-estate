-- Two-step login for administrators. When require_admin_mfa is on, a session
-- only counts as an administrator after the authenticator-app code was entered
-- (session level "aal2"), everywhere the database checks is_admin(). The live
-- site also enforces this in the app, whatever this setting says.

insert into public.site_settings (key, value, is_public, description)
values ('require_admin_mfa', 'false', true, 'Administrators must confirm an authenticator-app code (two-step login)')
on conflict (key) do nothing;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  )
  and (
    not public.setting_bool('require_admin_mfa', false)
    or coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
  );
$$;
