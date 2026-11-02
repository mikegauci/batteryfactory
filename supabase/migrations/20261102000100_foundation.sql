-- Foundation: profiles and roles, media library, CMS pages, redirects and
-- site settings. Adapted from the Rotta schema without its blog, directory,
-- events, videos and marketplace. Every migrated table keeps a `wp_id` so the
-- WordPress import can be re-run without creating duplicates.

-- ---------------------------------------------------------------- profiles

-- Roles: admin (CMS) and customer (shop account).
create type public.app_role as enum ('admin', 'customer');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  username text,
  full_name text,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_.-]{3,32}$')
);

create unique index profiles_username_key on public.profiles (lower(username));
create index profiles_role_idx on public.profiles (role);

comment on table public.profiles is 'One row per auth user. Role changes go through public.set_user_role().';

-- Helpers live in a schema that the Data API does not expose.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

create function private.user_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.user_role() = 'admin', false)
$$;

grant execute on function private.user_role() to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;

create function private.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Every sign-up becomes a customer; admin is never self-assigned.
create function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  wanted_username text := lower(nullif(trim(meta ->> 'username'), ''));
begin
  if wanted_username is not null
     and (wanted_username !~ '^[a-z0-9_.-]{3,32}$'
          or exists (select 1 from public.profiles where lower(username) = wanted_username)) then
    wanted_username := null;
  end if;

  insert into public.profiles (id, email, username, full_name)
  values (
    new.id,
    new.email,
    wanted_username,
    coalesce(
      nullif(trim(concat_ws(' ', meta ->> 'first_name', meta ->> 'last_name')), ''),
      nullif(trim(meta ->> 'full_name'), '')
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.handle_user_email_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

create function public.username_available(candidate text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(trim(candidate))
  )
$$;
grant execute on function public.username_available(text) to anon, authenticated;

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

-- Users may only edit these columns directly; role and email are protected.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, full_name) on public.profiles to authenticated;

create function public.set_user_role(target_user uuid, new_role public.app_role)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;
  update public.profiles set role = new_role where id = target_user;
end;
$$;
revoke execute on function public.set_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;

-- ---------------------------------------------------------------- media

-- Files live in the public `media` storage bucket; each has a row in
-- public.media with its alt text and dimensions.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', true,
  20971520, -- 20 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif', 'video/mp4', 'application/pdf']
);

create policy "Admins can upload media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (select private.is_admin()));
create policy "Admins can update media"
  on storage.objects for update to authenticated
  using (bucket_id = 'media' and (select private.is_admin()));
create policy "Admins can delete media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (select private.is_admin()));

create table public.media (
  id uuid primary key default gen_random_uuid(),
  wp_id bigint unique,
  path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  width integer,
  height integer,
  alt text not null default '',
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index media_created_at_idx on public.media (created_at desc);
create index media_uploaded_by_idx on public.media (uploaded_by);

-- ---------------------------------------------------------------- content

create type public.publish_status as enum ('draft', 'published');

-- Every public content type has an `seo` column (replaces Yoast):
-- {"title", "description", "og_media_id", "canonical", "noindex"}, all optional.

-- Free-form pages. Pages with a custom layout (home, shop...) live in code and
-- use this table for SEO and their editable content fields.
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  wp_id bigint unique,
  path text not null unique, -- e.g. 'custom-battery-manufacturing', no slashes at the ends
  title text not null,
  content text not null default '',
  hero_media_id uuid references public.media (id) on delete set null,
  status public.publish_status not null default 'draft',
  seo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pages_hero_media_idx on public.pages (hero_media_id);

create table public.redirects (
  id uuid primary key default gen_random_uuid(),
  source text not null unique, -- path with leading and trailing slash
  destination text not null,
  permanent boolean not null default true,
  hits integer not null default 0,
  created_at timestamptz not null default now()
);

-- Key/value site settings (navigation, contact details, shop...).
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger pages_touch_updated_at before update on public.pages
  for each row execute function private.touch_updated_at();
create trigger settings_touch_updated_at before update on public.settings
  for each row execute function private.touch_updated_at();

alter table public.media enable row level security;
alter table public.pages enable row level security;
alter table public.redirects enable row level security;
alter table public.settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['media', 'redirects', 'settings'] loop
    execute format('create policy "Anyone can read" on public.%I for select to anon, authenticated using (true)', t);
  end loop;
  execute $p$create policy "Published rows are public" on public.pages for select to anon, authenticated using (status = 'published' or (select private.is_admin()))$p$;
  foreach t in array array['media', 'pages', 'redirects', 'settings'] loop
    execute format('create policy "Admins can insert" on public.%I for insert to authenticated with check ((select private.is_admin()))', t);
    execute format('create policy "Admins can update" on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t);
    execute format('create policy "Admins can delete" on public.%I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;
end $$;
