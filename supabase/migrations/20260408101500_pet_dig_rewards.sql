create or replace function public.award_random_space_item(
  p_space_id uuid,
  p_user_id uuid default null
)
returns table (
  inventory_id text,
  item_id text,
  quantity integer,
  name text,
  type text,
  rarity text,
  description text,
  image_url text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_user_id uuid := coalesce(auth.uid(), p_user_id);
  target_table regclass := coalesce(to_regclass('public.space_items'), to_regclass('public.space_item'));
  random_item record;
  has_existing_inventory boolean := false;
begin
  if actor_user_id is null then
    raise exception 'User is required to dig for items.';
  end if;

  if p_space_id is null then
    raise exception 'Space is required to dig for items.';
  end if;

  if target_table is null then
    raise exception 'No space inventory table is available.';
  end if;

  select
    i.id as item_id,
    coalesce(i.name, 'Unknown item') as name,
    coalesce(i.type, '') as type,
    coalesce(i.rarity, '') as rarity,
    coalesce(i.description, '') as description,
    coalesce(i.image_url, '') as image_url
  into random_item
  from public.items i
  order by random()
  limit 1;

  if not found then
    raise exception 'No items are available for dig rewards.';
  end if;

  execute format(
    'select true from %s where space_id = $1 and item_id = $2 limit 1',
    target_table
  )
  into has_existing_inventory
  using p_space_id, random_item.item_id;

  if not coalesce(has_existing_inventory, false) then
    execute format(
      'insert into %s (space_id, item_id, quantity) values ($1, $2, 1)
       returning id::text, quantity::int',
      target_table
    )
    into inventory_id, quantity
    using p_space_id, random_item.item_id;
  else
    execute format(
      'with picked as (
         select ctid
         from %s
         where space_id = $1 and item_id = $2
         order by id asc
         limit 1
       )
       update %s target
       set quantity = coalesce(target.quantity, 0) + 1
       from picked
       where target.ctid = picked.ctid
       returning target.id::text, target.quantity::int',
      target_table,
      target_table
    )
    into inventory_id, quantity
    using p_space_id, random_item.item_id;
  end if;

  item_id := random_item.item_id::text;
  name := random_item.name;
  type := random_item.type;
  rarity := random_item.rarity;
  description := random_item.description;
  image_url := random_item.image_url;

  return next;
end;
$$;

grant execute on function public.award_random_space_item(uuid, uuid) to authenticated;
