/**
 * Public /delete-account page — the web-visible account-deletion path that
 * Google Play's Data Safety form requires (a URL shown on the store listing).
 * No auth, no layout chrome: plain instructions for OFU customers.
 */

const STEPS = [
  'เปิดแอป OFU แล้วเข้าสู่ระบบด้วยบัญชีที่ต้องการลบ',
  'ไปที่แท็บ "บัญชี" (มุมขวาล่าง)',
  'เลื่อนลงล่างสุด แตะ "ขอลบบัญชีถาวร" แล้วยืนยัน',
];

export function DeleteAccountInfo() {
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
      <main style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>การลบบัญชี OFU (อู้ฟู่)</h1>
        <p style={{ color: '#6A6A6A', marginBottom: 24 }}>
          วิธีขอลบบัญชีและข้อมูลส่วนตัวออกจากระบบของร้านอู้ฟู่
        </p>

        <section style={{ background: '#fff', borderRadius: 0, padding: 24, marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>ขั้นตอนการขอลบบัญชี</h2>
          <ol style={{ paddingLeft: 20, lineHeight: 2 }}>
            {STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p style={{ color: '#6A6A6A', marginTop: 8 }}>
            หากเข้าสู่ระบบไม่ได้ ติดต่อร้านโดยตรงที่หน้าร้าน หรือช่องทางติดต่อของร้านอู้ฟู่
            พร้อมแจ้งอีเมลที่ใช้สมัคร ทางร้านจะยืนยันตัวตนก่อนดำเนินการ
          </p>
        </section>

        <section style={{ background: '#fff', borderRadius: 0, padding: 24 }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>ข้อมูลที่ถูกลบและระยะเวลา</h2>
          <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
            <li>ทางร้านจะลบบัญชีภายใน 7 วันนับจากวันที่ส่งคำขอ</li>
            <li>ข้อมูลที่ลบ: บัญชีผู้ใช้ ข้อมูลส่วนตัว ที่อยู่จัดส่ง และอุปกรณ์รับการแจ้งเตือน</li>
            <li>ข้อมูลที่เก็บต่อ: ประวัติการสั่งซื้อ/ใบเสร็จ ตามระยะเวลาที่กฎหมายบัญชีและภาษีกำหนด</li>
            <li>ระหว่างรอดำเนินการ สามารถยกเลิกคำขอได้จากหน้าเดิมในแอป</li>
          </ul>
          <p style={{ color: '#6A6A6A', marginTop: 12, marginBottom: 0 }}>
            รายละเอียดการใช้ข้อมูลทั้งหมดอยู่ใน{' '}
            <a href="/privacy" style={{ color: '#B23E0A' }}>
              นโยบายความเป็นส่วนตัว
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
