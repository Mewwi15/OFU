-- 0015_delete_account.sql
-- อู้ฟู่ (Oofoo) — PDPA "right to erasure". The customer anonymizes their own
-- account: PII is stripped, the account is deactivated, address book + device
-- tokens are removed, and order shipping snapshots are anonymized. The order
-- *records* are kept (financial/audit retention) but carry no personal data.
-- The client signs out afterwards.

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  -- 1) strip PII from the profile + deactivate
  update public.app_users set
    display_name  = 'ผู้ใช้ที่ลบบัญชี',
    email         = null,
    phone         = null,
    avatar_path   = null,
    is_anonymized = true,
    anonymized_at = now(),
    account_state = 'deactivated'::public.account_state_t,
    deactivated_at = now()
  where id = v_uid;

  -- 2) remove address book + device push tokens (PII / contactability)
  delete from public.addresses where user_id = v_uid;
  delete from public.push_tokens where user_id = v_uid;

  -- 3) anonymize the shipping snapshot on past orders (keep the order rows)
  update public.orders set
    ship_recipient    = null,
    ship_phone        = null,
    ship_address_text = null
  where customer_user_id = v_uid;
end $$;

revoke execute on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
