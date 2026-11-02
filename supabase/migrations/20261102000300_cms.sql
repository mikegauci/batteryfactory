create table public.content_history (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 actor_id uuid references auth.users(id) on delete set null,
 entity text not null, record_key text not null, operation text not null,
 before_data jsonb, after_data jsonb
);
create index content_history_recent on public.content_history(created_at desc);
alter table public.content_history enable row level security;
grant select on public.content_history to authenticated;
revoke all on public.content_history from anon;
create policy "Admins read history" on public.content_history for select to authenticated using ((select private.is_admin()));
create function private.capture_content_history() returns trigger language plpgsql security definer set search_path = '' as $$
declare previous jsonb; current_row jsonb;
begin
 if TG_OP <> 'INSERT' then previous := to_jsonb(OLD); end if;
 if TG_OP <> 'DELETE' then current_row := to_jsonb(NEW); end if;
 if TG_OP = 'UPDATE' and previous - 'updated_at' = current_row - 'updated_at' then return NEW; end if;
 insert into public.content_history(actor_id,entity,record_key,operation,before_data,after_data)
 values(auth.uid(),TG_TABLE_NAME,coalesce(current_row->>'id',previous->>'id',current_row->>'key',previous->>'key',current_row->>'source',previous->>'source'),TG_OP,previous,current_row);
 if TG_OP = 'DELETE' then return OLD; end if; return NEW;
end $$;
revoke all on function private.capture_content_history() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['pages','products','redirects','settings','media'] loop
 execute format('create trigger cms_history after insert or update or delete on public.%I for each row execute function private.capture_content_history()',t);
 end loop;
end $$;

revoke insert, update, delete on public.content_history from authenticated;
create function private.protect_used_media() returns trigger language plpgsql security definer set search_path='' as $$
declare t text; used boolean;
begin
 foreach t in array array['pages','products','product_media','product_categories','product_variants','settings'] loop
 execute format('select exists(select 1 from public.%I r where strpos(to_jsonb(r)::text,$1)>0 or strpos(to_jsonb(r)::text,$2)>0)',t) into used using OLD.id::text,OLD.path;
 if used then raise exception 'This file is used by %. Remove its content references first.',t; end if;
 end loop;
 if exists(select 1 from public.content_history h where h.entity in ('pages','products') and (strpos(h.before_data::text,OLD.id::text)>0 or strpos(h.before_data::text,OLD.path)>0)) then raise exception 'This file is retained by a saved content revision.'; end if;
 return OLD;
end $$;
revoke all on function private.protect_used_media() from public,anon,authenticated;
create trigger protect_used_media before delete on public.media for each row execute function private.protect_used_media();

create function private.admin_bulk_status(target_table text,target_ids uuid[],new_status public.publish_status) returns integer language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
 if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'Not authorised'; end if;
 if target_table <> all(array['pages','products']) or coalesce(array_length(target_ids,1),0) not between 1 and 100 then raise exception 'Select between 1 and 100 content records'; end if;
 execute format('update public.%I set status=$1 where id=any($2)',target_table) using new_status,target_ids;
 get diagnostics affected=row_count;return affected;
end $$;
revoke all on function private.admin_bulk_status(text,uuid[],public.publish_status) from public,anon;
grant execute on function private.admin_bulk_status(text,uuid[],public.publish_status) to authenticated;
create function public.admin_bulk_status(target_table text,target_ids uuid[],new_status public.publish_status) returns integer language sql security invoker set search_path='' as $$select private.admin_bulk_status(target_table,target_ids,new_status)$$;
revoke all on function public.admin_bulk_status(text,uuid[],public.publish_status) from public,anon;
grant execute on function public.admin_bulk_status(text,uuid[],public.publish_status) to authenticated;
do $$declare t text;begin
 foreach t in array array['profiles','product_categories','product_variants'] loop
 execute format('create trigger cms_history after insert or update or delete on public.%I for each row execute function private.capture_content_history()',t);
 end loop;
end $$;

-- null capabilities means full administrator; arrays grant only named CMS sections.
alter table public.profiles add column admin_capabilities text[];
alter table public.profiles add constraint valid_admin_capabilities check (
 (role='admin' or admin_capabilities is null) and
 (admin_capabilities is null or admin_capabilities <@ array['pages','products','orders','media']::text[])
);
create or replace function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and admin_capabilities is null)
$$;
create function private.has_admin_capability(capability text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin' and (admin_capabilities is null or capability=any(admin_capabilities)))
$$;
revoke all on function private.has_admin_capability(text) from public;
grant execute on function private.has_admin_capability(text) to anon,authenticated;

-- Replace existing admin predicates in each section's policies; preserve public/owner rules.
do $$ declare r record; scope text; statement text; begin
 for r in select * from pg_policies where schemaname in ('public','storage') loop
  scope := case when r.schemaname='storage' and r.tablename='objects' then 'media' else
   case r.tablename
    when 'pages' then 'pages'
    when 'products' then 'products' when 'product_variants' then 'products' when 'product_media' then 'products' when 'product_categories' then 'products' when 'product_tags' then 'products' when 'product_category_links' then 'products' when 'product_tag_links' then 'products'
    when 'orders' then 'orders' when 'order_items' then 'orders' when 'order_notes' then 'orders'
    when 'media' then 'media' end end;
  if scope is not null and (coalesce(r.qual,'')||coalesce(r.with_check,'')) like '%private.is_admin()%' then
   statement := format('alter policy %I on %I.%I',r.policyname,r.schemaname,r.tablename);
   if r.qual is not null then statement := statement || ' using (' || replace(r.qual,'private.is_admin()',format('private.has_admin_capability(%L)',scope)) || ')'; end if;
   if r.with_check is not null then statement := statement || ' with check (' || replace(r.with_check,'private.is_admin()',format('private.has_admin_capability(%L)',scope)) || ')'; end if;
   execute statement;
  end if;
 end loop;
 -- Scoped admins need the same checks in the existing product RPC.
 for r in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('admin_save_product') loop
  scope := 'products';
  execute replace(pg_get_functiondef(r.oid),'private.is_admin()',format('private.has_admin_capability(%L)',scope));
 end loop;
end $$;


create function private.protect_last_full_admin() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.role='admin' and old.admin_capabilities is null then
  if TG_OP='UPDATE' and new.role='admin' and new.admin_capabilities is null then return new; end if;
  perform pg_advisory_xact_lock(7244771);
  if not exists(select 1 from public.profiles where id<>old.id and role='admin' and admin_capabilities is null) then raise exception 'Keep at least one full administrator.' using errcode='23514'; end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function private.protect_last_full_admin() from public,anon,authenticated;
create trigger protect_last_full_admin before update of role,admin_capabilities or delete on public.profiles for each row execute function private.protect_last_full_admin();

create or replace function public.set_user_role(target_user uuid,new_role public.app_role) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Only full administrators can change roles' using errcode='42501'; end if;
 if target_user=auth.uid() then raise exception 'You cannot change your own access.'; end if;
 update public.profiles set role=new_role,admin_capabilities=null where id=target_user;
end $$;

create function public.admin_save_user_profile(target_user uuid,display_name text,new_username text,new_role public.app_role,capabilities text[]) returns void language plpgsql security definer set search_path='' as $$
declare previous public.profiles;
begin
 if not private.is_admin() then raise exception 'Only full administrators can manage users' using errcode='42501'; end if;
 select * into previous from public.profiles where id=target_user for update;
 if not found then raise exception 'User not found.'; end if;
 if target_user=auth.uid() and (previous.role is distinct from new_role or previous.admin_capabilities is distinct from capabilities) then raise exception 'You cannot change your own access.'; end if;
 if length(trim(display_name))>150 or length(trim(new_username))>32 then raise exception 'User details are too long.'; end if;
 update public.profiles set full_name=nullif(trim(display_name),''),username=nullif(lower(trim(new_username)),''),role=new_role,admin_capabilities=case when new_role='admin' then capabilities else null end where id=target_user;
end $$;
revoke all on function public.admin_save_user_profile(uuid,text,text,public.app_role,text[]) from public,anon;
grant execute on function public.admin_save_user_profile(uuid,text,text,public.app_role,text[]) to authenticated;

create function public.admin_list_users(search_text text default '',filter_role text default '',page_number integer default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.is_admin() then raise exception 'Only full administrators can manage users' using errcode='42501'; end if;
 if filter_role not in ('','admin','customer') then raise exception 'Unknown role.'; end if;
 with filtered as (
  select id,email,username,full_name,role,admin_capabilities,created_at from public.profiles
  where (filter_role='' or role::text=filter_role) and (trim(search_text)='' or strpos(lower(coalesce(full_name,'')||' '||coalesce(username,'')||' '||email),lower(left(trim(search_text),200)))>0)
 ), totals as (select count(*)::integer as total from filtered), pagination as (
  select total,greatest(1,(total+49)/50) as pages,least(greatest(1,coalesce(page_number,1)),greatest(1,(total+49)/50)) as page from totals
 ) select jsonb_build_object('total',total,'pages',pages,'page',page,'users',coalesce((select jsonb_agg(to_jsonb(u) order by u.created_at desc,u.id) from (select * from filtered order by created_at desc,id limit 50 offset ((select page from pagination)-1)*50) u),'[]'::jsonb)) into result from pagination;
 return result;
end $$;
revoke all on function public.admin_list_users(text,text,integer) from public,anon;
grant execute on function public.admin_list_users(text,text,integer) to authenticated;

-- Retain public uploads when deleting an account through the Auth Admin API.
create function public.admin_release_user_files(target_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() or target_user=auth.uid() then raise exception 'Not authorised' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=target_user) then raise exception 'User not found.'; end if;
 update storage.objects set owner=null,owner_id=null where owner_id=target_user::text or owner=target_user;
end $$;
revoke all on function public.admin_release_user_files(uuid) from public,anon;
grant execute on function public.admin_release_user_files(uuid) to authenticated;


-- Keep canonical redirects working without granting access to the site-wide redirect manager.
create function private.admin_content_redirect() returns trigger language plpgsql security definer set search_path='' as $$
declare prefix text; scope text;
begin
 if old.slug is not distinct from new.slug or old.status<>'published' then return new; end if;
 prefix := '/product/';
 scope := 'products';
 if private.has_admin_capability(scope) then
  insert into public.redirects(source,destination,permanent) values(prefix||old.slug||'/',prefix||new.slug||'/',true) on conflict(source) do update set destination=excluded.destination,permanent=true;
 end if;
 return new;
end $$;
revoke all on function private.admin_content_redirect() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['products'] loop
  execute format('create trigger admin_content_redirect after update of slug on public.%I for each row execute function private.admin_content_redirect()',t);
 end loop;
end $$;
