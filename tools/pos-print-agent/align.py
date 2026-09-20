"""
ตัววัดหัวพิมพ์ — พิมพ์แถบทดสอบออกมาหนึ่งใบ เพื่อดูว่าหัวพิมพ์กว้างจริงกี่จุด
และตำแหน่งที่มันยิงอยู่ตรงกลางม้วนกระดาษหรือเปล่า

★ ทำไมต้องวัด ★ (เจ้าของแจ้ง 20 ก.ย. 2569 ว่าบิลยังเบี้ยวไปทางซ้ายหลังแก้รอบแรก)
ตัวเลข 384 จุด (48 มม.) เป็นค่ามาตรฐานของเครื่อง 58 มม. ทั่วไป แต่เครื่องแต่ละรุ่น
วางหัวพิมพ์ไม่ตรงกลางม้วนเท่ากัน บางรุ่นเว้นขอบซ้าย 2 มม. ขวา 8 มม. เดาต่อไปก็เสีย
กระดาษเปล่า ๆ — พิมพ์ออกมาดูทีเดียวจบ

วิธีใช้:
    python align.py
    python align.py --printer "POS58 Printer"
"""

from __future__ import annotations

import argparse
import sys

try:
    import win32print
except ImportError:
    print('ยังไม่ได้ติดตั้ง pywin32 — พิมพ์: pip install pywin32')
    sys.exit(1)


def send_raw(printer_name: str, data: bytes) -> None:
    h = win32print.OpenPrinter(printer_name)
    try:
        win32print.StartDocPrinter(h, 1, ('OFU align', None, 'RAW'))
        win32print.StartPagePrinter(h)
        win32print.WritePrinter(h, data)
        win32print.EndPagePrinter(h)
        win32print.EndDocPrinter(h)
    finally:
        win32print.ClosePrinter(h)


def bar(ink_dots: int, head_dots: int, rows: int = 20) -> bytes:
    """แถบดำกว้าง ink_dots จุด วางกลางพื้นที่ head_dots จุด"""
    width_bytes = head_dots // 8
    left = (head_dots - ink_dots) // 2
    row = bytearray(width_bytes)
    for x in range(left, left + ink_dots):
        row[x // 8] |= 0x80 >> (x % 8)
    return (
        b'\x1dv0\x00'
        + bytes([width_bytes & 0xFF, (width_bytes >> 8) & 0xFF])
        + bytes([rows & 0xFF, (rows >> 8) & 0xFF])
        + bytes(row) * rows
    )


def main() -> int:
    ap = argparse.ArgumentParser(description='พิมพ์แถบทดสอบวัดหัวพิมพ์')
    ap.add_argument('--printer')
    ap.add_argument('--head', type=int, default=384, help='ความกว้างหัวพิมพ์ที่จะลอง (จุด)')
    args = ap.parse_args()

    flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    names = [p[2] for p in win32print.EnumPrinters(flags, None, 1)]
    target = args.printer
    if not target:
        skip = ('480', '233', 'BROTHER', 'PDF', 'XPS', 'FAX', 'ONENOTE')
        ok = [n for n in names if not any(s in n.upper() for s in skip)]
        target = next((n for n in ok if 'POS' in n.upper()), None) or next(
            (n for n in ok if '58' in n), None
        )
    if not target or target not in names:
        print('หาเครื่องพิมพ์บิลไม่เจอ — เครื่องที่มี:')
        for n in names:
            print('   -', n)
        return 1

    H = args.head
    out = bytearray(b'\x1b@')
    # ★ แถบที่ 1: เต็มหัวพิมพ์ ★ ขอบซ้าย/ขวาของแถบนี้คือขอบจริงของพื้นที่ที่พิมพ์ได้
    out += bar(H, H)
    out += b'\x1bJ\x18'
    # ★ แถบที่ 2: ครึ่งหนึ่ง วางกลาง ★ ถ้าหัวพิมพ์กว้างเท่าที่เดา แถบนี้ต้องอยู่กลางแถบแรกพอดี
    out += bar(H // 2, H)
    out += b'\x1bJ\x18'
    # ★ แถบที่ 3: เส้นบาง ๆ ตรงกลางเป๊ะ ★ ไว้พับกระดาษทาบดูว่าตรงกลางม้วนจริงไหม
    out += bar(8, H, rows=40)
    out += b'\x1b2\x1bJ\x78\n\n'

    send_raw(target, bytes(out))
    print(f'พิมพ์แถบทดสอบไปที่ {target} แล้ว (ลองที่ความกว้าง {H} จุด = {H/8:.0f} มม.)')
    print()
    print('ดูที่กระดาษแล้วตอบกลับมา:')
    print('  1. แถบดำหนาอันบน ชิดขอบกระดาษด้านไหนบ้าง หรือเหลือขาวข้างไหนมากกว่ากัน')
    print('  2. แถบที่สอง (สั้นกว่า) อยู่กึ่งกลางแถบแรกไหม')
    print('  3. เส้นบาง ๆ อันล่าง อยู่กึ่งกลางม้วนกระดาษพอดีไหม (พับกระดาษครึ่งแล้วทาบดู)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
