import { RiBarcodeLine, RiCheckLine, RiPrinterLine } from '@remixicon/react';
import { App, Alert, Button, Card, Input, Modal, Segmented, Space, Switch, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { Receipt, type ReceiptProps } from '../components/Receipt';
import { apiError, getShopInfo, type ShopInfo } from '../lib/api';
import { contentMm, useReceiptConfig } from '../lib/receiptConfig';

const { Title, Text } = Typography;

/** A fake sale so the print test looks like a real bill. */
function sampleReceipt(shop: ShopInfo): ReceiptProps {
  const items = [
    { name: 'น้ำดื่ม', size: null, qty: 2, unitPrice: 14, lineTotal: 28 },
    { name: 'มันฝรั่งทอดกรอบ', size: null, qty: 1, unitPrice: 25, lineTotal: 25 },
    { name: 'ข้าวหอมมะลิ', size: null, qty: 1, unitPrice: 165, lineTotal: 165 },
  ];
  const subtotal = items.reduce((s, l) => s + l.lineTotal, 0);
  const vat = shop.vat_registered ? Math.round((subtotal * shop.vat_rate) / (100 + shop.vat_rate)) : 0;
  return {
    shop,
    saleNumber: 'TEST000001',
    at: new Date().toLocaleString('th-TH'),
    items,
    subtotal,
    discount: 0,
    vatAmount: vat,
    netAmount: subtotal - vat,
    total: subtotal,
    paymentMethod: 'cash',
    cashPaid: 250,
    change: 250 - subtotal,
  };
}

export function Settings() {
  const { message } = App.useApp();
  const [cfg, update] = useReceiptConfig();
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [scan, setScan] = useState('');
  const [lastScan, setLastScan] = useState<string | null>(null);

  useEffect(() => {
    void getShopInfo()
      .then(setShop)
      .catch((e) => message.error(apiError(e)));
  }, [message]);

  return (
    <>
      <div className="mb-4">
        <Title level={3} style={{ margin: 0 }}>
          ตั้งค่า
        </Title>
        <Text type="secondary">ตั้งค่าใบเสร็จ ขนาดกระดาษ และทดสอบเครื่องพิมพ์ / เครื่องยิงบาร์โค้ด</Text>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── ข้อมูลบนบิล ─────────────────────────────────────────────── */}
        <Card title="ข้อมูลบนบิล" size="small">
          <Space direction="vertical" size={14} className="w-full">
            <div>
              <div className="text-sm mb-1 text-[#4b443f]">ชื่อร้าน (บนหัวบิล)</div>
              <Input value={shop?.receipt_header || shop?.name || ''} disabled />
              <div className="text-xs text-gray-400 mt-1">แก้ชื่อร้าน/ภาษี ในระบบหลังบ้าน — ที่นี่ปรับเฉพาะข้อมูลเสริมบนบิล</div>
            </div>
            <div>
              <div className="text-sm mb-1 text-[#4b443f]">เบอร์โทร</div>
              <Input placeholder="เช่น 084-650-3494" value={cfg.phone} onChange={(e) => update({ phone: e.target.value })} />
            </div>
            <div>
              <div className="text-sm mb-1 text-[#4b443f]">ที่อยู่ (ถ้ามี)</div>
              <Input placeholder="เช่น 123 ถ.สุขุมวิท" value={cfg.address} onChange={(e) => update({ address: e.target.value })} />
            </div>
            <div>
              <div className="text-sm mb-1 text-[#4b443f]">ชื่อพนักงาน/แคชเชียร์</div>
              <Input placeholder="เช่น แคชเชียร์ 01" value={cfg.cashierName} onChange={(e) => update({ cashierName: e.target.value })} />
            </div>
            <div>
              <div className="text-sm mb-1 text-[#4b443f]">ข้อความท้ายบิล</div>
              <Input placeholder="เช่น สินค้าซื้อแล้วไม่รับคืน" value={cfg.footerNote} onChange={(e) => update({ footerNote: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#4b443f]">พิมพ์บาร์โค้ดเลขบิล</span>
              <Switch checked={cfg.showBarcode} onChange={(v) => update({ showBarcode: v })} checkedChildren="พิมพ์" unCheckedChildren="ปิด" />
            </div>
          </Space>
        </Card>

        {/* ── ขนาดกระดาษ + ทดสอบอุปกรณ์ ──────────────────────────────── */}
        <Space direction="vertical" size={16} className="w-full">
          <Card title="ขนาดกระดาษ" size="small">
            <Segmented
              block
              value={cfg.paperWidth}
              onChange={(v) => update({ paperWidth: v as 48 | 58 })}
              options={[
                { value: 48, label: '48 มม.' },
                { value: 58, label: '58 มม.' },
              ]}
            />
            <div className="text-xs text-gray-400 mt-2">
              เนื้อหาบิลจะกว้าง {contentMm(cfg.paperWidth)} มม. (เผื่อขอบเครื่อง) — ตั้งให้ตรงกับม้วนกระดาษของเครื่องพิมพ์
            </div>
          </Card>

          <Card title="ทดสอบอุปกรณ์" size="small">
            <Space direction="vertical" size={16} className="w-full">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <RiPrinterLine className="w-4 h-4 text-tremor-brand" />
                  <span className="text-sm font-medium">เครื่องพิมพ์</span>
                </div>
                <Button type="primary" icon={<RiPrinterLine className="w-4 h-4" />} onClick={() => setTestOpen(true)} disabled={!shop}>
                  พิมพ์ทดสอบ
                </Button>
                <div className="text-xs text-gray-400 mt-1">พิมพ์บิลตัวอย่างเพื่อเช็คขนาด/ความคมชัด (ตั้งระยะขอบ = ไม่มี)</div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <RiBarcodeLine className="w-4 h-4 text-tremor-brand" />
                  <span className="text-sm font-medium">เครื่องยิงบาร์โค้ด</span>
                </div>
                <Input
                  allowClear
                  placeholder="คลิกช่องนี้แล้วยิงบาร์โค้ด 1 ครั้ง"
                  value={scan}
                  onChange={(e) => setScan(e.target.value)}
                  onPressEnter={() => {
                    if (scan.trim()) {
                      setLastScan(scan.trim());
                      setScan('');
                    }
                  }}
                />
                {lastScan && (
                  <div className="mt-2">
                    <Tag color="success" icon={<RiCheckLine className="w-3.5 h-3.5 inline" />}>
                      อ่านได้: {lastScan}
                    </Tag>
                    <span className="text-xs text-gray-400 ml-1">เครื่องยิงทำงานปกติ</span>
                  </div>
                )}
              </div>
            </Space>
          </Card>
        </Space>
      </div>

      {testOpen && shop && (
        <Modal
          open
          title="พิมพ์ทดสอบ"
          onCancel={() => setTestOpen(false)}
          okText="พิมพ์"
          cancelText="ปิด"
          onOk={() => window.print()}
          okButtonProps={{ icon: <RiPrinterLine className="w-4 h-4" /> }}>
          <Alert
            type="info"
            showIcon
            className="mb-3"
            message="ในหน้าพิมพ์ ตั้ง ระยะขอบ = ไม่มี, ปรับขนาด = ค่าเริ่มต้น"
          />
          <div className="bg-[#f6f2ee] rounded-lg py-3">
            <Receipt {...sampleReceipt(shop)} />
          </div>
        </Modal>
      )}
    </>
  );
}
