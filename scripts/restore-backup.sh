#!/usr/bin/env bash
# กู้คืน/ตรวจไฟล์สำรองฐานข้อมูลจาก workflow backup-db
#
#   ตรวจไฟล์ (ไม่แตะฐานข้อมูลใด ๆ):
#     BACKUP_PASSPHRASE=รหัส ./scripts/restore-backup.sh ofu-XXXX.dump.enc
#
#   กู้ลงฐานข้อมูลจริง (อันตราย — ทับของเดิม ใช้กับ local/โปรเจกต์ใหม่เท่านั้น):
#     BACKUP_PASSPHRASE=รหัส ./scripts/restore-backup.sh ofu-XXXX.dump.enc "postgresql://..."
#
# โหลดไฟล์ .enc ได้จากหน้า Actions → run ของ backup-db → Artifacts
set -euo pipefail

ENC="${1:?ใส่ path ไฟล์ .enc}"
TARGET="${2:-}"
: "${BACKUP_PASSPHRASE:?ตั้งตัวแปร BACKUP_PASSPHRASE ก่อน}"

DUMP="${ENC%.enc}"
export PASS="$BACKUP_PASSPHRASE"
openssl enc -d -aes-256-cbc -pbkdf2 -pass env:PASS -in "$ENC" -out "$DUMP"
echo "ถอดรหัสแล้ว: $DUMP ($(du -h "$DUMP" | cut -f1))"

echo "── สารบัญใน dump (ตัวอย่าง 15 รายการ) ──"
pg_restore --list "$DUMP" | grep -E "TABLE DATA" | head -15
TABLES=$(pg_restore --list "$DUMP" | grep -cE "TABLE DATA")
echo "── รวมตารางที่มีข้อมูล: $TABLES ──"

if [ -z "$TARGET" ]; then
  echo "โหมดตรวจอย่างเดียว — ไฟล์สมบูรณ์ อ่านกลับได้"
  exit 0
fi

echo "!! กำลังกู้ลง: ${TARGET%%@*}@... ใน 5 วินาที (Ctrl+C เพื่อยกเลิก)"
sleep 5
pg_restore --no-owner --no-privileges --clean --if-exists -d "$TARGET" "$DUMP"
echo "กู้คืนเสร็จ"
