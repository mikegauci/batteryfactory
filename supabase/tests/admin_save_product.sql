-- Rollback-only test of the atomic product save, run as the first admin.
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from public.profiles where email='mikegauci@gmail.com' and role='admin'), 'role','authenticated')::text, true);
set local role authenticated;
do $$
declare saved uuid; v1 uuid := gen_random_uuid(); v2 uuid := gen_random_uuid(); m uuid; rejected boolean := false; other uuid;
begin
 select id into m from public.media limit 1;
 -- New product with two variants and a gallery.
 saved := public.admin_save_product(null,
   '{"slug":"atomic-save-test","name":"Atomic save test","price_cents":1000,"sale_price_cents":null,"manage_stock":false,"stock_quantity":null,"stock_status":"in_stock","options":[{"name":"Size","values":["S","M"]}],"featured_media_id":null,"status":"draft","sort_order":0,"seo":{}}',
   jsonb_build_array(
     jsonb_build_object('id',v1,'option_values','{"Size":"S"}'::jsonb,'sku',null,'price_cents',1000,'sale_price_cents',null,'manage_stock',false,'stock_quantity',null,'stock_status','in_stock','image_media_id',null,'sort_order',0),
     jsonb_build_object('id',v2,'option_values','{"Size":"M"}'::jsonb,'sku',null,'price_cents',1100,'sale_price_cents',null,'manage_stock',false,'stock_quantity',null,'stock_status','in_stock','image_media_id',null,'sort_order',1)),
   array[m]);
 if (select count(*) from public.product_variants where product_id=saved) <> 2 then raise exception 'variants not saved'; end if;
 if (select count(*) from public.product_media where product_id=saved) <> 1 then raise exception 'gallery not saved'; end if;
 -- Swapping option values must not trip the unique constraint.
 perform public.admin_save_product(saved,
   '{"slug":"atomic-save-test","name":"Atomic save test","price_cents":1000,"manage_stock":false,"stock_status":"in_stock","options":[{"name":"Size","values":["S","M"]}],"status":"draft","seo":{}}',
   jsonb_build_array(
     jsonb_build_object('id',v1,'option_values','{"Size":"M"}'::jsonb,'price_cents',1000,'manage_stock',false,'stock_status','in_stock','sort_order',0),
     jsonb_build_object('id',v2,'option_values','{"Size":"S"}'::jsonb,'price_cents',1100,'manage_stock',false,'stock_status','in_stock','sort_order',1)),
   array[]::uuid[]);
 if (select option_values->>'Size' from public.product_variants where id=v1) <> 'M' then raise exception 'swap failed'; end if;
 if exists(select 1 from public.product_media where product_id=saved) then raise exception 'gallery not cleared'; end if;
 -- Another product's variant can't be moved here; nothing of the save sticks.
 select id into other from public.product_variants where product_id <> saved limit 1;
 begin
   perform public.admin_save_product(saved,
     '{"slug":"atomic-save-test","name":"Renamed","price_cents":1000,"manage_stock":false,"stock_status":"in_stock","options":[],"status":"draft","seo":{}}',
     jsonb_build_array(jsonb_build_object('id',other,'option_values','{}'::jsonb,'price_cents',1,'manage_stock',false,'stock_status','in_stock','sort_order',0)),
     array[]::uuid[]);
 exception when others then rejected := true; end;
 if not rejected then raise exception 'reparenting accepted'; end if;
 if (select name from public.products where id=saved) <> 'Atomic save test' then raise exception 'partial save leaked'; end if;
 if (select count(*) from public.product_variants where product_id=saved) <> 2 then raise exception 'variants lost on failed save'; end if;
end $$;
rollback;
