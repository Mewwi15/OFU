-- OFU MEMBER — แต้มสะสมและของแลก
-- เจ้าของสั่ง 4 ก.ย. 2026: "สะสมแต้มแลกเสื้อ แลกของ" · อัตรา "100 บาท 1 แต้ม"
-- และต้องได้แต้มทั้งลูกค้าที่ซื้อในแอปและลูกค้าที่เดินมาซื้อหน้าร้าน
--
-- ★ ทำไมเป็นบัญชีแยกประเภท (ledger) ไม่ใช่คอลัมน์ points ในตารางผู้ใช้ ★
-- ยอดเดียวลอย ๆ ตอบไม่ได้ว่าแต้มมาจากไหนและหายไปไหน วันที่ลูกค้าทักว่า "แต้มหาย"
-- จะไม่มีอะไรให้ตรวจเลย และถ้าโค้ดคำนวณพลาดรอบเดียวยอดจะเพี้ยนถาวรแก้กลับไม่ได้
-- แบบแยกประเภทคือทุกแต้มมีที่มา ย้อนดูได้ และยอดคงเหลือคำนวณใหม่ได้เสมอ
-- (สูตรเดียวกับ store_credit_ledger ที่ระบบใช้อยู่แล้ว)

-- ─────────────────────────────────────────────────────────────────────────────
-- อัตราแต้ม — ตั้งไว้ที่เดียว ทั้งหน้าร้านและในแอปใช้ตัวเดียวกัน
-- ลูกค้าไม่ต้องจำสองกฎ และวันที่จะเปลี่ยนอัตราก็แก้ที่เดียว
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.member_points_for(p_amount int)
returns int language sql immutable set search_path = '' as $$
  -- ปัดลงเสมอ: จ่าย 199 ได้ 1 แต้ม ไม่ใช่ 2 — ลูกค้าเข้าใจง่ายกว่าและร้านไม่เสียเปรียบ
  select greatest(0, coalesce(p_amount, 0) / 100);
$$;

create table if not exists public.member_points_ledger (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id),
  user_id      uuid not null references public.app_users(id),
  delta        int not null,   -- + ได้แต้ม / - ใช้แต้ม
  reason       text not null,
  -- ที่มาของแต้ม อย่างใดอย่างหนึ่ง (หรือไม่มีเลยถ้าแอดมินปรับมือ)
  order_id     uuid references public.orders(id) on delete set null,
  pos_sale_id  uuid references public.pos_sales(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists member_points_user_ix
  on public.member_points_ledger (user_id, created_at desc);

/* ★ กันให้แต้มซ้ำจากบิลใบเดียวกัน ★ ทริกเกอร์อาจถูกยิงซ้ำได้ (แก้สถานะออเดอร์ไปกลับ
   หรือ POS ส่งข้อมูลซ้ำตอนซิงก์ออฟไลน์) unique index บางส่วนทำให้ครั้งที่สองเงียบ ๆ
   ไม่เข้า แทนที่จะแจกแต้มฟรีทุกครั้งที่สถานะขยับ */
create unique index if not exists member_points_once_per_order
  on public.member_points_ledger (order_id) where order_id is not null and delta > 0;
create unique index if not exists member_points_once_per_pos_sale
  on public.member_points_ledger (pos_sale_id) where pos_sale_id is not null and delta > 0;

alter table public.member_points_ledger enable row level security;

-- ลูกค้าเห็นเฉพาะแต้มของตัวเอง แอดมินเห็นของร้านตัวเอง
create policy member_points_read on public.member_points_ledger for select
  using (user_id = auth.uid() or public.is_admin_of(shop_id));

grant select on public.member_points_ledger to authenticated;
grant select, insert, update, delete on public.member_points_ledger to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- แจกแต้มอัตโนมัติ — สองทางเข้า ทางเดียวกันหมดคือ ledger
-- ─────────────────────────────────────────────────────────────────────────────

/* ออเดอร์ในแอป: ให้แต้มตอน "ส่งถึงแล้ว" ไม่ใช่ตอนสั่ง
   สั่งแล้วยกเลิก/ตีกลับได้ ถ้าให้ตอนสั่งต้องมาไล่หักคืนทีหลัง ซึ่งพลาดง่ายและลูกค้า
   เห็นแต้มลดโดยไม่เข้าใจ ให้ตอนของถึงมือแล้วจบในครั้งเดียว */
create or replace function public.award_points_on_order()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_points int;
begin
  if new.order_status <> 'delivered' or coalesce(old.order_status, 'placed') = 'delivered' then
    return new;
  end if;
  v_points := public.member_points_for(new.total);
  if v_points <= 0 then
    return new;
  end if;
  insert into public.member_points_ledger (shop_id, user_id, delta, reason, order_id)
  values (new.shop_id, new.customer_user_id, v_points, 'ซื้อสินค้าในแอป', new.id)
  on conflict do nothing;  -- กันซ้ำ (ดู unique index ข้างบน)
  return new;
end $$;

drop trigger if exists award_points_on_order_t on public.orders;
create trigger award_points_on_order_t
  after update of order_status on public.orders
  for each row execute function public.award_points_on_order();

/* ขายหน้าร้าน: ให้แต้มเมื่อแคชเชียร์ผูกบิลกับบัญชีลูกค้าไว้ (customer_user_id)
   ★ ไม่ผูกบัญชี = ไม่มีแต้ม ★ ไม่ใช่ข้อจำกัด แต่เป็นเรื่องจำเป็น — ระบบไม่มีทางรู้ว่า
   คนที่ยืนอยู่หน้าเคาน์เตอร์คือใครถ้าไม่บอก ช่องค้นลูกค้าจากเบอร์โทรมีอยู่แล้วใน POS
   (findCustomerByPhone) แคชเชียร์แค่ถามเบอร์ก่อนปิดบิล */
create or replace function public.award_points_on_pos_sale()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_points int;
begin
  if new.customer_user_id is null or new.status <> 'completed' then
    return new;
  end if;
  v_points := public.member_points_for(new.total);
  if v_points <= 0 then
    return new;
  end if;
  insert into public.member_points_ledger (shop_id, user_id, delta, reason, pos_sale_id)
  values (new.shop_id, new.customer_user_id, v_points, 'ซื้อที่หน้าร้าน', new.id)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists award_points_on_pos_sale_t on public.pos_sales;
create trigger award_points_on_pos_sale_t
  after insert on public.pos_sales
  for each row execute function public.award_points_on_pos_sale();

-- ─────────────────────────────────────────────────────────────────────────────
-- ของแลก
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.member_rewards (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id),
  name          text not null,
  description   text,
  image_path    text,
  points_cost   int not null check (points_cost > 0),
  -- จำนวนที่มีให้แลก null = ไม่จำกัด
  stock         int check (stock >= 0),
  display_order int not null default 0,
  publish_state public.publish_state_t not null default 'draft',
  created_at    timestamptz not null default now()
);
create index if not exists member_rewards_ix
  on public.member_rewards (shop_id, publish_state, display_order);

alter table public.member_rewards enable row level security;
create policy member_rewards_read on public.member_rewards for select
  using (publish_state = 'published' or public.is_admin_of(shop_id));
grant select on public.member_rewards to anon, authenticated;
grant select, insert, update, delete on public.member_rewards to service_role;

create type public.reward_redemption_status_t as enum ('pending', 'collected', 'cancelled');

create table if not exists public.member_redemptions (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops(id),
  user_id      uuid not null references public.app_users(id),
  reward_id    uuid not null references public.member_rewards(id),
  -- โค้ดสั้น ๆ ที่ลูกค้ายื่นให้แคชเชียร์ดู
  code         text not null unique,
  points_cost  int not null,
  status       public.reward_redemption_status_t not null default 'pending',
  created_at   timestamptz not null default now(),
  collected_at timestamptz
);
create index if not exists member_redemptions_user_ix
  on public.member_redemptions (user_id, created_at desc);

alter table public.member_redemptions enable row level security;
create policy member_redemptions_read on public.member_redemptions for select
  using (user_id = auth.uid() or public.is_admin_of(shop_id));
grant select on public.member_redemptions to authenticated;
grant select, insert, update, delete on public.member_redemptions to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- ยอดแต้มคงเหลือ + รายการของแลก (ฝั่งลูกค้า)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.my_member_points()
returns int language sql stable security definer set search_path = '' as $$
  select coalesce(sum(delta), 0)::int
  from public.member_points_ledger
  where user_id = auth.uid();
$$;
grant execute on function public.my_member_points() to authenticated;

/**
 * แลกของ — ตัดแต้มทันทีที่กดแลก แล้วออกโค้ดไปรับของที่ร้าน
 *
 * ★ ตัดแต้มตอนกดแลก ไม่ใช่ตอนไปรับของ ★ ถ้าไม่ตัดตอนนี้ ลูกค้าคนเดียวกดแลกรัว ๆ ได้
 * ไม่จำกัดด้วยแต้มก้อนเดียว แล้วเดินไปรับของทีหลังทั้งหมด — ของหมดสต๊อกโดยที่แต้ม
 * ยังไม่ถูกใช้เลยสักแต้ม
 * ยกเลิกได้ (cancel_redemption) แล้วแต้มคืนเป็นรายการใหม่ในบัญชี ไม่ใช่ลบของเดิมทิ้ง
 */
create or replace function public.redeem_reward(p_reward_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_reward public.member_rewards;
  v_balance int;
  v_code text;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  /* ล็อกแถวของรางวัลไว้ — สองคนกดแลกชิ้นสุดท้ายพร้อมกัน ต้องมีคนเดียวที่ได้
     ไม่ใช่ทั้งคู่ได้แล้วสต๊อกติดลบ */
  select * into v_reward from public.member_rewards
   where id = p_reward_id and publish_state = 'published' for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message_th', 'ไม่พบของรางวัลนี้');
  end if;
  if v_reward.stock is not null and v_reward.stock <= 0 then
    return jsonb_build_object('ok', false, 'code', 'OUT_OF_STOCK', 'message_th', 'ของรางวัลหมดแล้ว');
  end if;

  select coalesce(sum(delta), 0)::int into v_balance
    from public.member_points_ledger where user_id = v_user;
  if v_balance < v_reward.points_cost then
    return jsonb_build_object('ok', false, 'code', 'NOT_ENOUGH',
      'message_th', format('แต้มไม่พอ ต้องมี %s แต้ม มีอยู่ %s', v_reward.points_cost, v_balance));
  end if;

  -- โค้ดสั้นอ่านออกทางโทรศัพท์ได้ ตัดตัวที่สับสน (0/O, 1/I) ออก
  v_code := 'R' || upper(substr(translate(encode(gen_random_bytes(6), 'base64'),
                                          '+/=OI01lL', 'ABCDXYZWV'), 1, 6));

  insert into public.member_redemptions (shop_id, user_id, reward_id, code, points_cost)
  values (v_reward.shop_id, v_user, v_reward.id, v_code, v_reward.points_cost)
  returning id into v_id;

  insert into public.member_points_ledger (shop_id, user_id, delta, reason)
  values (v_reward.shop_id, v_user, -v_reward.points_cost, 'แลก ' || v_reward.name);

  if v_reward.stock is not null then
    update public.member_rewards set stock = stock - 1 where id = v_reward.id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'code', v_code);
end $$;
grant execute on function public.redeem_reward(uuid) to authenticated;
