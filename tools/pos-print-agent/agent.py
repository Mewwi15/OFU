"""
ตัวกลางพิมพ์บิล — รันค้างไว้ที่เครื่องขาย คอยรับบิลจากหน้าเว็บแล้วส่งเข้าเครื่องพิมพ์บิล

เจ้าของเสนอเอง 15 ก.ย. 2026: "ผมว่าเราต้องเขียนให้คอมมันอ่านที่ port ของ computer เรา"

    หน้าขาย (เว็บ) ──POST รูปบิล──> ตัวนี้ (127.0.0.1) ──RAW──> POS58

★ ทำไมต้องมีตัวกลาง ★ เบราว์เซอร์ห้ามเว็บสั่งพิมพ์ตรงไปที่เครื่องพิมพ์ (ไม่งั้นเว็บไหนก็
พ่นกระดาษใส่เราได้) ทางที่ Chrome มีให้คือ kiosk-printing ซึ่งบังคับพิมพ์ไปที่ "เครื่องพิมพ์
หลัก" ของทั้งเบราว์เซอร์ — แปลว่าต้องตั้ง POS58 เป็นเครื่องพิมพ์หลัก แล้วใบ A4 ที่สั่งพิมพ์
จากหน้าต่างเดียวกันจะไหลลงม้วนกระดาษ 48 มม. ไปด้วย (เจ้าของถามข้อนี้เอง)
ตัวกลางนี้แก้ที่ต้นเหตุ: เราระบุชื่อเครื่องพิมพ์ตรง ๆ จึงไม่ต้องยุ่งกับเครื่องพิมพ์หลักเลย
ตั้ง Brother ไว้เป็นเครื่องพิมพ์หลักเหมือนเดิมได้ เอกสาร A4 พิมพ์ปกติทุกอย่าง

★ ทำไมส่งเป็นรูป ไม่ใช่ตัวหนังสือ ★ เครื่องพิมพ์บิลราคาถูกเก็บฟอนต์ไทยไม่ครบและใช้
รหัสอักขระคนละมาตรฐานกัน ส่งตัวหนังสือไทยตรง ๆ คือการเสี่ยงได้กระดาษเต็มไปด้วยตัวขยะ
ส่งเป็นรูปที่หน้าเว็บวาดมาแล้ว = ได้หน้าตาเหมือนบนจอเป๊ะทุกตัวอักษร รวมโลโก้กับบาร์โค้ด

วิธีใช้:
    pip install pywin32 pillow
    python agent.py                        (เดาชื่อเครื่องพิมพ์ให้เอง)
    python agent.py --printer "POS58 Printer" --port 9110

ตรวจว่ารันอยู่: เปิดเบราว์เซอร์ไปที่ http://127.0.0.1:9110/ping
"""

from __future__ import annotations

import argparse
import io
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    import win32print
except ImportError:
    print('ยังไม่ได้ติดตั้ง pywin32 — พิมพ์: pip install pywin32')
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print('ยังไม่ได้ติดตั้ง pillow — พิมพ์: pip install pillow')
    sys.exit(1)

# กว้างของหัวพิมพ์เป็นจำนวนจุด — เครื่อง 58 มม. พิมพ์ได้จริง 48 มม. = 384 จุด
DOTS_58MM = 384

# ─────────────────────────────────────────────────────────────────────────────
# ฝั่งเครื่องพิมพ์
# ─────────────────────────────────────────────────────────────────────────────


def all_printers() -> list[str]:
    flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    return [p[2] for p in win32print.EnumPrinters(flags, None, 1)]


def guess_printer(names: list[str]) -> str | None:
    """
    เดาว่าเครื่องไหนคือเครื่องพิมพ์บิล

    ★ เรียงลำดับความมั่นใจ ไม่ใช่เจออะไรก่อนเอาอันนั้น ★ ตอนทดสอบที่เครื่องจริง
    (15 ก.ย. 2026) เครื่องนั้นมีเครื่องพิมพ์ 17 ตัว การไล่หาคำว่า "58" เฉย ๆ ไปเจอ
    'XP-58C' ก่อน ทั้งที่ตัวที่เจ้าของจะใช้คือ 'POS58 Printer'
    และต้องข้ามเครื่องพิมพ์สติกเกอร์ (XP-480B / XP-233B) ให้ขาด — บิลไปโผล่ที่นั่น
    คือเสียสติกเกอร์ทั้งม้วนโดยไม่มีใครรู้
    """
    upper = [(n, n.upper()) for n in names]
    skip = ('480', '233', 'BROTHER', 'PDF', 'XPS', 'FAX', 'ONENOTE')
    ok = [n for n, u in upper if not any(s in u for s in skip)]
    for want in ('POS58', 'POS-58', 'POS'):
        for n in ok:
            if want in n.upper():
                return n
    for n in ok:
        if '58' in n:
            return n
    return None


def send_raw(printer_name: str, data: bytes) -> None:
    """ส่งไบต์ดิบเข้าคิวพิมพ์ — RAW = Windows ไม่แปลงอะไรเลย ส่งออกสายตรง ๆ"""
    handle = win32print.OpenPrinter(printer_name)
    try:
        win32print.StartDocPrinter(handle, 1, ('OFU receipt', None, 'RAW'))
        win32print.StartPagePrinter(handle)
        win32print.WritePrinter(handle, data)
        win32print.EndPagePrinter(handle)
        win32print.EndDocPrinter(handle)
    finally:
        win32print.ClosePrinter(handle)


def image_to_escpos(png_bytes: bytes, width_dots: int = DOTS_58MM, cut: bool = False) -> bytes:
    """
    แปลงรูปบิลเป็นคำสั่งพิมพ์ภาพของ ESC/POS

    ★ ต้องซอยเป็นแถบ ★ เครื่องพิมพ์ถูก ๆ หน่วยความจำน้อย ส่งภาพยาว ๆ ทีเดียวมักค้างหรือ
    พิมพ์ออกมาครึ่งใบ — ซอยทีละ 128 แถวแล้วส่งต่อกันเป็นพืด ได้ผลเหมือนกันแต่ไม่ล้ม
    """
    img = Image.open(io.BytesIO(png_bytes))

    # รูปโปร่งใสต้องวางบนพื้นขาวก่อน ไม่งั้นพื้นหลังจะกลายเป็นดำทั้งใบ
    if img.mode in ('RGBA', 'LA', 'P'):
        img = img.convert('RGBA')
        bg = Image.new('RGB', img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        img = bg

    img = img.convert('L')
    if img.width != width_dots:
        h = max(1, round(img.height * width_dots / img.width))
        img = img.resize((width_dots, h), Image.LANCZOS)

    # ขาวดำล้วน — เครื่องพิมพ์ความร้อนมีแค่ "จุด" กับ "ไม่จุด" ไม่มีสีเทา
    img = img.point(lambda p: 0 if p < 160 else 255, mode='1')

    width_bytes = (img.width + 7) // 8
    pixels = img.load()
    out = bytearray(b'\x1b@')  # ล้างค่าเครื่องพิมพ์

    CHUNK = 128
    for top in range(0, img.height, CHUNK):
        rows = min(CHUNK, img.height - top)
        band = bytearray()
        for y in range(top, top + rows):
            for xb in range(width_bytes):
                byte = 0
                for bit in range(8):
                    x = xb * 8 + bit
                    # 0 = ดำในโหมด '1' ของ PIL · บิต 1 = ให้เครื่องพิมพ์ยิงจุด
                    if x < img.width and pixels[x, y] == 0:
                        byte |= 0x80 >> bit
                band.append(byte)
        # GS v 0 — พิมพ์ภาพแบบ raster
        out += b'\x1dv0\x00'
        out += bytes([width_bytes & 0xFF, (width_bytes >> 8) & 0xFF])
        out += bytes([rows & 0xFF, (rows >> 8) & 0xFF])
        out += band

    out += b'\n\n\n\n'  # เลื่อนกระดาษให้พ้นหัวพิมพ์ จะได้ฉีกได้
    if cut:
        out += b'\x1dV\x42\x00'  # ตัดกระดาษ (เครื่องที่ไม่มีใบมีดจะไม่สนใจคำสั่งนี้)
    return bytes(out)


# ─────────────────────────────────────────────────────────────────────────────
# ฝั่งเว็บ
# ─────────────────────────────────────────────────────────────────────────────


class Handler(BaseHTTPRequestHandler):
    printer_name = ''
    paper_dots = DOTS_58MM
    do_cut = False

    # ปิดบันทึกอัตโนมัติของไลบรารี แล้วพิมพ์เองให้อ่านง่ายกว่า
    def log_message(self, fmt, *args):  # noqa: A003
        pass

    def _cors(self) -> None:
        """
        ★ Chrome ต้องได้รับอนุญาตสองชั้น ★ ชั้นแรกคือ CORS ปกติ ชั้นที่สองคือกฎใหม่เรื่อง
        "เว็บสาธารณะขอคุยกับเครื่องในบ้าน" (Private Network Access) ซึ่งจะถามก่อนทุกครั้ง
        ถ้าไม่ตอบหัวข้อนี้กลับไป Chrome จะบล็อกเงียบ ๆ โดยหน้าเว็บไม่มีทางรู้สาเหตุเลย
        """
        origin = self.headers.get('Origin', '*')
        self.send_header('Access-Control-Allow-Origin', origin)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'content-type')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Access-Control-Max-Age', '86400')

    def _json(self, code: int, body: dict) -> None:
        raw = json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if self.path.startswith('/ping'):
            self._json(200, {
                'ok': True,
                'agent': 'ofu-pos-print',
                'printer': self.printer_name,
                'printers': all_printers(),
            })
            return
        self._json(404, {'ok': False, 'error': 'not found'})

    def do_POST(self) -> None:  # noqa: N802
        if not self.path.startswith('/print'):
            self._json(404, {'ok': False, 'error': 'not found'})
            return

        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0:
            self._json(400, {'ok': False, 'error': 'ไม่มีข้อมูลบิลส่งมา'})
            return
        body = self.rfile.read(length)

        try:
            data = image_to_escpos(body, self.paper_dots, self.do_cut)
        except Exception as e:  # noqa: BLE001
            self._json(400, {'ok': False, 'error': f'อ่านรูปบิลไม่ได้: {e}'})
            return

        try:
            send_raw(self.printer_name, data)
        except Exception as e:  # noqa: BLE001
            print('  พิมพ์ไม่สำเร็จ:', e)
            self._json(500, {'ok': False, 'error': str(e)})
            return

        print(f'  พิมพ์แล้ว ({len(body)} ไบต์ → {len(data)} ไบต์คำสั่ง)')
        self._json(200, {'ok': True})


def main() -> int:
    ap = argparse.ArgumentParser(description='ตัวกลางพิมพ์บิลของร้านอู้ฟู่')
    ap.add_argument('--printer', help='ชื่อเครื่องพิมพ์บิล (ต้องตรงเป๊ะกับใน Windows)')
    ap.add_argument('--port', type=int, default=9110)
    ap.add_argument('--dots', type=int, default=DOTS_58MM, help='ความกว้างหัวพิมพ์เป็นจุด')
    ap.add_argument('--cut', action='store_true', help='สั่งตัดกระดาษท้ายบิล')
    args = ap.parse_args()

    names = all_printers()
    target = args.printer or guess_printer(names)
    if not target:
        print('หาเครื่องพิมพ์บิลไม่เจอ — เครื่องพิมพ์ที่มีคือ:')
        for n in names:
            print('   -', n)
        print('\nสั่งใหม่โดยระบุชื่อ เช่น:  python agent.py --printer "POS58 Printer"')
        return 1
    if target not in names:
        print(f'ไม่มีเครื่องพิมพ์ชื่อ "{target}" — ที่มีคือ:')
        for n in names:
            print('   -', n)
        return 1

    Handler.printer_name = target
    Handler.paper_dots = args.dots
    Handler.do_cut = args.cut

    print('─────────────────────────────────────────────')
    print(' ตัวกลางพิมพ์บิล ร้านอู้ฟู่')
    print(f' เครื่องพิมพ์: {target}')
    print(f' ฟังอยู่ที่ : http://127.0.0.1:{args.port}')
    print('─────────────────────────────────────────────')
    print(' ปล่อยหน้าต่างนี้เปิดไว้ ปิดแล้วบิลจะไม่พิมพ์เอง')
    print(' กด Ctrl+C เพื่อหยุด')
    print()

    # ผูกกับ 127.0.0.1 เท่านั้น — เครื่องอื่นในวงแลนสั่งพิมพ์ไม่ได้
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nหยุดแล้ว')
    return 0


if __name__ == '__main__':
    sys.exit(main())
