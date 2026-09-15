"""
ทดสอบว่า "ส่งข้อมูลดิบเข้าเครื่องพิมพ์บิลผ่านคิวของ Windows" ใช้ได้จริงไหม

★ ทำไมต้องมีไฟล์นี้ ★ ก่อนจะเขียนตัวกลางทั้งตัว ต้องพิสูจน์ข้อเดียวให้ได้ก่อน คือ
ไดรเวอร์ของ POS58 ยอมรับข้อมูลดิบ (RAW) แล้วส่งต่อให้เครื่องพิมพ์ไหม — ถ้าข้อนี้ไม่ผ่าน
ทางนี้ตายตั้งแต่ต้น ไม่ต้องเสียเวลาเขียนอะไรต่อ ถ้าผ่าน ที่เหลือเป็นแค่ท่อส่งของ

วิธีใช้ (เปิด cmd แล้วพิมพ์):
    python test_print.py

ถ้าอยากระบุชื่อเครื่องพิมพ์เอง:
    python test_print.py "POS58 Printer"
"""

import sys

try:
    import win32print
except ImportError:
    print('ยังไม่ได้ติดตั้ง pywin32 — พิมพ์คำสั่งนี้ก่อน:')
    print('    pip install pywin32')
    sys.exit(1)


def all_printers():
    """ชื่อเครื่องพิมพ์ทุกตัวที่เครื่องนี้เห็น — ชื่อต้องตรงเป๊ะ เว้นวรรคผิดก็ไม่เจอ"""
    flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    return [p[2] for p in win32print.EnumPrinters(flags, None, 1)]


def send_raw(printer_name: str, data: bytes) -> None:
    """
    ส่งข้อมูลดิบเข้าคิวพิมพ์

    ★ RAW คือหัวใจ ★ บอกให้ Windows "อย่าไปวาดอะไรทั้งนั้น ส่งไบต์พวกนี้ออกสายไปเลย"
    ไดรเวอร์จึงไม่แปลงเป็นภาพให้ และเครื่องพิมพ์ได้รับคำสั่ง ESC/POS ตรง ๆ ตามที่เราส่ง
    — นี่คือเหตุผลที่ไม่ต้องไปถอดไดรเวอร์หรือแย่งพอร์ตจาก Windows เลย
    """
    handle = win32print.OpenPrinter(printer_name)
    try:
        win32print.StartDocPrinter(handle, 1, ('OFU ทดสอบพิมพ์', None, 'RAW'))
        win32print.StartPagePrinter(handle)
        win32print.WritePrinter(handle, data)
        win32print.EndPagePrinter(handle)
        win32print.EndDocPrinter(handle)
    finally:
        win32print.ClosePrinter(handle)


def main() -> int:
    names = all_printers()
    print('เครื่องพิมพ์ที่เครื่องนี้เห็น:')
    for n in names:
        print('   -', n)
    print()

    if len(sys.argv) > 1:
        target = sys.argv[1]
    else:
        # เดาชื่อให้ก่อน — ชื่อที่มี POS หรือ 58 มักเป็นเครื่องพิมพ์บิล
        guesses = [n for n in names if 'POS' in n.upper() or '58' in n]
        if not guesses:
            print('หาเครื่องพิมพ์บิลไม่เจอ — สั่งใหม่โดยใส่ชื่อจากรายการข้างบน เช่น')
            print('    python test_print.py "POS58 Printer"')
            return 1
        target = guesses[0]

    if target not in names:
        print(f'ไม่มีเครื่องพิมพ์ชื่อ "{target}" ในเครื่องนี้ — ชื่อต้องตรงเป๊ะกับรายการข้างบน')
        return 1

    print(f'กำลังส่งไปที่: {target}')

    # ── คำสั่ง ESC/POS ชุดเล็กที่สุดที่พิสูจน์ได้ว่าท่อทั้งเส้นทำงาน ──
    # ESC @      = ล้างค่าเครื่องพิมพ์ให้เริ่มใหม่
    # ESC a 1    = จัดกึ่งกลาง
    # ESC ! 0x30 = ตัวใหญ่สองเท่า
    # ตัวหนังสือที่ส่งเป็นภาษาอังกฤษล้วน เพราะรอบนี้ทดสอบ "ท่อ" ไม่ได้ทดสอบภาษาไทย
    # (ภาษาไทยของจริงจะส่งไปเป็นรูปภาพ ไม่ต้องพึ่งฟอนต์ในเครื่องพิมพ์)
    data = b''.join([
        b'\x1b@',
        b'\x1ba\x01',
        b'\x1b!\x30',
        b'OFU TEST\n',
        b'\x1b!\x00',
        b'------------------------\n',
        b'Printer pipe works!\n',
        b'RAW via Windows spooler\n',
        b'------------------------\n',
        b'\x1ba\x00',
        b'1 x Test item      60.00\n',
        b'2 x Test item     120.00\n',
        b'TOTAL             180.00\n',
        # ภาษาไทยตรง ๆ — เพี้ยนได้ ไม่ถือว่าสอบตก แค่อยากเห็นว่าเครื่องทำยังไงกับมัน
        'ทดสอบภาษาไทย\n'.encode('cp874', errors='replace'),
        b'\n\n\n\n',  # เลื่อนกระดาษให้พ้นหัวพิมพ์ จะได้ฉีกได้
    ])

    try:
        send_raw(target, data)
    except Exception as e:  # noqa: BLE001 — อยากให้เห็นข้อความจริงจาก Windows
        print('ส่งไม่สำเร็จ:', e)
        return 1

    print()
    print('ส่งเข้าคิวพิมพ์เรียบร้อย')
    print('ไปดูที่เครื่องพิมพ์ครับ:')
    print('   มีกระดาษออก + อ่านออกว่า OFU TEST  = ผ่าน บอกผมได้เลย')
    print('   มีกระดาษออกแต่เป็นตัวขยะเต็มไปหมด   = ท่อผ่าน แต่ต้องปรับคำสั่ง')
    print('   ไม่มีอะไรออกเลย                      = ไม่ผ่าน ใช้ทางนี้ไม่ได้')
    return 0


if __name__ == '__main__':
    sys.exit(main())
