-- ผลการส่ง SMS จริงมาทีหลัง ไม่ใช่ตอนกดส่ง
--
-- ★ สิ่งที่เข้าใจผิดตอนแรก ★ (แก้ 14 ก.ย. 2026) — คิดว่าคำตอบตอนยิงบอกได้ว่าส่งถึงไหม
-- แต่พิสูจน์กับเบอร์ที่ถูกบล็อกจริงแล้วพบว่า ตอนยิงเขาตอบ block: 0, send: 1 (เหมือนสำเร็จ)
-- แล้วค่อยเปลี่ยนเป็น block: 1 ในบันทึกของเขาทีหลัง
-- ผลคือระบบเราบันทึกว่า "ส่งสำเร็จ" ทุกครั้ง รายการเบอร์ที่รับไม่ได้จึงว่างเปล่าเสมอ
--
-- ทางที่ถูกคือรับผลจาก webhook ของผู้ให้บริการ — ตารางนี้จึงต้องเก็บ "ยังไม่รู้ผล" ได้
-- และต้องจำรหัสอ้างอิงของข้อความไว้จับคู่ตอนผลกลับมา

begin;

/* ยังไม่รู้ผล = null · รู้แล้วค่อยเป็น true/false — ของเดิมบังคับต้องตอบทันทีว่าสำเร็จ
   หรือไม่ ซึ่งเป็นข้อมูลที่ ณ ตอนนั้นยังไม่มีใครรู้ */
alter table public.sms_otp_attempts alter column ok drop not null;

alter table public.sms_otp_attempts
  add column if not exists provider_ref text,   -- ref_no จากผู้ให้บริการ
  add column if not exists provider_id  text,   -- id ของข้อความฝั่งเขา
  add column if not exists settled_at   timestamptz;

create index if not exists sms_otp_attempts_ref_ix
  on public.sms_otp_attempts (provider_ref) where provider_ref is not null;
create index if not exists sms_otp_attempts_pid_ix
  on public.sms_otp_attempts (provider_id) where provider_id is not null;
/* หารายการที่ยังรอผลได้เร็ว — ตัวตามผลวิ่งผ่านตารางนี้ทุกครั้งที่เปิดหน้าหลังร้าน */
create index if not exists sms_otp_attempts_pending_ix
  on public.sms_otp_attempts (created_at desc) where ok is null;

/* ★ ตัวตามผลต้องแก้แถวเดิมได้ ★ 0110 ให้สิทธิ์แค่ select/insert/delete เพราะตอนนั้น
   คิดว่าผลรู้ทันทีตั้งแต่ตอนส่ง ไม่มีอะไรต้องกลับมาแก้ */
grant update on public.sms_otp_attempts to service_role;

/**
 * เบอร์ที่ส่ง OTP ไม่สำเร็จ — อัปเดตให้เข้าใจสถานะ "ยังไม่รู้ผล"
 *
 * นับเฉพาะที่รู้แล้วว่าไม่สำเร็จ (ok = false) · รายการที่ยังรอผลไม่ขึ้น เพราะส่วนใหญ่
 * อีกไม่กี่วินาทีก็สำเร็จ การเอามาขึ้นก่อนจะกลายเป็นเตือนผิดทุกครั้งที่มีคนล็อกอิน
 */
create or replace function public.failed_otp_phones(p_days int default 7)
returns table (phone text, tries int, reason text, last_try timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.phone,
         count(*)::int,
         (array_agg(a.reason order by a.created_at desc))[1],
         max(a.created_at)
    from public.sms_otp_attempts a
   where a.ok is false
     and a.created_at > now() - make_interval(days => greatest(p_days, 1))
     /* เบอร์ที่ภายหลังส่งสำเร็จแล้ว ไม่ต้องขึ้นค้างให้ตามอีก — เทียบด้วยลำดับแถวควบคู่
        กับเวลา เพราะสองครั้งในวินาทีเดียวกันมีเวลาเท่ากันได้ */
     and not exists (
       select 1 from public.sms_otp_attempts s
        where s.phone = a.phone and s.ok is true
          and (s.created_at, s.id) > (a.created_at, a.id)
     )
   group by a.phone
   order by max(a.created_at) desc
   limit 50;
$$;

commit;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $$
begin
  if (select is_nullable from information_schema.columns
       where table_schema='public' and table_name='sms_otp_attempts' and column_name='ok') <> 'YES' then
    raise exception 'คอลัมน์ ok ต้องเก็บค่าว่าง (ยังไม่รู้ผล) ได้';
  end if;
  if not exists (select 1 from information_schema.columns
       where table_schema='public' and table_name='sms_otp_attempts' and column_name='provider_ref') then
    raise exception 'provider_ref หายไป';
  end if;
  raise notice '0111 พร้อม — รอผลจริงจาก webhook ของผู้ให้บริการ';
end $$;
