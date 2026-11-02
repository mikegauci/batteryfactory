-- The shop's Stripe account, linked through Stripe Connect (OAuth). One row
-- per mode, so a test connection and a live one can exist side by side.
-- Holds the webhook signing secret, so only the service role reads it.
create table public.stripe_connection (
  livemode boolean primary key,
  account_id text not null check (account_id ~ '^acct_[A-Za-z0-9]+$'),
  account_name text not null default '',
  webhook_endpoint_id text,
  webhook_url text,
  webhook_secret text,
  connected_by uuid references public.profiles (id) on delete set null,
  connected_at timestamptz not null default now()
);

alter table public.stripe_connection enable row level security;
revoke all on public.stripe_connection from anon, authenticated;
