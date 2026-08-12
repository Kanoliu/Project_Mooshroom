-- Re-run the shared chat bootstrap under a new migration version. This repairs
-- projects where the original chat migration was recorded but the table is absent.
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null,
  body text not null,
  bubble_size text not null,
  bubble_variant text not null,
  created_at timestamp with time zone not null default timezone('utc', now()),
  constraint chat_messages_body_length check (char_length(body) between 1 and 600),
  constraint chat_messages_sender_name_length check (char_length(sender_name) between 1 and 80),
  constraint chat_messages_bubble_variant_length check (char_length(bubble_variant) between 1 and 100),
  constraint chat_messages_bubble_size check (
    bubble_size in ('small', 'medium', 'large', 'extra-large')
  )
);

create index if not exists chat_messages_space_created_idx
  on public.chat_messages (space_id, created_at desc);

alter table public.chat_messages enable row level security;

drop policy if exists "Space members can read chat messages" on public.chat_messages;
create policy "Space members can read chat messages"
  on public.chat_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.space_members
      where space_members.space_id = chat_messages.space_id
        and space_members.user_id = auth.uid()
    )
  );

drop policy if exists "Space members can send chat messages" on public.chat_messages;
create policy "Space members can send chat messages"
  on public.chat_messages
  for insert
  to authenticated
  with check (
    sender_user_id = auth.uid()
    and exists (
      select 1
      from public.space_members
      where space_members.space_id = chat_messages.space_id
        and space_members.user_id = auth.uid()
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end
$$;
