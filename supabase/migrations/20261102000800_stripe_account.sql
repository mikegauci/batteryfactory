-- The shop's Stripe secret key, pasted by the admin in Admin → Payments, and
-- the webhook the site created with it. A single row. Holds secrets, so only
-- the service role reads it.
create table public.stripe_account (
  id boolean primary key default true check (id),
  secret_key text not null check (secret_key ~ '^(sk|rk)_(test|live)_[A-Za-z0-9]+$'),
  livemode boolean not null,
  account_id text not null default '',
  account_name text not null default '',
  webhook_endpoint_id text,
  webhook_url text,
  webhook_secret text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.stripe_account enable row level security;
revoke all on public.stripe_account from anon, authenticated;
