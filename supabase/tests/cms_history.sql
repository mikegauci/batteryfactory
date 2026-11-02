begin;
do $$
declare actor uuid; pid uuid; mid uuid;
begin
 select id into actor from public.profiles where role='admin' limit 1;
 if actor is null then raise exception 'No test admin available'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.pages(path,title,status) values('cms-rollback-check-'||gen_random_uuid()::text,'Revision A','draft') returning id into pid;
 update public.pages set title='Revision B' where id=pid;
 if not exists(select 1 from public.content_history where record_key=pid::text and operation='UPDATE' and before_data->>'title'='Revision A' and after_data->>'title'='Revision B' and actor_id=actor) then raise exception 'History capture failed'; end if;
 insert into public.media(path,file_name,mime_type,size_bytes) values('cms-check-'||gen_random_uuid()::text||'.webp','cms-test.webp','image/webp',10) returning id into mid;
 update public.pages set hero_media_id=mid where id=pid;
 begin
 delete from public.media where id=mid;
 raise exception 'Used media deletion was allowed';
 exception when raise_exception then
 if SQLERRM='Used media deletion was allowed' then raise; end if;
 end;
 if has_table_privilege('anon','public.content_history','SELECT') then raise exception 'Anonymous history exposure'; end if;
 if has_table_privilege('authenticated','public.content_history','UPDATE') then raise exception 'History can be edited'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$ begin
 if exists(select 1 from public.content_history) then raise exception 'Non-admin can read history'; end if;
end $$;
rollback;
