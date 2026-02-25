-- Leaderboard performance RPCs
-- Computes ranking in Postgres (instead of pulling full checkins into app memory)

create or replace function public.member_leaderboard_rankings(p_period text default 'all')
returns table (
  member_id uuid,
  checkins int,
  last_checkin_at timestamptz,
  rank int
)
language sql
stable
set search_path = public
as $$
  with bounds as (
    select
      (date_trunc('month', now() at time zone 'America/Jamaica') at time zone 'America/Jamaica') as month_start,
      ((date_trunc('month', now() at time zone 'America/Jamaica') + interval '1 month') at time zone 'America/Jamaica') as month_end
  ),
  grouped as (
    select
      c.member_id,
      count(*)::int as checkins,
      max(c.checked_in_at) as last_checkin_at
    from public.checkins c
    cross join bounds b
    where c.member_id is not null
      and (
        lower(coalesce(p_period, 'all')) <> 'month'
        or (c.checked_in_at >= b.month_start and c.checked_in_at < b.month_end)
      )
    group by c.member_id
  )
  select
    g.member_id,
    g.checkins,
    g.last_checkin_at,
    row_number() over (
      order by g.checkins desc, g.last_checkin_at desc nulls last, g.member_id asc
    )::int as rank
  from grouped g
$$;

create or replace function public.member_leaderboard_summary(
  p_member_id uuid,
  p_period text default 'all'
)
returns table (
  my_rank int,
  my_checkins int,
  total_ranked int,
  next_gap int
)
language sql
stable
set search_path = public
as $$
  with rankings as (
    select * from public.member_leaderboard_rankings(p_period)
  ),
  mine as (
    select r.rank, r.checkins
    from rankings r
    where r.member_id = p_member_id
    limit 1
  ),
  prev_rank as (
    select r.checkins
    from rankings r
    join mine m on r.rank = m.rank - 1
    limit 1
  )
  select
    (select rank from mine)::int as my_rank,
    coalesce((select checkins from mine), 0)::int as my_checkins,
    (select count(*)::int from rankings) as total_ranked,
    case
      when (select rank from mine) is null then null
      when (select rank from mine) <= 1 then null
      else greatest(coalesce((select checkins from prev_rank), 0) - coalesce((select checkins from mine), 0), 0)::int
    end as next_gap
$$;

create or replace function public.member_leaderboard_rows(
  p_member_id uuid,
  p_period text default 'all',
  p_view text default 'near',
  p_limit int default 25,
  p_near_window int default 5
)
returns table (
  member_id uuid,
  checkins int,
  last_checkin_at timestamptz,
  rank int
)
language sql
stable
set search_path = public
as $$
  with rankings as (
    select * from public.member_leaderboard_rankings(p_period)
  ),
  me as (
    select r.rank as my_rank
    from rankings r
    where r.member_id = p_member_id
    limit 1
  ),
  params as (
    select
      greatest(coalesce(p_limit, 25), 1) as top_limit,
      greatest(coalesce(p_near_window, 5), 1) as near_window,
      coalesce((select my_rank from me), 1) as anchor_rank,
      lower(coalesce(p_view, 'near')) as v
  )
  select r.member_id, r.checkins, r.last_checkin_at, r.rank
  from rankings r
  cross join params p
  where
    (
      p.v = 'top'
      and r.rank <= least(p.top_limit, 200)
    )
    or
    (
      p.v <> 'top'
      and r.rank between greatest(p.anchor_rank - p.near_window, 1) and (p.anchor_rank + p.near_window)
    )
  order by r.rank asc
$$;
