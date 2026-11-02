-- Rollback-only integration tests. No imported rows are modified.
-- Run the whole file in one transaction (it ends with ROLLBACK).
begin;
do $$
declare
 p uuid := gen_random_uuid(); c uuid := gen_random_uuid(); c2 uuid := gen_random_uuid();
 c3 uuid := gen_random_uuid(); c4 uuid := gen_random_uuid(); live_c uuid := gen_random_uuid();
 lines jsonb; result uuid; duplicate uuid; rejected boolean; removed integer;
 soon timestamptz := now() + interval '35 minutes';
begin
 -- Browser roles can't call the checkout functions or read checkouts.
 if has_function_privilege('anon','public.reserve_shop_checkout(uuid,uuid,jsonb,integer,text,numeric,boolean,timestamptz)','execute')
 or has_function_privilege('authenticated','public.complete_shop_checkout(uuid,text,text,text,uuid,jsonb,jsonb,integer)','execute')
 or has_function_privilege('authenticated','public.purge_test_shop_checkouts()','execute')
 or has_function_privilege('anon','public.admin_save_product(uuid,jsonb,jsonb,uuid[])','execute')
 or has_table_privilege('anon','public.shop_checkouts','select') then raise exception 'Public checkout access'; end if;

 insert into public.products(id,slug,name,price_cents,status,manage_stock,stock_quantity)
 values(p,'checkout-test-'||p,'Checkout integration test',999,'published',true,3);
 lines := jsonb_build_array(jsonb_build_object('product_id',p,'variant_id',null,'name','Checkout integration test','quantity',2,'unit_price_cents',999,'option_values','{}'::jsonb));

 -- Reservation takes stock; a second one can't oversell.
 perform public.reserve_shop_checkout(c,null,lines,300,'Malta delivery',0.18,false,soon);
 if (select stock_quantity from public.products where id=p) <> 1 then raise exception 'Reservation stock'; end if;
 if (select livemode from public.shop_checkouts where id=c) then raise exception 'Test mode not recorded'; end if;
 rejected := false;
 begin perform public.reserve_shop_checkout(c2,null,lines,300,'Malta delivery',0.18,false,soon);
 exception when others then rejected := true; end;
 if not rejected then raise exception 'Overselling accepted'; end if;

 -- Expiry must be in the near future.
 rejected := false;
 begin perform public.reserve_shop_checkout(c2,null,lines,300,'Malta delivery',0.18,false,now() - interval '1 minute');
 exception when others then rejected := true; end;
 if not rejected then raise exception 'Past expiry accepted'; end if;

 -- Release is idempotent.
 perform public.release_shop_checkout(c);
 perform public.release_shop_checkout(c);
 if (select stock_quantity from public.products where id=p) <> 3 then raise exception 'Release not idempotent'; end if;

 -- Prices come from the database, not the client.
 rejected := false;
 begin perform public.reserve_shop_checkout(c2,null,jsonb_set(lines,'{0,unit_price_cents}','1'),300,'Malta delivery',0.18,false,soon);
 exception when others then rejected := true; end;
 if not rejected then raise exception 'Client price trusted'; end if;

 -- Payment checks: Malta only, exact total; duplicate deliveries make one order.
 perform public.reserve_shop_checkout(c2,null,lines,300,'Malta delivery',0.18,false,soon);
 rejected := false;
 begin perform public.complete_shop_checkout(c2,'test-'||c2,null,'test@example.invalid',null,'{}','{"country":"IT"}',2298);
 exception when others then rejected := true; end;
 if not rejected then raise exception 'Foreign address accepted'; end if;
 rejected := false;
 begin perform public.complete_shop_checkout(c2,'test-'||c2,null,'test@example.invalid',null,'{}','{"country":"MT"}',1);
 exception when others then rejected := true; end;
 if not rejected then raise exception 'Wrong payment accepted'; end if;
 result := public.complete_shop_checkout(c2,'test-'||c2,null,'test@example.invalid',null,'{}','{"country":"MT"}',2298);
 duplicate := public.complete_shop_checkout(c2,'test-'||c2,null,'test@example.invalid',null,'{}','{"country":"MT"}',2298);
 if result <> duplicate then raise exception 'Duplicate order'; end if;
 if (select count(*) from public.order_items where order_id=result) <> 1 then raise exception 'Duplicate lines'; end if;
 if (select vat_cents from public.orders where id=result) <> 351 then raise exception 'VAT rounding'; end if;
 if (select livemode from public.orders where id=result) then raise exception 'Order not marked as test'; end if;
 perform public.release_shop_checkout(c2);
 if (select stock_quantity from public.products where id=p) <> 1 then raise exception 'Paid checkout released'; end if;

 -- A payment after the reservation lapsed still becomes an order, takes the
 -- stock again (here overselling to -1) and leaves a note for the admin.
 perform public.reserve_shop_checkout(c3,null,jsonb_set(lines,'{0,quantity}','1'),300,'Malta delivery',0.18,false,soon);
 perform public.release_shop_checkout(c3);
 update public.products set stock_quantity=0 where id=p;
 result := public.complete_shop_checkout(c3,'test-'||c3,null,'test@example.invalid',null,'{}','{"country":"MT"}',1299);
 if (select stock_quantity from public.products where id=p) <> -1 then raise exception 'Late payment stock'; end if;
 if not exists(select 1 from public.order_notes where order_id=result) then raise exception 'Late payment note missing'; end if;

 -- A live checkout reserved alongside; purge must leave it alone.
 update public.products set stock_quantity=5 where id=p;
 perform public.reserve_shop_checkout(live_c,null,jsonb_set(lines,'{0,quantity}','1'),300,'Malta delivery',0.18,true,soon);
 perform public.reserve_shop_checkout(c4,null,jsonb_set(lines,'{0,quantity}','1'),300,'Malta delivery',0.18,false,soon);
 if (select stock_quantity from public.products where id=p) <> 3 then raise exception 'Mixed reservations'; end if;

 -- Purge: test orders (c2, c3) and test checkouts go, their stock comes
 -- back (c2: 2, c3: 1, c4 still reserved: 1); the live checkout stays.
 removed := public.purge_test_shop_checkouts();
 if removed <> 2 then raise exception 'Purge removed % orders', removed; end if;
 if exists(select 1 from public.shop_checkouts where not livemode) then raise exception 'Test checkouts left'; end if;
 if not exists(select 1 from public.shop_checkouts where id=live_c and state='reserved') then raise exception 'Live checkout purged'; end if;
 if (select stock_quantity from public.products where id=p) <> 7 then raise exception 'Purge stock %', (select stock_quantity from public.products where id=p); end if;
end $$;
rollback;
