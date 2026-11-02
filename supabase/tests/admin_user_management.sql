begin;
-- All account/content fixtures and access changes are rolled back.
do $$ declare uid uuid; full_id uuid:=gen_random_uuid(); scoped_id uuid:=gen_random_uuid(); prefix text:='codex-users-'||gen_random_uuid()::text; i integer; post_id uuid; page_id uuid;
begin
 insert into auth.users(id,email) values(full_id,prefix||'-full@example.invalid'),(scoped_id,prefix||'-scoped@example.invalid');
 update public.profiles set role='admin',admin_capabilities=null where id=full_id;
 update public.profiles set role='admin',admin_capabilities=array['posts'] where id=scoped_id;
 for i in 1..51 loop
  uid:=gen_random_uuid(); insert into auth.users(id,email) values(uid,prefix||'-'||i||'@example.invalid');
  update public.profiles set full_name=prefix||' Customer '||i where id=uid;
 end loop;
 insert into public.posts(slug,title,status) values(prefix||'-post','Scoped draft','draft') returning id into post_id;
 insert into public.pages(path,title,status) values(prefix||'-page','Forbidden draft','draft') returning id into page_id;
 perform set_config('rotta_test.full',full_id::text,true);perform set_config('rotta_test.scoped',scoped_id::text,true);perform set_config('rotta_test.prefix',prefix,true);perform set_config('rotta_test.post',post_id::text,true);perform set_config('rotta_test.page',page_id::text,true);
 perform set_config('request.jwt.claim.sub',full_id::text,true);
end $$;
set local role authenticated;
do $$ declare first_page jsonb; second_page jsonb; result jsonb;
begin
 perform public.admin_release_user_files(current_setting('rotta_test.scoped')::uuid);
 first_page:=public.admin_list_users(current_setting('rotta_test.prefix'),'customer',1);
 second_page:=public.admin_list_users(current_setting('rotta_test.prefix'),'customer',2);
 if (first_page->>'total')::int<>51 or jsonb_array_length(first_page->'users')<>50 or jsonb_array_length(second_page->'users')<>1 then raise exception '50-user pagination failed'; end if;
 if exists(select 1 from jsonb_array_elements(first_page->'users') a join jsonb_array_elements(second_page->'users') b on a->>'id'=b->>'id') then raise exception 'Unstable pagination'; end if;
 result:=public.admin_list_users(current_setting('rotta_test.prefix'),'customer',9999);
 if result->>'page'<>'2' then raise exception 'Page clamp failed'; end if;
 result:=public.admin_list_users('literal,%_()','',1);
 if result->>'total'<>'0' then raise exception 'Search treated literal punctuation as wildcards'; end if;
 begin
  perform public.admin_save_user_profile(auth.uid(),'Self','','admin',array['posts']);
  raise exception 'Self-permission change allowed';
 exception when raise_exception then if SQLERRM='Self-permission change allowed' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('rotta_test.scoped'),true);
do $$ declare affected integer; begin
 if not exists(select 1 from public.admin_author_options() where id=current_setting('rotta_test.full')::uuid) then raise exception 'Author options missing'; end if;
 begin perform public.admin_release_user_files(current_setting('rotta_test.full')::uuid); raise exception 'Scoped admin released user files'; exception when insufficient_privilege then null; end;
 begin perform public.admin_directory_owner_id('nobody@example.invalid'); raise exception 'Scoped admin accessed owner lookup'; exception when insufficient_privilege then null; end;
 begin perform public.admin_directory_owner_email(gen_random_uuid()); raise exception 'Scoped admin accessed owner email'; exception when insufficient_privilege then null; end;
 if private.is_admin() or not private.has_admin_capability('posts') or private.has_admin_capability('orders') then raise exception 'Capability boundary failed'; end if;
 if not exists(select 1 from public.posts where id=current_setting('rotta_test.post')::uuid) then raise exception 'Allowed draft not readable'; end if;
 if exists(select 1 from public.pages where id=current_setting('rotta_test.page')::uuid) then raise exception 'Other section draft exposed'; end if;
 update public.posts set title='Scoped editor changed title',status='published' where id=current_setting('rotta_test.post')::uuid;
 get diagnostics affected=row_count;if affected<>1 then raise exception 'Allowed write failed';end if;
 update public.posts set slug=current_setting('rotta_test.prefix')||'-renamed' where id=current_setting('rotta_test.post')::uuid;
 begin perform public.admin_list_users('','',1); raise exception 'Restricted admin listed users'; exception when insufficient_privilege then null; end;
 begin perform public.set_user_role(auth.uid(),'admin'); raise exception 'Restricted admin escalated role'; exception when insufficient_privilege then null; end;
 begin update public.profiles set admin_capabilities=null where id=auth.uid(); raise exception 'Restricted admin escalated column'; exception when insufficient_privilege then null; end;
 begin insert into public.pages(path,title,status) values(current_setting('rotta_test.prefix')||'-blocked','Blocked','draft');raise exception 'Restricted admin wrote another section';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.redirects where source='/'||current_setting('rotta_test.prefix')||'-post/' and destination='/'||current_setting('rotta_test.prefix')||'-renamed/') then raise exception 'Scoped rename redirect missing'; end if;
 -- Changes to existing admins below are private to this transaction and rolled back.
 update public.profiles set admin_capabilities=array[]::text[] where role='admin' and admin_capabilities is null and id<>current_setting('rotta_test.full')::uuid;
 begin update public.profiles set admin_capabilities=array[]::text[] where id=current_setting('rotta_test.full')::uuid;raise exception 'Last full admin demoted';exception when check_violation then null;end;
 begin delete from public.profiles where id=current_setting('rotta_test.full')::uuid;raise exception 'Last full admin deleted';exception when check_violation then null;end;
end $$;
set local role anon;
do $$ begin
 begin perform public.admin_list_users('','',1);raise exception 'Anonymous user management allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select '50-user pagination, literal search, scoped read/write denial, escalation denial, redirects, last-admin and anonymous safeguards passed' as result;
rollback;
