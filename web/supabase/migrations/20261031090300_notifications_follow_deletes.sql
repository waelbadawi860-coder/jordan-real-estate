-- A notification about something that no longer exists (a deleted ad,
-- commission, contact message, office or user) only leads to an empty page.
-- The automated tests create and delete such things all the time, which
-- filled the admins' bell. From now on deleting the thing deletes the
-- notifications about it, and the leftovers are removed once here.

create function public.delete_notifications_about()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- TG_ARGV[0] is the key in notifications.data that holds old.id.
  delete from public.notifications where data ->> tg_argv[0] = old.id::text;
  return old;
end;
$$;

revoke execute on function public.delete_notifications_about() from public, anon, authenticated;

create index notifications_listing_idx on public.notifications ((data ->> 'listing_id')) where data ? 'listing_id';

create trigger listings_delete_notifications after delete on public.listings
  for each row execute function public.delete_notifications_about('listing_id');
create trigger commission_records_delete_notifications after delete on public.commission_records
  for each row execute function public.delete_notifications_about('commission_id');
create trigger contact_messages_delete_notifications after delete on public.contact_messages
  for each row execute function public.delete_notifications_about('message_id');
create trigger offices_delete_notifications after delete on public.offices
  for each row execute function public.delete_notifications_about('office_id');
create trigger profiles_delete_notifications after delete on public.profiles
  for each row execute function public.delete_notifications_about('user_id');

-- One-time clean-up of what is already there.
delete from public.notifications n
where (n.data ? 'listing_id' and not exists (select 1 from public.listings x where x.id::text = n.data ->> 'listing_id'))
   or (n.data ? 'commission_id' and not exists (select 1 from public.commission_records x where x.id::text = n.data ->> 'commission_id'))
   or (n.data ? 'message_id' and not exists (select 1 from public.contact_messages x where x.id::text = n.data ->> 'message_id'))
   or (n.data ? 'office_id' and not exists (select 1 from public.offices x where x.id::text = n.data ->> 'office_id'))
   or (n.data ? 'user_id' and not exists (select 1 from public.profiles x where x.id::text = n.data ->> 'user_id'));
