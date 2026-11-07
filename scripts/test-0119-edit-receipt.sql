-- Run only in an isolated fixture database with the receipt migrations installed.
-- psql -v ON_ERROR_STOP=1 -d ofu_receipt_edit_test -f scripts/test-0119-edit-receipt.sql
begin;
do $$ begin
  if current_database() <> 'ofu_receipt_edit_test' then raise exception 'Isolated test database required'; end if;
end $$;

do $test$
declare
  shop uuid := gen_random_uuid();
  admin_id uuid := gen_random_uuid();
  customer_id uuid := gen_random_uuid();
  product_id uuid := gen_random_uuid();
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  original uuid; replacement uuid;
  request_id uuid := gen_random_uuid();
  received timestamptz := now()-interval '2 days';
  result jsonb; original_items jsonb; edited_items jsonb;
  before_movements int;
begin
  insert into public.shops(id) values(shop);
  insert into public.app_users(id,shop_id,role,account_state) values
    (admin_id,shop,'admin','active'),(customer_id,shop,'customer','active');
  insert into public.products(id,shop_id,name) values(product_id,shop,'Receipt edit fixture');
  insert into public.product_variants(id,product_id,barcode,price,stock_qty,cost_price) values
    (a,product_id,null,20,0,10),(b,product_id,'old-barcode',30,0,12);
  perform set_config('request.jwt.claim.sub',admin_id::text,true);
  original_items := jsonb_build_array(
    jsonb_build_object('variant_id',a,'qty',10,'unit_cost',10),
    jsonb_build_object('variant_id',b,'qty',5,'unit_cost',12));
  result := public.create_goods_receipt('supplier','doc','keep note',original_items,received);
  original := (result->>'id')::uuid;
  select count(*) into before_movements from public.stock_movements;

  update public.product_variants set barcode='new-barcode' where id=b;
  result := public.get_goods_receipt_lines(original);
  if jsonb_array_length(result)<>2 or not exists (
    select 1 from jsonb_array_elements(result) l where l->>'variant_id'=a::text and l->>'barcode' is null
  ) then raise exception 'READ: missing stable IDs or barcode-less product'; end if;
  if (select count(*) from public.stock_movements)<>before_movements then raise exception 'READ mutated stock'; end if;

  result := public.replace_goods_receipt(original,request_id,'supplier','doc','keep note',original_items,received);
  if (result->>'id')::uuid<>original or (select count(*) from public.stock_movements)<>before_movements then
    raise exception 'Unchanged save must do nothing';
  end if;

  begin
    perform public.replace_goods_receipt(original,request_id,'supplier','doc','keep note',
      jsonb_build_array(jsonb_build_object('variant_id',a,'qty',6,'unit_cost',10),
                       jsonb_build_object('variant_id',b,'qty',0,'unit_cost',12)),received);
    raise exception 'Expected VALIDATION';
  exception when sqlstate 'P0001' then
    if sqlerrm<>'VALIDATION' then raise; end if;
  end;
  if (select voided_at from public.goods_receipts where id=original) is not null
     or (select stock_qty from public.product_variants where id=a)<>10
     or (select stock_qty from public.product_variants where id=b)<>5
     or (select count(*) from public.stock_movements)<>before_movements
     or (select sum(qty_left) from public.stock_lots where variant_id=a)<>10 then
    raise exception 'Failed save must roll back receipt, quantities, movements and lots';
  end if;

  edited_items := jsonb_build_array(jsonb_build_object('variant_id',a,'qty',6,'unit_cost',11));
  result := public.replace_goods_receipt(original,request_id,'supplier','doc','keep note',edited_items,received);
  replacement := (result->>'id')::uuid;
  if replacement=original or (select voided_at from public.goods_receipts where id=original) is null
     or (select stock_qty from public.product_variants where id=a)<>6
     or (select stock_qty from public.product_variants where id=b)<>0
     or (result->>'total_cost')::numeric<>66
     or jsonb_array_length(result->'negative')<>0 then
    raise exception 'Successful save must replace atomically and apply quantity differences';
  end if;
  if jsonb_array_length(public.get_goods_receipt_lines(original))<>2 then
    raise exception 'Receipt detail must exclude void reversal lines';
  end if;
  select count(*) into before_movements from public.stock_movements;
  result := public.replace_goods_receipt(original,request_id,'supplier','doc','keep note',edited_items,received);
  if (result->>'id')::uuid<>replacement or (result->>'replay')::boolean<>true
     or (select count(*) from public.stock_movements)<>before_movements then
    raise exception 'Retry duplicated receipt or stock';
  end if;

  begin
    perform public.replace_goods_receipt(original,gen_random_uuid(),'supplier','doc','keep note',edited_items,received);
    raise exception 'Expected STALE_WRITE';
  exception when sqlstate 'P0001' then if sqlerrm<>'STALE_WRITE' then raise; end if; end;
  begin
    perform public.replace_goods_receipt(original,request_id,'changed','doc','keep note',edited_items,received);
    raise exception 'Expected STALE_WRITE for changed retry';
  exception when sqlstate 'P0001' then if sqlerrm<>'STALE_WRITE' then raise; end if; end;

  perform set_config('request.jwt.claim.sub',customer_id::text,true);
  begin
    perform public.replace_goods_receipt(replacement,gen_random_uuid(),'supplier','doc','keep note',edited_items,received);
    raise exception 'Expected FORBIDDEN';
  exception when sqlstate 'P0001' then if sqlerrm<>'FORBIDDEN' then raise; end if; end;
  if has_function_privilege('anon','public.replace_goods_receipt(uuid,uuid,text,text,text,jsonb,timestamptz)','EXECUTE') then
    raise exception 'Anonymous caller can execute receipt edit';
  end if;
  raise notice 'PASS: read-only opening, stable product IDs, unchanged save, atomic rollback, stock delta, retries, stale edits, authorization';
end $test$;
rollback;
