-- Backfill: these objects were applied directly to production during the
-- Azure->Supabase migration but never committed. Idempotent, safe to re-run.
create table if not exists rate_limits (
  user_id text not null,
  route text not null,
  window_start timestamptz not null,
  count int not null default 1,
  primary key (user_id, route, window_start)
);

-- Atomic increment; returns the new count for this window.
create or replace function bump_rate_limit(
  p_user_id text,
  p_route text,
  p_window_start timestamptz
)
returns int
language sql volatile
as $$
  insert into rate_limits (user_id, route, window_start, count)
  values (p_user_id, p_route, p_window_start, 1)
  on conflict (user_id, route, window_start)
  do update set count = rate_limits.count + 1
  returning count;
$$;

-- Housekeeping, called opportunistically from api/_ratelimit.mjs.
create or replace function prune_rate_limits()
returns void
language sql volatile
as $$
  delete from rate_limits where window_start < now() - interval '2 hours';
$$;

alter table rate_limits enable row level security;
