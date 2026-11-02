begin;
-- Disposable users and listings exist only inside this rolled-back transaction.
do $$
declare owner_id uuid := gen_random_uuid(); other_id uuid := gen_random_uuid();
  own_listing uuid; other_listing uuid; term uuid;
begin
  insert into auth.users(id,email) values
    (owner_id,'codex-rollback-'||owner_id||'@example.invalid'),
    (other_id,'codex-rollback-'||other_id||'@example.invalid');
  update public.profiles set role='business_owner' where id in (owner_id,other_id);
  insert into public.businesses(slug,name,short_description,owner_id,status)
    values('codex-rollback-'||owner_id,'Owner delete test','Rollback fixture',owner_id,'published') returning id into own_listing;
  insert into public.businesses(slug,name,short_description,owner_id,status)
    values('codex-rollback-'||other_id,'Other owner test','Rollback fixture',other_id,'published') returning id into other_listing;
  select id into term from public.directory_terms limit 1;
  if term is not null then insert into public.business_terms(business_id,term_id) values(own_listing,term); end if;
  perform set_config('rotta_test.owner_id',owner_id::text,true);
  perform set_config('rotta_test.own_listing',own_listing::text,true);
  perform set_config('rotta_test.other_listing',other_listing::text,true);
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
end $$;
set local role authenticated;
do $$
declare affected integer;
begin
  delete from public.businesses where id=current_setting('rotta_test.other_listing')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Owner deleted another owner listing'; end if;
  delete from public.businesses where id=current_setting('rotta_test.own_listing')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner could not delete own listing'; end if;
end $$;
-- A signed-in visitor who owns no listing cannot delete another listing.
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$ declare affected integer; begin
  delete from public.businesses where id=current_setting('rotta_test.other_listing')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Unrelated account deleted a listing'; end if;
end $$;
reset role;
set local role anon;
do $$ declare affected integer; begin
  begin
    delete from public.businesses where id=current_setting('rotta_test.other_listing')::uuid;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'Anonymous deletion allowed'; end if;
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.businesses where id=current_setting('rotta_test.own_listing')::uuid) then raise exception 'Own listing still exists'; end if;
  if exists(select 1 from public.business_terms where business_id=current_setting('rotta_test.own_listing')::uuid) then raise exception 'Listing terms did not cascade'; end if;
  if not exists(select 1 from public.businesses where id=current_setting('rotta_test.other_listing')::uuid) then raise exception 'Other listing was removed'; end if;
  if not exists(select 1 from public.profiles where id=current_setting('rotta_test.owner_id')::uuid) then raise exception 'Owner account was removed'; end if;
  if not exists(select 1 from public.content_history where record_key=current_setting('rotta_test.own_listing') and operation='DELETE' and actor_id=current_setting('rotta_test.owner_id')::uuid) then raise exception 'Deletion audit missing'; end if;
end $$;
select 'Owner deletion, ownership denial, anonymous denial, cascade, account retention and audit passed' as result;
rollback;
