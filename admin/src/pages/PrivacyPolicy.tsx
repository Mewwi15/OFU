/**
 * Public /privacy page — the privacy-policy URL both stores require (Play
 * Data Safety + App Store privacy link). No auth, no layout chrome. Content
 * mirrors what the app actually collects — keep this page in sync when the
 * app starts collecting anything new.
 */

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: 'ข้อมูลที่เราเก็บ',
    items: [
      'ข้อมูลบัญชี — อีเมล ชื่อ และรูปโปรไฟล์จากผู้ให้บริการที่ใช้เข้าสู่ระบบ (อีเมล/รหัสผ่าน, Google หรือ Apple) และเบอร์โทรหากคุณกรอกไว้',
      'ที่อยู่จัดส่ง — ที่อยู่ ตำบล/อำเภอ/จังหวัด รหัสไปรษณีย์ และตำแหน่งหมุดบนแผนที่ที่คุณเลือกเอง',
      'ข้อมูลการสั่งซื้อ — รายการสินค้า ยอดชำระ และรูปสลิปโอนเงินที่คุณแนบ',
      'ข้อมูลอุปกรณ์สำหรับแจ้งเตือน — โทเคนรับการแจ้งเตือน (push token) ของเครื่องที่ล็อกอิน',
      'ข้อความแชต — บทสนทนาระหว่างคุณกับร้านในแอป',
    ],
  },
  {
    title: 'เราใช้ข้อมูลเพื่ออะไร',
    items: [
      'รับคำสั่งซื้อ จัดเตรียมสินค้า และจัดส่งถึงคุณ',
      'ตรวจสอบการชำระเงิน (พนักงานร้านตรวจสลิปด้วยตนเอง)',
      'แจ้งสถานะออเดอร์และข่าวสารของร้านผ่านการแจ้งเตือน',
      'ตอบคำถามและช่วยเหลือผ่านแชต',
      'เราไม่ขายหรือให้เช่าข้อมูลส่วนตัวของคุณ และแอปไม่มีโฆษณา',
    ],
  },
  {
    title: 'การเปิดเผยข้อมูลต่อบุคคลที่สาม',
    items: [
      'ผู้ให้บริการขนส่งพัสดุ — เฉพาะชื่อผู้รับ เบอร์โทร และที่อยู่ เท่าที่จำเป็นต่อการนำส่ง',
      'ผู้ให้บริการระบบที่เราใช้ทำงาน — Supabase (ฐานข้อมูลและระบบบัญชี), Google Maps/Places (ค้นหาที่อยู่), Firebase/Expo (ส่งการแจ้งเตือน), Google และ Apple (เข้าสู่ระบบ) — แต่ละรายได้รับข้อมูลเท่าที่จำเป็นต่อหน้าที่ของตน',
      'หน่วยงานรัฐ เมื่อกฎหมายกำหนดให้ต้องเปิดเผย',
    ],
  },
  {
    title: 'ระยะเวลาเก็บรักษา',
    items: [
      'ข้อมูลบัญชีและที่อยู่ — เก็บจนกว่าคุณจะขอลบบัญชี',
      'ประวัติการสั่งซื้อและหลักฐานการชำระเงิน — เก็บตามระยะเวลาที่กฎหมายบัญชีและภาษีกำหนด แม้บัญชีถูกลบแล้ว',
      'โทเคนแจ้งเตือน — ลบเมื่อออกจากระบบหรือลบบัญชี',
    ],
  },
  {
    title: 'สิทธิของคุณ (PDPA)',
    items: [
      'ขอดู แก้ไข หรือลบข้อมูลส่วนตัวของคุณได้ — แก้ไขได้เองในแอป (เมนูบัญชี)',
      'ขอลบบัญชีถาวรได้จากเมนูบัญชีในแอป ร้านจะดำเนินการภายใน 7 วัน — ดูขั้นตอนที่หน้า "การลบบัญชี"',
      'ถอนความยินยอมได้โดยเลิกใช้งานและขอลบบัญชี',
    ],
  },
];

export function PrivacyPolicy() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAFAFA',
        color: '#2B2320',
        fontFamily: "'Mitr', 'Noto Sans Thai', system-ui, sans-serif",
        display: 'flex',
        justifyContent: 'center',
        padding: '48px 20px',
      }}>
      <main style={{ maxWidth: 640 }}>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>นโยบายความเป็นส่วนตัว — OFU (อู้ฟู่)</h1>
        <p style={{ color: '#6A6A6A', marginBottom: 24 }}>
          มีผลตั้งแต่ 12 กรกฎาคม 2026 · แอปสั่งซื้อสินค้าของร้านอู้ฟู่ (ร้านค้าเดียว)
          เก็บข้อมูลเท่าที่จำเป็นต่อการขายและจัดส่งสินค้าเท่านั้น
        </p>

        {SECTIONS.map((s) => (
          <section
            key={s.title}
            style={{ background: '#fff', borderRadius: 0, padding: 24, marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>{s.title}</h2>
            <ul style={{ paddingLeft: 20, lineHeight: 2, margin: 0 }}>
              {s.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </section>
        ))}

        <section style={{ background: '#fff', borderRadius: 0, padding: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>ติดต่อเรา</h2>
          <p style={{ lineHeight: 2, margin: 0 }}>
            ร้านอู้ฟู่ — ติดต่อผ่านแชตในแอป หรือที่หน้าร้าน
            <br />
            การลบบัญชี: ดูขั้นตอนได้ที่{' '}
            <a href="/delete-account" style={{ color: '#5B8C6E' }}>
              หน้าการลบบัญชี
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
