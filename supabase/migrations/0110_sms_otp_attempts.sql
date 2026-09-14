-- บันทึกทุกครั้งที่ส่ง OTP — รู้ว่าใครสมัครไม่สำเร็จ และเพราะอะไร
--
-- เจ้าของถาม 14 ก.ย. 2026: "ถ้าเบอร์อื่นสมัครแล้วติดอีกจะทำไง แล้วจะรู้หรอว่าใครสมัคร"
-- คำตอบตรง ๆ คือ ตอนนี้ไม่รู้เลยทั้งสองอย่าง
--
-- ★ ผู้ให้บริการตอบว่า "สำเร็จ" ทั้งที่ไม่ได้ส่ง ★ เวลาเบอร์ถูกบล็อก SMS KUB ตอบ http 200
-- แล้วซ่อนไว้ในเนื้อคำตอบว่า block: 1, success: 0 — ระบบเราเห็นแค่ 200 เลยบอกลูกค้าว่า
-- "ส่งรหัสแล้ว" ลูกค้านั่งรอรหัสที่ไม่มีวันมา ร้านก็ไม่มีทางรู้ว่ามีคนสมัครไม่สำเร็จ
-- และเครดิตถูกหักทุกครั้ง
--
-- ตารางนี้เก็บผลทุกครั้งที่ยิง ไม่ว่าสำเร็จหรือไม่ — เจ้าของเปิดดูได้ว่าเบอร์ไหนสมัครไม่ผ่าน
-- แล้วโทรกลับไปช่วย หรือบอกให้เข้าด้วย Google ไปก่อน

begin;

create table if not exists public.sms_otp_attempts (
  id         bigint generated always as identity primary key,
  /* เบอร์ปลายทางแบบสากลไม่มีเครื่องหมายบวก (66xxxxxxxxx) — รูปแบบเดียวกับทั้งระบบ */
  phone      text not null,
  ok         boolean not null,
  /* เหตุผลแบบสั้นที่อ่านแล้วรู้เรื่อง เช่น 'blocked', 'provider_error', 'sent' */
  reason     text not null,
  /* คำตอบดิบจากผู้ให้บริการ เผื่อต้องส่งให้เขาดูตอนสอบถาม — ตัดให้สั้น ไม่เก็บทั้งก้อน */
  detail     text,
  created_at timestamptz not null default now()
);
create index if not exists sms_otp_attempts_recent_ix
  on public.sms_otp_attempts (created_at desc);
create index if not exists sms_otp_attempts_phone_ix
  on public.sms_otp_attempts (phone, created_at desc);

alter table public.sms_otp_attempts enable row level security;
/* ★ ลูกค้าห้ามเห็น ★ นี่คือรายการเบอร์ของคนที่พยายามสมัคร เปิดให้อ่านเท่ากับแจกรายชื่อ
   ผู้ใช้ทั้งหมด · แอดมินเท่านั้น และเขียนได้เฉพาะฝั่งเซิร์ฟเวอร์ (ฮุคส่ง SMS) */
create policy sms_otp_attempts_admin on public.sms_otp_attempts for select
  using (public.app_role() = 'admin');
grant select on public.sms_otp_attempts to authenticated;
grant select, insert, delete on public.sms_otp_attempts to service_role;

/**
 * เบอร์ที่ส่ง OTP ไม่สำเร็จในช่วงหลัง — สำหรับหน้าหลังร้าน
 *
 * รวมเป็นรายเบอร์ ไม่ใช่รายครั้ง เพราะคนเดิมกดส่งซ้ำสามรอบไม่ได้แปลว่ามีสามคนมีปัญหา
 * แต่แปลว่าคนเดียวพยายามสามรอบ — ซึ่งยิ่งบอกว่าเขาอยากเข้าจริง ๆ
 */
create or replace function public.failed_otp_phones(p_days int default 7)
returns table (phone text, tries int, reason text, last_try timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.phone,
         count(*)::int,
         (array_agg(a.reason order by a.created_at desc))[1],
         max(a.created_at)
    from public.sms_otp_attempts a
   where a.ok = false
     and a.created_at > now() - make_interval(days => greatest(p_days, 1))
     /* เบอร์ที่ภายหลังส่งสำเร็จแล้ว ไม่ต้องขึ้นค้างให้ตามอีก */
     /* ★ เทียบด้วยลำดับแถวควบคู่กับเวลา ★ สองครั้งที่เกิดในวินาทีเดียวกันมีเวลาเท่ากันได้
        (กดส่งซ้ำรัว ๆ) ถ้าเทียบแต่เวลา ครั้งที่สำเร็จจะไม่ถูกนับว่า "หลังจาก" ครั้งที่ล้มเหลว
        แล้วเบอร์ที่แก้ได้แล้วจะค้างอยู่ในรายการให้ตามไปเรื่อย ๆ */
     and not exists (
       select 1 from public.sms_otp_attempts s
        where s.phone = a.phone and s.ok = true
          and (s.created_at, s.id) > (a.created_at, a.id)
     )
   group by a.phone
   order by max(a.created_at) desc
   limit 50;
$$;

revoke execute on function public.failed_otp_phones(int) from public;
grant execute on function public.failed_otp_phones(int) to authenticated;

commit;

-- ═══ ตรวจว่าติดตั้งครบ ═══════════════════════════════════════════════════════
do $$
begin
  if to_regclass('public.sms_otp_attempts') is null then
    raise exception 'ตารางบันทึกการส่ง OTP หายไป';
  end if;
  if to_regprocedure('public.failed_otp_phones(int)') is null then
    raise exception 'failed_otp_phones หายไป';
  end if;
  raise notice '0110 พร้อม — บันทึกผลการส่ง OTP ทุกครั้ง';
end $$;
