create table if not exists public.user_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  space_id uuid references public.spaces(id) on delete set null,
  activity_type text not null,
  created_at timestamp with time zone not null default timezone('utc', now())
);

create index if not exists user_activity_user_created_at_idx
  on public.user_activity (user_id, created_at desc);

create index if not exists user_activity_space_created_at_idx
  on public.user_activity (space_id, created_at desc);

alter table public.user_activity enable row level security;

drop policy if exists "Users can read their own activity" on public.user_activity;
create policy "Users can read their own activity"
on public.user_activity
for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.log_user_activity(
  p_activity_type text,
  p_space_id uuid default null,
  p_user_id uuid default null
)
returns public.user_activity
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := coalesce(auth.uid(), p_user_id);
  inserted_activity public.user_activity;
begin
  if actor_user_id is null then
    raise exception 'User is required to log activity.';
  end if;

  insert into public.user_activity (
    user_id,
    space_id,
    activity_type
  )
  values (
    actor_user_id,
    p_space_id,
    p_activity_type
  )
  returning * into inserted_activity;

  return inserted_activity;
end;
$$;

grant execute on function public.log_user_activity(text, uuid, uuid) to anon;
grant execute on function public.log_user_activity(text, uuid, uuid) to authenticated;
