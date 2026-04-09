create table if not exists public.web_push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  space_id uuid references public.spaces(id) on delete set null,
  endpoint text not null,
  endpoint_hash text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  pending_title text,
  pending_body text,
  pending_url text,
  pending_created_at timestamp with time zone,
  last_ping_sent_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  unique (endpoint_hash),
  unique (endpoint)
);

create index if not exists web_push_subscriptions_user_idx
  on public.web_push_subscriptions (user_id, updated_at desc);

create index if not exists web_push_subscriptions_space_idx
  on public.web_push_subscriptions (space_id, updated_at desc);

alter table public.web_push_subscriptions enable row level security;
