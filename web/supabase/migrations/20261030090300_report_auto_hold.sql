-- Automatic hold after several reports (owner decision 2026-10-27): when
-- enough DIFFERENT signed-in users report the same published ad within 24
-- hours, it is hidden ("on hold") until an admin reviews it, and the admins
-- and the seller are told. Visitors who aren't signed in don't count, and each
-- account can only have one open report per ad, so one person can't trigger it.
-- 0 switches it off.

insert into public.site_settings (key, value, is_public, description)
values ('report_auto_hold_threshold', '3', false,
        'Different signed-in users reporting the same ad within 24 hours before it is put on hold automatically (0 = off)')
on conflict (key) do nothing;

create function public.listing_reports_auto_hold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_threshold integer := public.setting_int('report_auto_hold_threshold', 3);
  v_reporters integer;
  v_seller    uuid;
begin
  if v_threshold <= 0 or new.reporter_id is null then
    return null;
  end if;

  select count(distinct reporter_id) into v_reporters
  from public.listing_reports
  where listing_id = new.listing_id
    and reporter_id is not null
    and status in ('open', 'reviewing')
    and created_at > now() - interval '24 hours';
  if v_reporters < v_threshold then
    return null;
  end if;

  perform set_config('app.status_reason', 'auto_hold_reports', true);
  update public.listings
  set status = 'on_hold'
  where id = new.listing_id and status = 'published'
  returning seller_id into v_seller;
  if v_seller is null then
    return null; -- not live (already held, withdrawn, ...)
  end if;

  perform public.notify_admins('listing_auto_held', jsonb_build_object('listing_id', new.listing_id, 'reports', v_reporters));
  insert into public.notifications (user_id, type, data)
  values (v_seller, 'listing_status_changed',
          jsonb_build_object('listing_id', new.listing_id, 'status', 'on_hold', 'reason', 'auto_hold_reports'));
  return null;
end;
$$;
revoke execute on function public.listing_reports_auto_hold() from public;

create trigger listing_reports_auto_hold
  after insert on public.listing_reports
  for each row execute function public.listing_reports_auto_hold();
