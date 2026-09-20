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
import datetime
import io
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ─────────────────────────────────────────────────────────────────────────────
# บันทึกลงไฟล์
#
# ★ รันแบบไม่มีหน้าต่างแล้วจะตาบอด ★ ตอนเปิดเองพร้อมเครื่อง เราใช้ pythonw ซึ่งไม่มี
# หน้าจอดำให้ดูเลย ข้อความที่ print ออกไปหายหมด — วันที่บิลไม่ออกแล้วไม่มีอะไรให้ดูเลย
# คือวันที่ไล่ปัญหาไม่ได้ เขียนลงไฟล์ข้าง ๆ ตัวโปรแกรมไว้เสมอ
# ─────────────────────────────────────────────────────────────────────────────
LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'agent.log')


def log(*parts: object) -> None:
    line = f'{datetime.datetime.now():%Y-%m-%d %H:%M:%S} ' + ' '.join(str(p) for p in parts)
    print(line)
    try:
        # ตัดไฟล์ทิ้งเมื่อโตเกิน 1 MB — ปล่อยไว้เป็นปีจะกินดิสก์โดยไม่มีใครดู
        if os.path.exists(LOG_PATH) and os.path.getsize(LOG_PATH) > 1_000_000:
            os.remove(LOG_PATH)
        with open(LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
    except OSError:
        pass  # เขียนบันทึกไม่ได้ ห้ามทำให้การพิมพ์พัง

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
# ★ ลิ้นชักต้องเด้งจากตรงนี้เท่านั้น ★
#
# ลิ้นชักไม่ได้ต่อกับคอม มันเสียบที่ช่อง RJ11 ท้ายเครื่องพิมพ์บิล เดิมมันเด้งเพราะไดรเวอร์
# ของเครื่องพิมพ์ถูกตั้งเป็น "เปิดลิ้นชักตอนพิมพ์" (ดู printDrawer.ts) — แต่เราส่งงานแบบ RAW
# ซึ่งสปูลเลอร์ยิงไบต์ตรงไปที่พอร์ตโดยไม่ผ่านไดรเวอร์เลย ไดรเวอร์จึงไม่มีโอกาสแทรกคำสั่งนี้
# ผลคือตั้งแต่ตัวกลางมาเป็นทางหลัก (15 ก.ย. 2026) บิลออกสวยแต่ลิ้นชักนิ่งสนิททุกใบ
# แคชเชียร์ต้องไปกด "เปิดลิ้นชักเปล่า" ซึ่งเขียน audit_log ทุกครั้ง = หลักฐานไล่เงินหาย
# เต็มไปด้วยรายการปลอม เราจึงต้องยิงคำสั่งนี้เองในทุกงานที่ส่งออกไป
#
# ESC p 0 25 250 — กระตุกสลักช่องที่ 1 เปิด 50 มิลลิวินาที เว้น 500 มิลลิวินาที
# เครื่องที่ไม่มีลิ้นชักเสียบอยู่จะไม่สนใจคำสั่งนี้ ไม่มีผลข้างเคียง
DRAWER_KICK = b'\x1bp\x00\x19\xfa'

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


# ─────────────────────────────────────────────────────────────────────────────
# สถานะเครื่องพิมพ์
#
# ★ ส่งเข้าคิวสำเร็จ ไม่ได้แปลว่ากระดาษออก ★ (เจ้าของถามเอง 15 ก.ย. 2026 ว่า "รู้มั้ยครับ
# ว่ามันออนอยู่หรือไม่ออน") Windows รับงานเข้าคิวให้เสมอแม้เครื่องพิมพ์ปิดอยู่ แล้วค่อย
# พิมพ์ตอนเปิด — ฝั่งเราจึงได้ "สำเร็จ" ทุกครั้งโดยไม่รู้ความจริง
# ตรงนี้ไปถามสถานะจาก Windows ตรง ๆ เพื่อบอกได้ว่าเครื่องพร้อมไหม มีงานค้างกี่งาน
#
# ★ ข้อจำกัดที่ต้องรู้ ★ เครื่องพิมพ์บิลราคาถูกที่ต่อ USB ส่วนใหญ่ไม่รายงานสถานะกลับมา
# Windows จึงขึ้นว่า "พร้อม" แม้ปิดเครื่องอยู่ — เชื่อได้เฉพาะตอนที่มันบอกว่ามีปัญหา
# ถ้าบอกว่าพร้อมให้ถือเป็น "ไม่มีรายงานปัญหา" ไม่ใช่การยืนยันว่ากระดาษจะออกแน่
PRINTER_PROBLEMS = (
    (0x00000080, 'ออฟไลน์'),
    (0x00001000, 'ไม่พร้อมใช้งาน'),
    (0x00000010, 'กระดาษหมด'),
    (0x00000008, 'กระดาษติด'),
    (0x00400000, 'ฝาเปิด'),
    (0x00100000, 'ต้องไปดูที่เครื่อง'),
    (0x00000002, 'เครื่องพิมพ์แจ้งข้อผิดพลาด'),
)
PRINTER_ATTRIBUTE_WORK_OFFLINE = 0x00000400


def printer_state(name: str) -> dict:
    """สถานะของเครื่องพิมพ์หนึ่งตัว — พร้อมไหม ติดปัญหาอะไร มีงานค้างกี่งาน"""
    try:
        handle = win32print.OpenPrinter(name)
        try:
            info = win32print.GetPrinter(handle, 2)
        finally:
            win32print.ClosePrinter(handle)
    except Exception as e:  # noqa: BLE001
        return {'name': name, 'ready': False, 'problems': [f'อ่านสถานะไม่ได้: {e}'], 'jobs': 0}

    status = int(info.get('Status', 0) or 0)
    attrs = int(info.get('Attributes', 0) or 0)
    problems = [text for flag, text in PRINTER_PROBLEMS if status & flag]
    if attrs & PRINTER_ATTRIBUTE_WORK_OFFLINE:
        problems.append('ถูกตั้งเป็นออฟไลน์ใน Windows')
    return {
        'name': name,
        'ready': not problems,
        'problems': problems,
        # งานค้างเยอะ = เครื่องรับงานแต่ไม่ได้พิมพ์ออกมา ซึ่งเป็นอาการของเครื่องที่ปิดอยู่
        'jobs': int(info.get('cJobs', 0) or 0),
    }


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


def image_to_escpos(
    png_bytes: bytes,
    width_dots: int = DOTS_58MM,
    cut: bool = False,
    feed_dots: int = 120,
    drawer: bool = True,
) -> tuple[bytes, dict]:
    """
    แปลงรูปบิลเป็นคำสั่งพิมพ์ภาพของ ESC/POS

    คืนทั้งคำสั่งที่จะส่ง และสถิติของภาพ (สูงกี่จุด หมึกแถวสุดท้ายอยู่ไหน เหลือขาวท้ายรูป
    กี่แถว) — สถิติคือสิ่งที่ตอบได้ว่าบิลครบไหมโดยไม่ต้องเปลืองกระดาษพิมพ์ออกมาดู

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
    # ★ แคบกว่าหัวพิมพ์ได้ ห้ามยืดให้เต็มเสมอ ★ เดิมเช็ค != แล้วขยายทุกกรณี ผลคือบิลถูกยืด
    # เป็น 48 มม. ทุกใบไม่ว่าหน้าเว็บจะตั้ง "ความกว้างเนื้อบิล" ไว้เท่าไหร่ (เจ้าของไล่ปรับค่านี้
    # เพื่อแก้ขอบขวาโดนตัดเมื่อ 5 ก.ย. 2026 แล้วงงว่าทำไมปรับแล้วไม่มีอะไรเปลี่ยน — เพราะ
    # โดนยืดกลับมาเท่าเดิมตรงบรรทัดนี้ และตัวอักษรก็ใหญ่กว่าที่ตั้งไว้ราว 20%)
    # ความกว้างของรูปที่ส่งมาคือความกว้างที่ต้องการอยู่แล้ว · รูปที่แคบกว่าหัวพิมพ์จะพิมพ์
    # ชิดซ้ายเองโดยปริยาย · ย่อเฉพาะตอนที่กว้างเกินหัวพิมพ์ ไม่งั้นข้อมูลล้นขอบหายไปเลย
    if img.width > width_dots:
        h = max(1, round(img.height * width_dots / img.width))
        img = img.resize((width_dots, h), Image.LANCZOS)

    # ★ บิลแคบกว่าหัวพิมพ์ต้องวางกลาง ไม่ใช่ชิดซ้าย ★ (เจ้าของแจ้ง 20 ก.ย. 2569 ว่า
    # "บิลเราเบี้ยว" ทันทีที่เลิกยืดบิลให้เต็มหัวพิมพ์) หัวพิมพ์เริ่มยิงจากขอบซ้ายของม้วน
    # เสมอ รูปที่แคบกว่าจึงกองอยู่ซ้ายแล้วเหลือขาวเป็นแถบทางขวา อ่านเป็นบิลที่พิมพ์เอียง
    # ทั้งที่ตัวหนังสือตรงทุกบรรทัด · เติมขาวสองข้างให้เท่ากันแล้วมันจะอยู่กลางม้วนพอดี
    # ขาวที่เติมไม่กินหมึกและไม่กินกระดาษเพิ่ม เพราะความสูงเท่าเดิม
    if img.width < width_dots:
        centered = Image.new(img.mode, (width_dots, img.height), 255)
        centered.paste(img, ((width_dots - img.width) // 2, 0))
        img = centered

    # ขาวดำล้วน — เครื่องพิมพ์ความร้อนมีแค่ "จุด" กับ "ไม่จุด" ไม่มีสีเทา
    img = img.point(lambda p: 0 if p < 160 else 255, mode='1')

    # ★ ห้ามให้บรรทัดสุดท้ายเป็นแถวสุดท้ายของรูป ★ (เจ้าของแจ้ง 15 ก.ย. 2026 ว่าบรรทัด
    # "สินค้าซื้อแล้วไม่รับคืน" พิมพ์ไม่หมด) ตัวหนังสือที่ชิดขอบล่างของรูปพอดีมีโอกาสโดน
    # ตัดครึ่งตัว — สระล่างของภาษาไทยอยู่ต่ำกว่าตัวอักษร จึงเป็นส่วนแรกที่หาย
    # เติมขาวท้ายรูปไว้ก่อน แล้วปัดความสูงให้ลงตัวกับ 8 แถว เครื่องพิมพ์จะได้ไม่ต้อง
    # จัดการแถบสุดท้ายที่เหลือเศษแค่ไม่กี่แถว
    pad = 24 + (-(img.height + 24)) % 8
    padded = Image.new('1', (img.width, img.height + pad), 1)  # 1 = ขาว
    padded.paste(img, (0, 0))
    img = padded

    # ★ เก็บภาพที่จะพิมพ์ไว้ดูเสมอ ★ เวลาบิลออกมาไม่ครบ คำถามแรกคือ "หายตั้งแต่ฝั่งเว็บ
    # หรือมาหายที่เครื่องพิมพ์" ซึ่งเดาจากกระดาษอย่างเดียวไม่ได้ (เจ้าของกับผมเสียเวลา
    # ไล่ผิดจุดไปสองรอบแล้ว 15 ก.ย. 2026) — ไฟล์นี้คือคำตอบ: ถ้าในไฟล์มีครบแต่กระดาษ
    # ไม่มี แปลว่าปัญหาอยู่ที่เครื่องพิมพ์ ถ้าในไฟล์ก็ไม่มี แปลว่าหายตั้งแต่ตอนถ่ายบิล
    try:
        img.save(os.path.join(os.path.dirname(LOG_PATH), 'last-print.png'))
    except OSError:
        pass  # เขียนไฟล์ไม่ได้ ห้ามทำให้การพิมพ์พัง

    # ★ วัดให้เครื่องบอกเอง ★ การเปิดรูปดูด้วยตาแล้วสรุปว่า "ท้ายขาด" เชื่อไม่ได้ เพราะ
    # ขอบล่างที่เห็นอาจเป็นแค่ขอบหน้าต่างเบราว์เซอร์ (เกือบหลงมาแล้ว 15 ก.ย. 2026)
    # ตัวเลขนี้ตอบชัด: หมึกแถวสุดท้ายอยู่ตรงไหน และเหลือขาวท้ายรูปกี่แถว
    # ถ้าเหลือขาวเยอะแต่กระดาษยังไม่มีบรรทัดนั้น = ปัญหาอยู่ที่เครื่องพิมพ์แน่นอน
    stats = {'width': img.width, 'height': img.height, 'last_ink': -1, 'white_tail': 0}
    try:
        px = img.load()
        for y in range(img.height - 1, -1, -1):
            if any(px[x, y] == 0 for x in range(img.width)):
                stats['last_ink'] = y
                break
        stats['white_tail'] = img.height - 1 - stats['last_ink']
        log(f"  ภาพบิล {img.width}x{img.height} จุด · หมึกแถวสุดท้าย {stats['last_ink']} "
            f"· ขาวท้ายรูป {stats['white_tail']} แถว")
    except Exception:  # noqa: BLE001 — วัดไม่ได้ก็ไม่ควรทำให้พิมพ์ไม่ได้
        pass

    width_bytes = (img.width + 7) // 8
    pixels = img.load()
    out = bytearray(b'\x1b@')  # ล้างค่าเครื่องพิมพ์
    # ★ เด้งลิ้นชักก่อนพิมพ์ ไม่ใช่หลังพิมพ์ ★ บิลหนึ่งใบใช้เวลาไหลออกมาสองสามวินาที
    # ถ้าไปเด้งท้ายชุดคำสั่ง แคชเชียร์ต้องยืนรอกระดาษก่อนถึงจะหยิบเงินทอนได้ทุกบิล
    if drawer:
        out += DRAWER_KICK

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

    # ★ ท้ายบิลขาด ★ (เจ้าของเจอกับกระดาษจริง 15 ก.ย. 2026 — สองรอบ)
    # รอบแรกผมเดาว่าเป็นที่การถ่ายรูปบิลแล้วแก้ผิดจุด · รอบนี้วัดจริงก่อน: ถ่ายรูปได้ครบ
    # 1553 จาก 1554 จุด และมีหมึกถึงบรรทัดสุดท้าย แปลว่าข้อมูลที่ส่งไปครบทั้งใบแล้ว
    #
    # ที่ขาดคือ "ขาดตอนฉีด" ไม่ใช่ขาดตอนพิมพ์ — หัวพิมพ์อยู่ลึกเข้าไปจากใบมีด/ขอบฉีก
    # ราว 1.5-2 ซม. ตัวหนังสือบรรทัดท้าย ๆ จึงยังค้างอยู่ในเครื่องตอนที่เราฉีกกระดาษ
    # แล้วโดนฉีกขาดกลางตัว ของเดิมเลื่อนให้แค่ 4 บรรทัด (~12 มม.) ไม่พอ
    # ★ เลื่อนเท่าที่จำเป็น ไม่มากกว่านั้น ★ เจ้าของแจ้ง 15 ก.ย. 2026 ว่า "ขอบกระดาษ
    # มันเหลือเยอะเกินด้านล่าง" — ตอนแก้ปัญหาท้ายบิลขาดผมใส่เผื่อไว้หลายชั้นพร้อมกัน
    # (เว้นท้ายใบเสร็จ + เว้นขาวท้ายรูป + เลื่อน 200 จุด + ขึ้นบรรทัดอีกสองครั้ง)
    # รวมแล้วเกิน 4 ซม. ต่อใบ ซึ่งเปลืองโดยไม่ได้อะไรเพิ่ม
    # ระยะที่ "จำเป็นจริง" คือระยะจากหัวพิมพ์ถึงขอบฉีกเท่านั้น (ราว 1.5 ซม.) ที่เหลือคือ
    # กระดาษที่ทิ้งเปล่าทุกใบ · ตัดบรรทัดเปล่าท้ายสุดออกด้วย เพราะ ESC J คุมระยะแม่นกว่า
    feed = max(0, min(feed_dots, 255))
    out += b'\x1b2'  # กลับไปใช้ระยะบรรทัดมาตรฐานก่อนเลื่อน
    if feed:
        out += b'\x1bJ' + bytes([feed])  # เลื่อนเป็นจำนวนจุดตรง ๆ แม่นกว่านับบรรทัด
    if cut:
        out += b'\x1dV\x42\x00'  # ตัดกระดาษ (เครื่องที่ไม่มีใบมีดจะไม่สนใจคำสั่งนี้)
    return bytes(out), stats


# ─────────────────────────────────────────────────────────────────────────────
# ฝั่งเว็บ
# ─────────────────────────────────────────────────────────────────────────────


class Handler(BaseHTTPRequestHandler):
    printer_name = ''
    paper_dots = DOTS_58MM
    do_cut = False
    feed_dots = 120
    dry_run = False
    drawer = True

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
        if self.path.startswith('/last'):
            # ★ เปิดดูจากเบราว์เซอร์ได้เลย ★ เจ้าของไม่ต้องไปงมหาไฟล์ใน C:\ofu
            # แค่พิมพ์ 127.0.0.1:9110/last ก็เห็นว่าบิลใบล่าสุดที่ส่งเข้าเครื่องพิมพ์
            # หน้าตาเป็นยังไง — เทียบกับกระดาษที่ออกมาได้ทันที
            path = os.path.join(os.path.dirname(LOG_PATH), 'last-print.png')
            try:
                with open(path, 'rb') as f:
                    raw = f.read()
            except OSError:
                self._json(404, {'ok': False, 'error': 'ยังไม่เคยพิมพ์บิลจากเครื่องนี้'})
                return
            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', 'image/png')
            self.send_header('Content-Length', str(len(raw)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(raw)
            return

        if self.path.startswith('/printers'):
            # สถานะของทุกเครื่องในเครื่องนี้ — ใช้ตอบคำถาม "แล้ว Brother ออนอยู่ไหม"
            # แยกจาก /ping เพราะการไล่ถามทีละเครื่องช้ากว่า และ /ping ถูกเรียกก่อนพิมพ์ทุกครั้ง
            self._json(200, {'ok': True, 'printers': [printer_state(n) for n in all_printers()]})
            return

        if self.path.startswith('/ping'):
            self._json(200, {
                'ok': True,
                'agent': 'ofu-pos-print',
                'printer': self.printer_name,
                'state': printer_state(self.printer_name),
                'printers': all_printers(),
            })
            return
        self._json(404, {'ok': False, 'error': 'not found'})

    def do_POST(self) -> None:  # noqa: N802
        if self.path.startswith('/drawer'):
            # ★ เปิดลิ้นชักโดยไม่ต้องพิมพ์อะไร ★ สลิปของหน้ารอบขาย (ใบเปิดรอบ/ใบนับเงิน/
            # สลิปเปิดลิ้นชักเปล่า) เป็น HTML ที่ไม่เคยถูกวาดลงจอ จึงถ่ายรูปส่งมาทางนี้ไม่ได้
            # เหมือนใบเสร็จ — แต่หน้าที่จริงของมันคือ "ทำให้ลิ้นชักเด้ง" ซึ่งทำได้ตรง ๆ
            # ตรงนี้ · ของเดิมฝากความหวังไว้กับไดรเวอร์ ถ้าเครื่องพิมพ์หลักเป็น Brother
            # สลิปจะไปออกเป็น A4 แล้วลิ้นชักไม่เด้งเลย ทั้งที่ระบบบันทึกไปแล้วว่าเปิด
            try:
                send_raw(self.printer_name, DRAWER_KICK)
            except Exception as e:  # noqa: BLE001
                log('  เปิดลิ้นชักไม่สำเร็จ:', e)
                self._json(500, {'ok': False, 'error': str(e)})
                return
            log('  เปิดลิ้นชัก (ไม่พิมพ์)')
            self._json(200, {'ok': True, 'drawer': True})
            return

        if not self.path.startswith('/print'):
            self._json(404, {'ok': False, 'error': 'not found'})
            return

        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0:
            self._json(400, {'ok': False, 'error': 'ไม่มีข้อมูลบิลส่งมา'})
            return
        body = self.rfile.read(length)

        query = self.path.split('?', 1)[1] if '?' in self.path else ''
        # ★ เด้งลิ้นชักเป็นค่าเริ่มต้น ★ เพราะนี่คือพฤติกรรมเดิมที่ร้านใช้มาตลอด (ไดรเวอร์
        # เด้งให้ทุกงานพิมพ์) การเงียบไว้ก่อนแปลว่าบิลเงินสดเปิดลิ้นชักไม่ได้ ซึ่งแย่กว่า
        # บิลโอน/QR ที่ลิ้นชักเด้งเกินมา · ปิดรายใบด้วย ?drawer=0 (เช่นบิลโอน) ปิดทั้งเครื่อง
        # ด้วย --no-drawer สำหรับเครื่องที่ตั้งให้ไดรเวอร์เด้งเองอยู่แล้ว ไม่งั้นจะเด้งซ้อนสองที
        drawer = self.drawer and 'drawer=0' not in query

        try:
            data, stats = image_to_escpos(
                body, self.paper_dots, self.do_cut, self.feed_dots, drawer=drawer
            )
        except Exception as e:  # noqa: BLE001
            self._json(400, {'ok': False, 'error': f'อ่านรูปบิลไม่ได้: {e}'})
            return

        # ★ ตรวจได้โดยไม่เปลืองกระดาษ ★ เจ้าของถามเอง 15 ก.ย. 2026 หลังพิมพ์ทดสอบไป
        # หลายใบระหว่างไล่ปัญหาบรรทัดท้ายหาย — แปลงบิลให้ครบทุกขั้นเหมือนพิมพ์จริง
        # (รวมเก็บ last-print.png และวัดหมึก) แค่ไม่ส่งเข้าเครื่องพิมพ์
        dry = self.dry_run or 'dry=1' in query
        if dry:
            log(f"  ตรวจอย่างเดียว ไม่พิมพ์ · ขาวท้ายรูป {stats['white_tail']} แถว")
            self._json(200, {'ok': True, 'printed': False, **stats})
            return

        try:
            send_raw(self.printer_name, data)
        except Exception as e:  # noqa: BLE001
            log('  พิมพ์ไม่สำเร็จ:', e)
            self._json(500, {'ok': False, 'error': str(e)})
            return

        # ★ ถามสถานะ "หลัง" ส่ง ★ ถามก่อนส่งแล้วบล็อกไว้จะทำให้บิลไม่ออกในกรณีที่
        # เครื่องพิมพ์แค่ไม่รายงานสถานะ (ซึ่งเป็นเรื่องปกติของเครื่องถูก ๆ) — ส่งไปก่อน
        # แล้วค่อยบอกว่ามีอะไรผิดปกติไหม ให้หน้าเว็บตัดสินใจว่าจะเตือนคนขายหรือไม่
        state = printer_state(self.printer_name)
        if not state['ready']:
            log('  ⚠ เครื่องพิมพ์แจ้ง:', ' · '.join(state['problems']))
        log(f'  พิมพ์แล้ว · รูป {len(body)} ไบต์ · คำสั่ง {len(data)} ไบต์ '
            f'· ดูภาพที่พิมพ์จริงได้ที่ last-print.png')
        self._json(200, {'ok': True, 'printed': True, 'state': state, **stats})


def main() -> int:
    ap = argparse.ArgumentParser(description='ตัวกลางพิมพ์บิลของร้านอู้ฟู่')
    ap.add_argument('--printer', help='ชื่อเครื่องพิมพ์บิล (ต้องตรงเป๊ะกับใน Windows)')
    ap.add_argument('--port', type=int, default=9110)
    ap.add_argument('--dots', type=int, default=DOTS_58MM, help='ความกว้างหัวพิมพ์เป็นจุด')
    ap.add_argument('--cut', action='store_true', help='สั่งตัดกระดาษท้ายบิล')
    # ★ ระยะเลื่อนท้ายบิล ★ ต้องมากพอให้บรรทัดสุดท้ายพ้นขอบฉีก ไม่งั้นฉีกแล้วท้ายบิลขาด
    # 8 จุด = 1 มม. · 120 จุด = 15 มม. ซึ่งเท่าระยะจากหัวพิมพ์ถึงขอบฉีกของเครื่องทั่วไป
    # น้อยกว่านี้บรรทัดท้ายจะยังค้างในเครื่องแล้วโดนฉีกขาด · มากกว่านี้คือทิ้งกระดาษเปล่า
    ap.add_argument('--feed', type=int, default=120, help='ระยะเลื่อนกระดาษท้ายบิล (จุด)')
    ap.add_argument('--no-drawer', action='store_true',
                    help='ไม่ต้องสั่งเปิดลิ้นชักตอนพิมพ์ (ใช้กับเครื่องที่ไดรเวอร์เด้งให้อยู่แล้ว)')
    ap.add_argument('--dry-run', action='store_true',
                    help='ตรวจอย่างเดียว ไม่พิมพ์จริง (ดูผลที่ /last)')
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
    Handler.feed_dots = args.feed
    Handler.dry_run = args.dry_run
    Handler.drawer = not args.no_drawer

    print('─────────────────────────────────────────────')
    print(' ตัวกลางพิมพ์บิล ร้านอู้ฟู่')
    print(f' เครื่องพิมพ์: {target}')
    print(f' ฟังอยู่ที่ : http://127.0.0.1:{args.port}')
    print('─────────────────────────────────────────────')
    print(' ปล่อยหน้าต่างนี้เปิดไว้ ปิดแล้วบิลจะไม่พิมพ์เอง')
    print(' กด Ctrl+C เพื่อหยุด')
    print()

    # ผูกกับ 127.0.0.1 เท่านั้น — เครื่องอื่นในวงแลนสั่งพิมพ์ไม่ได้
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    except OSError as e:
        # ★ เปิดซ้ำไม่ใช่ความผิดพลาด ★ ตัวนี้เปิดเองตอนล็อกอิน ถ้าเจ้าของกดเปิดเองอีกที
        # หรือล็อกอินซ้อน จะมีตัวที่สองมาแย่งพอร์ต — ตัวแรกทำงานอยู่แล้ว ตัวที่สองแค่ถอย
        # ออกเงียบ ๆ ดีกว่าขึ้น error ให้ตกใจว่าระบบพัง
        log(f'มีตัวกลางทำงานอยู่แล้วที่พอร์ต {args.port} ({e}) — ตัวนี้ปิดตัวเอง')
        return 0

    log(f'เริ่มทำงาน · เครื่องพิมพ์ {target} · พอร์ต {args.port}'
        + (' · โหมดตรวจอย่างเดียว ไม่พิมพ์จริง' if args.dry_run else '')
        # วันที่ลิ้นชักไม่เด้ง คำถามแรกคือ "ตัวกลางสั่งเปิดอยู่ไหม" — ให้บันทึกตอบได้เลย
        + ('' if Handler.drawer else ' · ไม่สั่งเปิดลิ้นชัก'))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nหยุดแล้ว')
    return 0


if __name__ == '__main__':
    sys.exit(main())
