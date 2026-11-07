-- Supabase also grants new functions directly to anon through default ACLs.
-- Revoking PUBLIC alone does not remove that explicit grant.
begin;
revoke execute on function public.replace_goods_receipt(uuid,uuid,text,text,text,jsonb,timestamptz) from public, anon;
revoke execute on function public.get_goods_receipt_lines(uuid) from public, anon;
grant execute on function public.replace_goods_receipt(uuid,uuid,text,text,text,jsonb,timestamptz) to authenticated;
grant execute on function public.get_goods_receipt_lines(uuid) to authenticated;
do $$ begin
  if has_function_privilege('anon','public.replace_goods_receipt(uuid,uuid,text,text,text,jsonb,timestamptz)','EXECUTE')
    or has_function_privilege('anon','public.get_goods_receipt_lines(uuid)','EXECUTE') then
    raise exception 'Receipt RPCs must not be executable by anon';
  end if;
end $$;
commit;
