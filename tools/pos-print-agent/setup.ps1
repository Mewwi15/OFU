# ติดตั้งตัวกลางพิมพ์บิลให้เปิดเองทุกครั้งที่เปิดเครื่อง — รันครั้งเดียวจบ
#
# เจ้าของทักเรื่องนี้เอง 15 ก.ย. 2026: "ลูกค้าคลิกเปิดโปรแกรม POS แค่ครั้งเดียวแน่ๆ
# แต่ตอนนี้เราเพิ่มกระบวนการแล้ว"
#
# ★ ไม่ให้เว็บไปสั่ง Python ★ ทางที่ตรงกว่าคือให้ตัวกลางเปิดเองตั้งแต่ล็อกอินเข้าเครื่อง
# พอถึงเวลาเปิดหน้าขาย มันรออยู่แล้ว — ไอคอนเว็บบนหน้าจอไม่ต้องแก้อะไรเลย ยังคลิกเดียว
# เหมือนเดิม และถ้าวันไหนตัวกลางไม่ทำงาน หน้าขายจะถอยไปพิมพ์ผ่านเบราว์เซอร์ให้เอง
# ไม่ใช่ขายไม่ได้
#
# ★ ใช้ pythonw ไม่ใช่ python ★ จะได้ไม่มีหน้าจอดำค้างอยู่บนทาสก์บาร์ให้เผลอกดปิด
# (ปิดเมื่อไหร่บิลก็ไม่พิมพ์เอง) แลกกับการที่มองไม่เห็นข้อความ จึงเขียนลง agent.log แทน
#
# วิธีรัน — เปิด PowerShell แล้ววางบรรทัดเดียวนี้:
#   [Net.ServicePointManager]::SecurityProtocol='Tls12'; irm https://raw.githubusercontent.com/Mewwi15/OFU/main/tools/pos-print-agent/setup.ps1 | iex

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = 'Tls12'
$ProgressPreference = 'SilentlyContinue'

$dir = 'C:\ofu'
$raw = 'https://raw.githubusercontent.com/Mewwi15/OFU/main/tools/pos-print-agent/agent.py'
$name = 'OFU Print Agent'

Write-Host ''
Write-Host '=== ติดตั้งตัวกลางพิมพ์บิล ร้านอู้ฟู่ ===' -ForegroundColor Cyan
Write-Host ''

# ── 1. ตรวจว่ามี Python ──
try {
  $py = (Get-Command pythonw -ErrorAction Stop).Source
} catch {
  Write-Host 'ไม่พบ Python ในเครื่องนี้' -ForegroundColor Red
  Write-Host 'ลงก่อนด้วยคำสั่งนี้ แล้วปิด PowerShell เปิดใหม่ ค่อยรันตัวติดตั้งนี้อีกที:'
  Write-Host "  Invoke-WebRequest 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe' -OutFile `"`$env:TEMP\py.exe`"; Start-Process `"`$env:TEMP\py.exe`" -ArgumentList '/passive','InstallAllUsers=1','PrependPath=1' -Wait"
  return
}
Write-Host "[1/5] Python : $py" -ForegroundColor Green

# ── 2. ส่วนเสริมที่ต้องใช้ ──
Write-Host '[2/5] ติดตั้ง pywin32 + pillow ...'
& python -m pip install --quiet --disable-pip-version-check pywin32 pillow
Write-Host '      เรียบร้อย' -ForegroundColor Green

# ── 3. โหลดตัวกลางมาไว้ในเครื่อง ──
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Invoke-WebRequest $raw -OutFile "$dir\agent.py"
Write-Host "[3/5] วางไฟล์ไว้ที่ $dir\agent.py" -ForegroundColor Green

# ── 4. ให้เปิดเองตอนล็อกอิน ──
# ใช้ทางลัดในโฟลเดอร์ Startup ไม่ใช่ Task Scheduler — เจ้าของเปิดดู/ลบเองได้ด้วยตัวเอง
# (กด Win+R พิมพ์ shell:startup) ไม่ต้องรื้อระบบ
$startup = [Environment]::GetFolderPath('Startup')
$lnk = Join-Path $startup "$name.lnk"
$sc = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
$sc.TargetPath = $py
$sc.Arguments = "`"$dir\agent.py`""
$sc.WorkingDirectory = $dir
$sc.Description = 'ส่งบิลจากหน้าขายเข้าเครื่องพิมพ์บิลโดยตรง'
$sc.Save()
Write-Host "[4/5] ตั้งให้เปิดเองตอนเปิดเครื่องแล้ว" -ForegroundColor Green

# ── 5. เปิดเลยตอนนี้ ไม่ต้องรอรีสตาร์ท ──
Get-Process pythonw -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -eq $py } |
  Stop-Process -Force -ErrorAction SilentlyContinue
Start-Process $py -ArgumentList "`"$dir\agent.py`"" -WorkingDirectory $dir
Start-Sleep -Seconds 2

# ── ตรวจผลจริง ไม่ใช่เดาว่าน่าจะได้ ──
try {
  $ping = Invoke-RestMethod 'http://127.0.0.1:9110/ping' -TimeoutSec 5
  Write-Host "[5/5] ทำงานแล้ว · จะพิมพ์ออก: $($ping.printer)" -ForegroundColor Green
  Write-Host ''
  Write-Host 'เสร็จเรียบร้อย' -ForegroundColor Cyan
  Write-Host 'เปิดหน้าขายจากไอคอนเดิมได้เลย กดชำระเงินแล้วบิลจะออกเอง'
} catch {
  Write-Host '[5/5] เปิดแล้วแต่ยังตอบไม่ได้' -ForegroundColor Yellow
  Write-Host "      ดูสาเหตุได้ที่ $dir\agent.log"
}
Write-Host ''
