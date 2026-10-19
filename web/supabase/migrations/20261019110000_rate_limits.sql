-- =============================================================================
-- Generic fixed-window rate limiter for server-side actions such as revealing
-- a seller's phone number. Keys are built by the server from a keyed hash of
-- the visitor's IP address, so raw IP addresses are never stored.
-- Only trusted server code (service_role) can call it.
-- =============================================================================

create table public.rate_limits (
  key          text not null check (char_length(key) between 3 and 200),
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;
-- No policies and no grants: invisible to anon/authenticated.

-- Records one hit and returns true if the caller is still within the limit.
create function public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz :=
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  if p_max < 1 or p_window_seconds < 1 then
    raise exception 'invalid_rate_limit' using errcode = '22023';
  end if;

  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;

  return v_hits <= p_max;
end;
$$;

revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- Daily clean-up of old windows.
select cron.schedule(
  'purge-rate-limits',
  '17 3 * * *',
  $$delete from public.rate_limits where window_start < now() - interval '2 days';$$
);
