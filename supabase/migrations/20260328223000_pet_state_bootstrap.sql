create or replace function public.compute_pet_status(nutrition_value numeric)
returns text
language plpgsql
as $$
begin
  if nutrition_value > 15 then
    return 'pet';
  elsif nutrition_value > 10 then
    return '3';
  elsif nutrition_value > 5 then
    return '1';
  else
    return '0';
  end if;
end;
$$;

create or replace function public.touch_pet_state_defaults()
returns trigger
language plpgsql
as $$
begin
  new."Nutrition" := coalesce(new."Nutrition", 0);
  new."Status" := public.compute_pet_status(new."Nutrition");
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists pet_state_apply_defaults on public.pet_state;

create trigger pet_state_apply_defaults
before insert or update on public.pet_state
for each row
execute function public.touch_pet_state_defaults();

create or replace function public.create_initial_pet_state()
returns trigger
language plpgsql
as $$
begin
  insert into public.pet_state (space_id, "Status", "Nutrition")
  values (new.id, '0', 0)
  on conflict (space_id) do nothing;

  return new;
end;
$$;

drop trigger if exists spaces_create_initial_pet_state on public.spaces;

create trigger spaces_create_initial_pet_state
after insert on public.spaces
for each row
execute function public.create_initial_pet_state();

insert into public.pet_state (space_id, "Status", "Nutrition")
select s.id, public.compute_pet_status(0), 0
from public.spaces s
left join public.pet_state ps on ps.space_id = s.id
where ps.space_id is null;

update public.pet_state
set
  "Nutrition" = coalesce("Nutrition", 0),
  "Status" = public.compute_pet_status(coalesce("Nutrition", 0)),
  updated_at = timezone('utc', now());
