/**
 * ใบนับสต๊อก — ตัวสร้าง HTML ของกระดาษ A4 ที่ถือเดินนับของบนชั้นด้วยมือ
 *
 * ★ ไฟล์นี้ไม่พึ่งเบราว์เซอร์เลย ★ จะได้สั่ง Chrome พิมพ์เป็น PDF แล้ววัดว่ากี่แผ่น
 * ตัวหนังสือล้นไหม ตั้งแต่ก่อนเสียกระดาษจริง
 *
 * ★ คนละงานกับใบสั่งซื้อ ★ (เจ้าของสั่ง 2 ต.ค. 2569 "รายละเอียดไม่ต้องใหญ่เหมือน
 * ใบออเดอร์") ใบสั่งซื้อมีรูปสินค้า 62 จุดและตัวเลขขนาด 30 เพราะเดินถือตะกร้าอยู่ใน
 * ร้านส่ง ต้องอ่านจากระยะแขนและมีไม่กี่สิบรายการ · ใบนี้ตรงข้าม — ของทั้งร้าน 1,030
 * รายการ คนนับยืนอยู่หน้าชั้นที่มีของอยู่ตรงหน้าแล้ว ไม่ต้องให้รูปช่วยจำ สิ่งที่ต้องการ
 * คือ "หน้าเดียวเห็นได้เยอะที่สุด" กับ "ช่องเขียนตัวเลขที่เขียนสบาย"
 *
 * ★ สองคอลัมน์ต่อหน้า ★ ถ้าเรียงแถวเดียวยาวลงมา ของทั้งร้านกินกระดาษราว 30 แผ่น
 * แบ่งครึ่งหน้าได้ 60 กว่าบรรทัดต่อแผ่น เหลือราว 16 แผ่น และความกว้างครึ่งหน้ายัง
 * พอให้ชื่อสินค้าของร้านชำอยู่ในบรรทัดเดียวได้เกือบทั้งหมด
 *
 * ★ แยกตามหมวด ขึ้นหน้าใหม่ทุกหมวด ★ คนนับเดินทีละชั้น ไม่ได้เดินตามตัวอักษร
 * การขึ้นหน้าใหม่ทำให้ฉีกแจกกันนับคนละหมวดได้ และนับไม่ครบหมวดไหนก็เห็นทันที
 */

/* ★ แยกตัวสร้าง HTML ออกจากตัวสั่งพิมพ์ ★ ตัวสั่งพิมพ์ต้องมีเบราว์เซอร์ แต่หน้าตา
   ของกระดาษตรวจได้โดยไม่ต้องเปิดจอ — แยกไว้แบบนี้จึงเอาไปสั่ง Chrome พิมพ์เป็น PDF
   แล้ววัดว่ากี่แผ่น ตัวหนังสือล้นไหม ก่อนจะเสียกระดาษจริง */
const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', 'Noto Sans Thai', 'Leelawadee UI', system-ui, sans-serif; color: #000; }
`;

export type CountRow = {
  name: string;
  size: string | null;
  barcode: string | null;
  category: string;
  unit: string | null;
  stock: number;
  /** รูปสินค้า — เจ้าของสั่งเพิ่ม 2 ต.ค. 2569 "เอารูปด้วยนะครับ" */
  image: string | undefined;
  price: number;
  cost: number | null;
  threshold: number;
};

export type CountSheetOptions = {
  /**
   * ซ่อนยอดในระบบ = นับแบบไม่เห็นตัวเลข
   *
   * ★ ทำไมต้องมีตัวเลือกนี้ ★ ถ้าเห็นเลขในระบบอยู่ข้าง ๆ คนนับจะเผลอ "นับให้ตรงเลขนั้น"
   * โดยไม่รู้ตัว ของที่หายไปจริงจึงไม่ถูกจับได้ — เป็นปัญหาที่รู้กันในงานตรวจนับสต๊อก
   * แต่การไม่เห็นเลขเลยก็แลกมาด้วยการต้องกลับมานั่งเทียบทีหลังทุกบรรทัด
   * ร้านเล็กที่เจ้าของนับเองมักเลือกแบบเห็นเลข เลยตั้งค่าเริ่มต้นไว้แบบนั้น
   * แต่ถ้าให้คนอื่นช่วยนับ หรือสงสัยว่าของหาย ควรเปิดโหมดนี้
   */
  blind: boolean;
  /** ใส่บาร์โค้ดใต้ชื่อ — ไว้ยืนยันตอนเจอของชื่อคล้ายกันวางติดกัน */
  showBarcode: boolean;
  /** รูปสินค้าหน้าแถว — หาของบนชั้นได้เร็วกว่าอ่านชื่อ โดยเฉพาะของที่ชื่อคล้ายกัน */
  showImage: boolean;
  /** ต้นทุนต่อหน่วย — ใบที่มีต้นทุนไม่ควรวางทิ้งไว้ให้ใครก็อ่านได้ จึงปิดไว้ก่อน */
  showCost: boolean;
};

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function buildCountSheetHtml(rows: CountRow[], shopName: string, opt: CountSheetOptions): string {
  const when = new Date().toLocaleString('th-TH', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  /* จัดกลุ่มตามหมวด แล้วเรียงชื่อในหมวด — เดินนับทีละชั้นได้ตรงลำดับ */
  const byCat = new Map<string, CountRow[]>();
  for (const r of rows) {
    const list = byCat.get(r.category);
    if (list) list.push(r);
    else byCat.set(r.category, [r]);
  }
  const cats = [...byCat.entries()].sort((a, b) => a[0].localeCompare(b[0], 'th'));
  for (const [, list] of cats) list.sort((a, b) => a.name.localeCompare(b.name, 'th'));

  /* บรรทัดรายละเอียดใต้ชื่อ — บาร์โค้ด ราคา ต้นทุน เกณฑ์เตือน เท่าที่เปิดไว้
     ★ ยัดในบรรทัดเดียว ★ แยกเป็นคอลัมน์ละอย่างจะกินความกว้างจนชื่อสินค้าตกบรรทัด
     ซึ่งทำให้กระดาษยาวขึ้นโดยไม่ได้อะไรกลับมา */
  const detail = (r: CountRow) => {
    const bits: string[] = [];
    if (opt.showBarcode && r.barcode) bits.push(esc(r.barcode));
    bits.push(baht(r.price));
    if (opt.showCost && r.cost != null) bits.push(`ทุน ${baht(r.cost)}`);
    /* ★ ไม่พิมพ์เกณฑ์เตือน ★ (เจ้าของสั่ง 2 ต.ค. 2569 "เอาเตือนออก") เป็นเลขสำหรับ
       ตัดสินใจสั่งของ ไม่ได้ใช้ตอนนับ มีแต่ทำให้บรรทัดรกขึ้นเปล่า ๆ */
    return bits.length ? `<div class="bc">${bits.join(' · ')}</div>` : '';
  };

  const line = (r: CountRow, n: number) => `<tr>
    <td class="no">${n}</td>
    ${opt.showImage
      ? `<td class="img">${r.image ? `<img src="${esc(r.image)}" alt="">` : ''}</td>`
      : ''}
    <td class="nm">${esc(r.name)}${r.size ? ` <span class="sz">(${esc(r.size)})</span>` : ''}${detail(r)}</td>
    ${opt.blind ? '' : `<td class="sys">${r.stock}<span class="u">${esc(r.unit ?? '')}</span></td>`}
    <td class="box"></td>
  </tr>`;

  const headCells = `<th class="no">#</th>${opt.showImage ? '<th class="img"></th>' : ''}<th class="nm">สินค้า</th>${
    opt.blind ? '' : '<th class="sys">ระบบ</th>'
  }<th class="box">นับได้</th>`;

  /* ★ ตัดเป็นหน้า ๆ เอง ไม่ปล่อยให้ไหลเอง ★ (ตรวจจากกระดาษจริงที่พิมพ์ออกมา 2 ต.ค. 2569)
     ของเดิมตัดรายการครึ่งหนึ่งไปซ้าย ครึ่งหนึ่งไปขวา แล้วปล่อยให้แต่ละคอลัมน์ไหลข้ามหน้า
     ผลคือหน้าแรกมีซ้าย 1–30 แต่ขวาขึ้นต้นที่ 103 — คนนับต้องไล่ซ้ายจนจบทุกหน้าก่อน
     แล้ววนกลับมาเริ่มขวาใหม่ตั้งแต่หน้าแรก ซึ่งไม่มีใครทำแบบนั้น
     ตัดเป็นก้อนละหนึ่งหน้าก่อน แล้วค่อยผ่าก้อนนั้นเป็นซ้าย-ขวา เลขจึงไล่ต่อเนื่อง
     ลงซ้ายแล้วขึ้นขวาในหน้าเดียวกัน จบหน้าค่อยพลิก

     ★ จำนวนต่อหน้าได้จากการวัดกระดาษจริง ★ ไม่ได้เดา — เรนเดอร์ของทั้งร้าน 1,043 รายการ
     ออกเป็น PDF แล้วนับว่าหนึ่งคอลัมน์รับได้กี่บรรทัดก่อนขึ้นหน้าใหม่ · มีบาร์โค้ดใต้ชื่อ
     แถวจะสูงขึ้น จึงรับได้น้อยกว่า · เผื่อไว้เล็กน้อยกันชื่อสินค้ายาวที่ตกไปสองบรรทัด */
  const perCol = opt.showImage ? 27 : opt.showBarcode ? 28 : 40;
  const perPage = perCol * 2;

  const table = (items: CountRow[], offset: number) =>
    items.length
      ? `<table><thead><tr>${headCells}</tr></thead><tbody>${items
          .map((r, i) => line(r, offset + i + 1))
          .join('')}</tbody></table>`
      : '';

  const section = ([cat, list]: [string, CountRow[]]) => {
    const pages: string[] = [];
    for (let start = 0; start < list.length; start += perPage) {
      const chunk = list.slice(start, start + perPage);
      const half = Math.ceil(chunk.length / 2);
      const pageNo = pages.length + 1;
      const total = Math.ceil(list.length / perPage);
      pages.push(`<section class="cat">
        <div class="cathead">
          <span class="catname">${esc(cat)}</span>
          <span class="catcount">${list.length} รายการ${
            total > 1 ? ` · แผ่น ${pageNo}/${total}` : ''
          }</span>
          <span class="catsign">ผู้นับ ______________ เวลา ________</span>
        </div>
        <div class="cols">
          <div class="col">${table(chunk.slice(0, half), start)}</div>
          <div class="col">${table(chunk.slice(half), start + half)}</div>
        </div>
      </section>`);
    }
    return pages.join('');
  };

  return `<!doctype html><html lang="th"><head><meta charset="utf-8">
  <title>ใบนับสต๊อก ${esc(shopName)}</title>
  <style>
    ${BASE_CSS}
    @page { size: A4 portrait; margin: 10mm 9mm; }
    body { font-size: 10.5px; }

    .head { display: flex; justify-content: space-between; align-items: flex-end;
            border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 8px; }
    .shop { font-size: 13px; font-weight: 700; }
    .doc { font-size: 20px; font-weight: 800; line-height: 1.1; }
    .when { text-align: right; font-size: 10px; line-height: 1.6; color: #333; }
    .note { font-size: 10px; color: #444; margin-bottom: 8px; }
    .note b { color: #000; }

    /* ขึ้นหน้าใหม่ทุกหมวด — ฉีกแจกกันนับคนละหมวดได้ */
    section.cat { break-before: page; }
    section.cat:first-of-type { break-before: auto; }
    .cathead { display: flex; align-items: baseline; gap: 10px;
               border-bottom: 1.5px solid #000; padding-bottom: 3px; margin-bottom: 5px; }
    .catname { font-size: 14px; font-weight: 800; }
    .catcount { font-size: 10px; color: #555; }
    .catsign { margin-left: auto; font-size: 10px; color: #333; }

    .cols { display: flex; gap: 7mm; align-items: flex-start; }
    .col { flex: 1 1 0; min-width: 0; }

    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 0.6px solid #666; padding: 2.5px 4px; }
    th { background: #efefef; font-size: 9.5px; font-weight: 700; text-align: center; }
    td.no  { width: 20px; text-align: right; color: #666; font-size: 9px; }
    th.no  { width: 20px; }
    /* รูปเล็กแต่พอให้จำของได้ — ใหญ่กว่านี้กินบรรทัดจนกระดาษยาวขึ้นเท่าตัว */
    td.img { width: 30px; padding: 1.5px; text-align: center; }
    th.img { width: 30px; }
    td.img img { width: 26px; height: 26px; object-fit: cover; display: block; margin: 0 auto;
                 border: 0.5px solid #ccc; }
    td.nm  { font-size: 11px; line-height: 1.25; word-break: break-word; }
    td.nm .sz { font-size: 9.5px; color: #444; }
    td.nm .bc { font-size: 8.5px; color: #777; }
    th.nm, td.nm { text-align: left; }
    /* ยอดในระบบ — จงใจให้จางและเล็ก ไม่ให้แย่งสายตาไปจากช่องที่ต้องเขียน */
    td.sys { width: 36px; text-align: center; font-size: 10px; color: #777; }
    th.sys { width: 36px; }
    td.sys .u { font-size: 7.5px; color: #999; display: block; line-height: 1; }
    /* ช่องเขียน — ต้องสูงพอให้เขียนเลขด้วยปากกาได้สบาย คือของจริงที่ใบนี้มีไว้ทำ */
    td.box { width: 42px; height: 20px; background: #fff; }
    th.box { width: 42px; }

    tr { break-inside: avoid; }
    thead { display: table-header-group; }
  </style></head><body>
    <div class="head">
      <div>
        <div class="shop">${esc(shopName)}</div>
        <div class="doc">ใบนับสต๊อก</div>
      </div>
      <div class="when">
        พิมพ์ ${esc(when)}<br>
        ${rows.length.toLocaleString('th-TH')} รายการ · ${cats.length} หมวด
      </div>
    </div>

    <div class="note">
      เขียนจำนวนที่นับได้จริงลงช่อง <b>นับได้</b> ทุกบรรทัด
      ${opt.blind
        ? '· <b>ใบนี้ไม่แสดงยอดในระบบ</b> เพื่อไม่ให้เผลอนับตามตัวเลขเดิม'
        : '· ช่อง <b>ระบบ</b> คือยอดที่ระบบคิดว่ามี ถ้านับได้ไม่ตรงให้เขียนเลขที่นับได้ลงไปตามจริง'}
      · นับไม่เจอของเลยให้เขียน <b>0</b> อย่าเว้นว่าง เพราะช่องว่างแปลว่ายังไม่ได้นับ
    </div>

    ${cats.map(section).join('')}
  </body></html>`;
}

