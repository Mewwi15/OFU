/**
 * สั่งพิมพ์ใบนับสต๊อก — ห่อตัวสร้าง HTML ไว้ชั้นเดียว
 * หน้าตาของกระดาษอยู่ใน countSheetHtml.ts ซึ่งไม่พึ่งเบราว์เซอร์ จึงทดสอบได้
 */
import { buildCountSheetHtml, type CountRow, type CountSheetOptions } from './countSheetHtml';
import { printHtml } from './printOrder';

export type { CountRow, CountSheetOptions };

export function printCountSheet(rows: CountRow[], shopName: string, opt: CountSheetOptions) {
  printHtml(buildCountSheetHtml(rows, shopName, opt));
}
