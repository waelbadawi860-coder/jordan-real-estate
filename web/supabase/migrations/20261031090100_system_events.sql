-- Monitoring inside the site: server errors and failed photo uploads, ad
-- saves and scheduled jobs are recorded (without personal data) and shown to
-- admins. When failures pile up, admins get one notification per hour.

create table public.system_events (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('server_error', 'photo_upload_failed', 'photo_publish_refused', 'listing_save_failed', 'job_failed')),
  source     text not null check (char_length(source) <= 120),
  detail     text check (char_length(detail) <= 300),
  created_at timestamptz not null default now()
);
create index system_events_recent_idx on public.system_events (created_at desc);

alter table public.system_events enable row level security;
grant select on public.system_events to authenticated;
create policy "system events: admins read" on public.system_events
  for select to authenticated using ((select public.is_admin()));
-- Written only by the server (service role) through the function below.

insert into public.site_settings (key, value, is_public, description)
values ('alert_failures_per_15min', '10', false, 'Failures within 15 minutes that notify the admins (at most once an hour; 0 = off)')
on conflict (key) do nothing;

create function public.record_system_event(p_kind text, p_source text, p_detail text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_threshold integer := public.setting_int('alert_failures_per_15min', 10);
  v_recent    integer;
begin
  insert into public.system_events (kind, source, detail)
  values (p_kind, left(coalesce(p_source, '?'), 120), left(p_detail, 300));

  -- Keep 30 days.
  delete from public.system_events where created_at < now() - interval '30 days';

  if v_threshold > 0 then
    select count(*) into v_recent from public.system_events where created_at > now() - interval '15 minutes';
    if v_recent >= v_threshold
       and not exists (select 1 from public.notifications
                       where type = 'system_failures' and created_at > now() - interval '1 hour') then
      perform public.notify_admins('system_failures', jsonb_build_object('count', v_recent));
    end if;
  end if;
end;
$$;
revoke execute on function public.record_system_event(text, text, text) from public, anon, authenticated;
grant execute on function public.record_system_event(text, text, text) to service_role;
