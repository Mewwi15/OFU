-- 0043: edit-profile lets customers set a contact phone (app_users.phone).
--
-- Replaces update_profile with a 4-arg version. The old 3-arg overload is
-- dropped first — two overloads would make PostgREST RPC resolution ambiguous
-- (same failure mode as pos_sale, fixed in 0041).
--
-- Phone semantics: null = leave unchanged, '' = clear, otherwise must be a
-- normalized Thai mobile in E.164 without '+' ("66812345678") — the same
-- format auth.users.phone uses, so the (shop_id, phone) unique index keeps
-- deduplicating across phone-login and contact phones.

drop function if exists public.update_profile(text, text, text);

create function public.update_profile(
  p_display_name text default null,
  p_avatar_path  text default null,
  p_locale       text default null,
  p_phone        text default null
) returns public.app_users
language plpgsql security definer set search_path = '' as $$
declare v_row public.app_users;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  if p_phone is not null and p_phone <> '' and p_phone !~ '^66[0-9]{9}$' then
    raise exception 'BAD_PHONE' using errcode = '22000';
  end if;
  update public.app_users set
    display_name = coalesce(p_display_name, display_name),
    avatar_path  = coalesce(p_avatar_path, avatar_path),
    locale       = coalesce(p_locale, locale),
    phone        = case when p_phone is null then phone
                        when p_phone = ''   then null
                        else p_phone end
  where id = auth.uid()
  returning * into v_row;
  if v_row.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  return v_row;
end $$;

revoke execute on function public.update_profile(text, text, text, text) from public;
grant execute on function public.update_profile(text, text, text, text) to authenticated;
