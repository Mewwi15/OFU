/**
 * รู้ตัวเองว่ามีเวอร์ชันใหม่ขึ้นแล้ว
 *
 * เจ้าของแจ้ง 14 ก.ย. 2026: "ตอนโหลดใหม่ ๆ เครื่องคนอื่นมันไปจำเวอร์ชันเดิม ต้องรีโหลด
 * หลายรอบถึงจะเป็นเวอร์ชันใหม่"
 *
 * ★ ปัญหาจริงคือ "ไม่มีใครบอกว่ามีของใหม่" ★ หน้าเว็บที่เปิดค้างไว้ทั้งวัน (เครื่องขายหน้า
 * ร้านเปิดทิ้งไว้ตั้งแต่เช้า) ไม่มีทางรู้เลยว่าเรา deploy ไปแล้ว มันจะรันโค้ดรุ่นที่โหลดมา
 * ตอนเปิดไปจนกว่าจะมีคนกดรีเฟรชเอง — และเวลาคนกดรีเฟรช ก็ไม่รู้ว่าต้องกดกี่ครั้ง
 *
 * วิธีตรวจ: ขอ index.html สด ๆ (ไม่เอาของในแคช) แล้วดูว่าไฟล์สคริปต์หลักยังชื่อเดิมไหม
 * ชื่อไฟล์มีรหัสแฮชอยู่ในตัว เปลี่ยนเมื่อไหร่แปลว่าโค้ดเปลี่ยน — ไม่ต้องมีไฟล์เวอร์ชัน
 * แยกต่างหากให้ลืมอัปเดต
 *
 * ★ บอกอย่างเดียว ไม่รีเฟรชให้เอง ★ เครื่องนี้อาจกำลังคีย์บิลหรือนับเงินอยู่ การรีเฟรช
 * ให้เองกลางคันคือสิ่งที่แย่กว่าการใช้รุ่นเก่าอีกชั่วโมง — ให้คนกดเองตอนที่เขาพร้อม
 */

const CHECK_EVERY_MS = 5 * 60 * 1000;

/** ชื่อไฟล์สคริปต์หลักที่หน้านี้กำลังรันอยู่ */
function currentBuild(): string | null {
  const el = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]');
  return el?.getAttribute('src') ?? null;
}

async function liveBuild(): Promise<string | null> {
  try {
    const res = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const html = await res.text();
    return html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1] ?? null;
  } catch {
    /* เน็ตสะดุด — ไม่ใช่เรื่องที่ต้องรบกวนคนขายของ ไว้รอบหน้า */
    return null;
  }
}

/**
 * เริ่มเฝ้าดู · เรียก onNew ครั้งเดียวเมื่อพบว่ามีรุ่นใหม่
 * คืนฟังก์ชันสำหรับเลิกเฝ้า
 */
export function watchForNewVersion(onNew: () => void): () => void {
  const mine = currentBuild();
  if (!mine) return () => {};

  let stopped = false;
  let timer: number | undefined;

  const check = async () => {
    if (stopped) return;
    const live = await liveBuild();
    if (live && live !== mine) {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
      onNew();
    }
  };

  timer = window.setInterval(check, CHECK_EVERY_MS);
  /* เช็คตอนกลับมาที่แท็บด้วย — คนสลับไปทำอย่างอื่นแล้วกลับมา เป็นจังหวะที่เขาว่างพอจะ
     รีเฟรช มากกว่าตอนกำลังกดอะไรอยู่ */
  window.addEventListener('focus', check);
  return () => {
    stopped = true;
    window.clearInterval(timer);
    window.removeEventListener('focus', check);
  };
}
