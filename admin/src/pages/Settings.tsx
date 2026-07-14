import { RiBarcodeLine, RiCheckLine, RiPrinterLine } from '@remixicon/react';
import {
  App,
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Segmented,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';

import { useAuth } from '../auth';
import { Receipt, type ReceiptProps } from '../components/Receipt';
import {
  apiError,
  getShopSettingsFull,
  updateShopSettings,
  type ShopSettingsFull,
} from '../lib/api';
import {
  completeDeletionRequest,
  listDeletionRequests,
  type DeletionRequest,
} from '../lib/deletionRequests';
import { contentMm, useReceiptConfig } from '../lib/receiptConfig';

const { Title, Text } = Typography;

/** A fake sale so the print test looks like a real bill. */
function sampleReceipt(shop: ShopSettingsFull): ReceiptProps {
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
  const { profile } = useAuth();
  const isOwner = profile?.tier === 'owner';
  const [cfg, update] = useReceiptConfig();
  const [shop, setShop] = useState<ShopSettingsFull | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [scan, setScan] = useState('');
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [delReqs, setDelReqs] = useState<DeletionRequest[]>([]);

  const loadShop = () =>
    getShopSettingsFull()
      .then(setShop)
      .catch((e) => message.error(apiError(e)));

  const loadDeletionRequests = () =>
    listDeletionRequests()
      .then(setDelReqs)
      .catch((e) => message.error(apiError(e)));

  useEffect(() => {
    void loadShop();
    void loadDeletionRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  return (
    <>
      <div className="mb-4">
        <Title level={3} style={{ margin: 0 }}>
          ตั้งค่า
        </Title>
        <Text type="secondary">ตั้งค่าใบเสร็จ ขนาดกระดาษ และทดสอบเครื่องพิมพ์ / เครื่องยิงบาร์โค้ด</Text>
      </div>

      {isOwner && (
        <div className="mb-4">
          <ShopSettingsCard shop={shop} onSaved={loadShop} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── ข้อมูลบนบิล ─────────────────────────────────────────────── */}
        <Card title="ข้อมูลบนบิล" size="small">
          <Space direction="vertical" size={14} className="w-full">
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
                  autoComplete="off"
                  data-flight-log="true"
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

          {/* ── คำขอลบบัญชี (จากแอปลูกค้า — กติกา App Store / Play) ────── */}
          <Card
            title={
              <Space>
                คำขอลบบัญชี
                {delReqs.some((r) => r.status === 'pending') ? (
                  <Tag color="red">{delReqs.filter((r) => r.status === 'pending').length} รอดำเนินการ</Tag>
                ) : null}
              </Space>
            }
            size="small">
            {delReqs.length === 0 ? (
              <Text type="secondary">ยังไม่มีคำขอ — ลูกค้าส่งคำขอได้จากเมนูบัญชีในแอป</Text>
            ) : (
              <Space direction="vertical" size={10} className="w-full">
                <Text type="secondary" className="text-xs">
                  วิธีลบ: Supabase Dashboard → Authentication → ค้นอีเมล → Delete user
                  แล้วกลับมากด "ลบแล้ว" (ต้องทำภายใน 7 วันตามที่แจ้งลูกค้า)
                </Text>
                {delReqs.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[#2B2320]">{r.email_snapshot ?? '(ไม่มีอีเมล)'}</div>
                      <Text type="secondary" className="text-xs">
                        ขอเมื่อ {new Date(r.requested_at).toLocaleString('th-TH')}
                      </Text>
                    </div>
                    {r.status === 'pending' ? (
                      <Popconfirm
                        title="ยืนยันว่าลบผู้ใช้ใน Supabase แล้ว?"
                        okText="ลบแล้ว"
                        cancelText="ยัง"
                        onConfirm={() =>
                          void completeDeletionRequest(r.id)
                            .then(loadDeletionRequests)
                            .then(() => message.success('บันทึกแล้ว'))
                            .catch((e) => message.error(apiError(e)))
                        }>
                        <Button size="small" danger>
                          ลบแล้ว
                        </Button>
                      </Popconfirm>
                    ) : (
                      <Tag color={r.status === 'done' ? 'green' : 'default'}>
                        {r.status === 'done' ? 'เสร็จสิ้น' : 'ลูกค้ายกเลิก'}
                      </Tag>
                    )}
                  </div>
                ))}
              </Space>
            )}
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
            className="mb-3 no-print"
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

/** ตั้งค่าร้าน — owner-only: delivery/online fee, VAT, PromptPay, COD all move
 * real money, so this card only renders for admin_tier='owner' (App.useApp's
 * useAuth().profile.tier); the actual security boundary is still the RPC's
 * is_owner_of check (0059_admin_promo_and_settings.sql), this is just the UI. */
function ShopSettingsCard({
  shop,
  onSaved,
}: {
  shop: ShopSettingsFull | null;
  onSaved: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (shop) form.setFieldsValue(shop);
  }, [shop, form]);

  const submit = async () => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      await updateShopSettings({
        name: (v.name as string).trim(),
        promptpay_id: v.promptpay_id?.trim() || null,
        promptpay_name: v.promptpay_name?.trim() || null,
        delivery_fee: v.delivery_fee,
        free_delivery_threshold: v.free_delivery_threshold,
        online_fee: v.online_fee,
        online_free_threshold: v.online_free_threshold,
        cod_enabled: v.cod_enabled,
        cod_cap: v.cod_cap ?? null,
        vat_registered: v.vat_registered,
        vat_rate: v.vat_rate,
        tax_id: v.tax_id?.trim() || null,
        branch_code: v.branch_code?.trim() || '00000',
        receipt_header: v.receipt_header?.trim() || null,
        receipt_footer: v.receipt_footer?.trim() || null,
      });
      message.success('บันทึกการตั้งค่าร้านแล้ว');
      onSaved();
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="ตั้งค่าร้าน" size="small" loading={!shop}>
      {shop && (
        <Form form={form} layout="vertical" requiredMark={false} onFinish={() => void submit()}>
          <div className="grid gap-x-4 md:grid-cols-2">
            <Form.Item name="name" label="ชื่อร้าน" rules={[{ required: true, message: 'กรอกชื่อร้าน' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="receipt_header" label="ข้อความหัวบิล (ไม่กรอก = ใช้ชื่อร้าน)">
              <Input placeholder={shop.name} />
            </Form.Item>
            <Form.Item name="receipt_footer" label="ข้อความท้ายบิล">
              <Input placeholder="ขอบคุณที่ใช้บริการ" />
            </Form.Item>
          </div>

          <div className="border-t border-dashed border-gray-200 my-3" />
          <Text type="secondary" className="text-xs">
            บัญชีรับเงินพร้อมเพย์ — เลขนี้คือปลายทางเงินจริงของ QR ทุกใบที่ลูกค้าจ่าย พิมพ์ผิดเงินจะไม่เข้าบัญชีร้าน
          </Text>
          <div className="grid gap-x-4 md:grid-cols-2 mt-2">
            <Form.Item
              name="promptpay_id"
              label="เลขพร้อมเพย์"
              rules={[
                {
                  pattern: /^[0-9]{10}$|^[0-9]{13}$|^[0-9]{15}$/,
                  message: 'ต้องเป็นตัวเลข 10 หลัก (มือถือ) 13 หลัก (บัตร ปชช.) หรือ 15 หลัก (e-Wallet)',
                },
              ]}>
              <Input placeholder="เช่น 0812345678" autoComplete="off" />
            </Form.Item>
            <Form.Item name="promptpay_name" label="ชื่อบัญชีพร้อมเพย์">
              <Input placeholder="เช่น นาย สมชาย ใจดี" />
            </Form.Item>
          </div>

          <div className="border-t border-dashed border-gray-200 my-3" />
          <div className="grid gap-x-4 md:grid-cols-2">
            <Form.Item name="delivery_fee" label="ค่าส่งเดลิเวอรี่ (บาท)" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} addonBefore="฿" />
            </Form.Item>
            <Form.Item name="free_delivery_threshold" label="ยอดซื้อที่ส่งฟรี (เดลิเวอรี่)" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} addonBefore="฿" />
            </Form.Item>
            <Form.Item name="online_fee" label="ค่าส่งพัสดุ (ออนไลน์)" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} addonBefore="฿" />
            </Form.Item>
            <Form.Item name="online_free_threshold" label="ยอดซื้อที่ส่งฟรี (พัสดุ)" rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} addonBefore="฿" />
            </Form.Item>
          </div>

          <div className="border-t border-dashed border-gray-200 my-3" />
          <div className="grid gap-x-4 md:grid-cols-3">
            <Form.Item name="vat_registered" label="จดทะเบียน VAT" valuePropName="checked">
              <Switch checkedChildren="จด" unCheckedChildren="ไม่จด" />
            </Form.Item>
            <Form.Item name="vat_rate" label="อัตรา VAT (%)" rules={[{ required: true }]}>
              <InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" />
            </Form.Item>
            <Form.Item name="branch_code" label="รหัสสาขา">
              <Input placeholder="00000" />
            </Form.Item>
            <Form.Item name="tax_id" label="เลขผู้เสียภาษี" className="md:col-span-2">
              <Input placeholder="เลขประจำตัวผู้เสียภาษี 13 หลัก" />
            </Form.Item>
          </div>

          <div className="border-t border-dashed border-gray-200 my-3" />
          <div className="grid gap-x-4 md:grid-cols-2 items-end">
            <Form.Item name="cod_enabled" label="เก็บเงินปลายทาง (COD)" valuePropName="checked">
              <Switch checkedChildren="เปิด" unCheckedChildren="ปิด" />
            </Form.Item>
            <Form.Item name="cod_cap" label="วงเงินสูงสุดต่อออเดอร์ (COD)">
              <InputNumber min={0} style={{ width: '100%' }} addonBefore="฿" placeholder="ไม่จำกัด" />
            </Form.Item>
          </div>

          <Button type="primary" htmlType="submit" loading={busy}>
            บันทึกการตั้งค่าร้าน
          </Button>
        </Form>
      )}
    </Card>
  );
}
