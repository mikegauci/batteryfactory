begin;
select set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='admin' limit 1),true);
set local role authenticated;
do $$
declare pid uuid; bid uuid; result integer;
begin
 insert into public.posts(slug,title,status) values('cms-rollback-'||gen_random_uuid()::text,'CMS bulk check','draft') returning id into pid;
 select public.admin_bulk_status('posts',array[pid],'published') into result;
 if result<>1 or not exists(select 1 from public.posts where id=pid and status='published' and published_at is not null) then raise exception 'Bulk publish failed'; end if;
 insert into public.businesses(slug,name,status) values('cms-rollback-'||gen_random_uuid()::text,'CMS bulk listing','draft') returning id into bid;
 perform public.admin_bulk_status('businesses',array[bid],'published');
 if not exists(select 1 from public.businesses where id=bid and status='published') then raise exception 'Directory bulk publish failed';end if;
 if not exists(select 1 from public.content_history where record_key=pid::text and operation='UPDATE') then raise exception 'Bulk history missing';end if;
end $$;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$begin
 begin
 perform public.admin_bulk_status('posts',array[gen_random_uuid()],'published');
 raise exception 'Non-admin bulk write allowed';
 exception when raise_exception then if SQLERRM='Non-admin bulk write allowed' then raise;end if;end;
 if has_function_privilege('anon','public.admin_bulk_status(text,uuid[],public.publish_status)','EXECUTE') then raise exception 'Anonymous bulk execution allowed';end if;
end $$;
rollback;
