alter table public.pet_state
  alter column xp type numeric(6,1) using coalesce(xp, 0)::numeric(6,1),
  alter column xp set default 0;

update public.pet_state
set xp = coalesce(xp, 0);

create table if not exists public.pet_xp_activity (
  id bigint generated always as identity primary key,
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null,
  action text not null,
  requested_xp numeric(3,1) not null,
  awarded_xp numeric(3,1) not null,
  activity_date date not null,
  created_at timestamp with time zone not null default timezone('utc', now())
);

create unique index if not exists pet_xp_activity_visit_once_per_day_idx
  on public.pet_xp_activity (space_id, user_id, activity_date, action)
  where action = 'visit';

create unique index if not exists pet_xp_activity_feed_once_per_day_idx
  on public.pet_xp_activity (space_id, user_id, activity_date, action)
  where action = 'feed';

create unique index if not exists pet_xp_activity_water_once_per_day_idx
  on public.pet_xp_activity (space_id, user_id, activity_date, action)
  where action = 'water';

create index if not exists pet_xp_activity_daily_lookup_idx
  on public.pet_xp_activity (space_id, user_id, activity_date);

create or replace function public.apply_pet_action(
  p_space_id uuid,
  p_action text,
  p_user_id uuid default null
)
returns table (
  xp_awarded numeric,
  total_xp numeric,
  nutrition numeric,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := coalesce(auth.uid(), p_user_id);
  action_date date := timezone('utc', now())::date;
  requested_xp_value numeric(3,1);
  granted_xp numeric(3,1);
  nutrition_delta numeric(3,1) := 0;
begin
  if actor_user_id is null then
    raise exception 'User is required to apply pet actions.';
  end if;

  case p_action
    when 'visit' then requested_xp_value := 1.0;
    when 'note' then requested_xp_value := 1.0;
    when 'calendar' then requested_xp_value := 1.0;
    when 'feed' then requested_xp_value := 1.0;
    when 'water' then
      requested_xp_value := 1.0;
      nutrition_delta := 1.0;
    else
      raise exception 'Unsupported pet action: %', p_action;
  end case;

  perform pg_advisory_xact_lock(hashtext(concat_ws(':', p_space_id::text, actor_user_id::text, action_date::text))::bigint);

  insert into public.pet_state (space_id, "Status", "Nutrition", xp)
  values (p_space_id, public.compute_pet_status(0), 0, 0)
  on conflict (space_id) do nothing;

  if p_action in ('visit', 'feed', 'water') and exists (
    select 1
    from public.pet_xp_activity
    where space_id = p_space_id
      and user_id = actor_user_id
      and activity_date = action_date
      and action = p_action
  ) then
    requested_xp_value := 0;
    nutrition_delta := 0;
  end if;

  granted_xp := requested_xp_value;

  if granted_xp > 0 then
    insert into public.pet_xp_activity (
      space_id,
      user_id,
      action,
      requested_xp,
      awarded_xp,
      activity_date
    )
    values (
      p_space_id,
      actor_user_id,
      p_action,
      requested_xp_value,
      granted_xp,
      action_date
    );
  end if;

  update public.pet_state
  set
    xp = coalesce(pet_state.xp, 0) + granted_xp,
    "Nutrition" = coalesce(pet_state."Nutrition", 0) + nutrition_delta,
    updated_at = timezone('utc', now())
  where pet_state.space_id = p_space_id;

  return query
  select
    granted_xp,
    coalesce(ps.xp, 0),
    coalesce(ps."Nutrition", 0),
    ps."Status"
  from public.pet_state ps
  where ps.space_id = p_space_id;
end;
$$;
