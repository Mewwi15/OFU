import { RiRefund2Line, RiShoppingBag3Line, RiStore2Line } from '@remixicon/react';
import { Alert, App, Card, Col, Progress, Row, Segmented, Statistic, Table, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import { apiError, listLowStock, posDashboard, profitReport, type Dashboard, type LowStockItem, type ProfitReport } from '../lib/api';

const { Title, Text } = Typography;
const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

type RangeKey = 'today' | '7d' | 'month';

function rangeBounds(key: RangeKey): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  if (key === '7d') from.setDate(from.getDate() - 6);
  if (key === 'month') from.setDate(1);
  return { from, to };
}

export function Reports() {
  const { message } = App.useApp();
  const [range, setRange] = useState<RangeKey>('today');
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [lowStockLoading, setLowStockLoading] = useState(true);
  const [lowStockError, setLowStockError] = useState(false);
  const [profit, setProfit] = useState<ProfitReport | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const { from, to } = rangeBounds(range);
    setProfit(null);
    void profitReport(from.toISOString(), to.toISOString())
      .then((p) => setProfit(p))
      .catch(() => setProfit(null)); // migration 0076 ยังไม่รัน — ซ่อนส่วนกำไรเฉย ๆ
    posDashboard(from.toISOString(), to.toISOString())
      .then((d) => alive && setData(d))
      .catch((e) => alive && message.error(apiError(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [range, message]);

  // Low/out-of-stock is range-independent — load once. A swallowed fetch
  // error previously left `lowStock` at its initial [], which the table then
  // rendered as "สต็อกเพียงพอทุกรายการ" — a false all-clear indistinguishable
  // from a real empty result. Track loading/error explicitly instead.
  useEffect(() => {
    let alive = true;
    setLowStockLoading(true);
    setLowStockError(false);
    listLowStock()
      .then((rows) => {
        if (alive) setLowStock(rows);
      })
      .catch(() => {
        if (alive) setLowStockError(true);
      })
      .finally(() => {
        if (alive) setLowStockLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const totalGross = useMemo(() => (data ? data.onsite.gross + data.online.gross : 0), [data]);
  const pct = (v: number, t: number) => (t > 0 ? Math.round((v / t) * 100) : 0);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <Title level={3} style={{ margin: 0 }}>รายงานยอดขาย</Title>
          <Text type="secondary">หน้าร้าน + ออนไลน์ · รวมสต็อกเดียวกัน</Text>
        </div>
        <Segmented
          value={range}
          onChange={(v) => setRange(v as RangeKey)}
          options={[
            { label: 'วันนี้', value: 'today' },
            { label: '7 วัน', value: '7d' },
            { label: 'เดือนนี้', value: 'month' },
          ]}
        />
      </div>

      <Row gutter={[12, 12]} className="mb-1">
        <Col xs={12} lg={6}>
          <Card size="small" styles={{ body: { padding: '12px 16px' } }} loading={loading}>
            <Statistic title="ยอดขายรวม" value={totalGross} prefix="฿" valueStyle={{ color: '#5B8C6E', fontWeight: 700 }} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small" styles={{ body: { padding: '12px 16px' } }} loading={loading}>
            <Statistic title="บิลหน้าร้าน" value={data?.onsite.count ?? 0} suffix="บิล" />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small" styles={{ body: { padding: '12px 16px' } }} loading={loading}>
            <Statistic title="ยอดออนไลน์" value={data?.online.gross ?? 0} prefix="฿" />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card size="small" styles={{ body: { padding: '12px 16px' } }} loading={loading}>
            <Statistic title="VAT (ภาษีขาย)" value={data?.onsite.vat ?? 0} prefix="฿" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={12}>
          <Card title="ตามช่องทาง" loading={loading}>
            {data && (
              <div className="space-y-4">
                <ChannelBar Icon={RiStore2Line} label="หน้าร้าน (POS)" amount={data.onsite.gross} count={data.onsite.count} pct={pct(data.onsite.gross, totalGross)} stroke="#5B8C6E" />
                <ChannelBar Icon={RiShoppingBag3Line} label="ออนไลน์" amount={data.online.gross} count={data.online.count} pct={pct(data.online.gross, totalGross)} stroke="#1E9E5C" />
                {data.onsite.refunds > 0 && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: '#E5484D' }}>
                    <RiRefund2Line className="w-4 h-4" />
                    คืนเงิน {baht(data.onsite.refunds)}
                  </div>
                )}
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="วิธีชำระ (หน้าร้าน)" loading={loading}>
            {data && (
              <div className="space-y-3">
                <PayRow label="เงินสด" value={data.onsite.cash} pct={pct(data.onsite.cash, data.onsite.gross)} />
                <PayRow label="พร้อมเพย์" value={data.onsite.promptpay} pct={pct(data.onsite.promptpay, data.onsite.gross)} />
                <PayRow label="เครดิตร้าน" value={data.onsite.store_credit} pct={pct(data.onsite.store_credit, data.onsite.gross)} />
                <div className="flex items-center justify-between text-sm pt-2 border-t" style={{ borderColor: '#E8E8E8' }}>
                  <Text type="secondary">ส่วนลดที่ให้</Text>
                  <span className="font-medium">{baht(data.onsite.discount)}</span>
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {profit ? (
        <Card title="กำไรขั้นต้น" className="mt-4">
          {(() => {
            const revenue = profit.pos.revenue + profit.online.revenue;
            const cost = profit.pos.cost + profit.online.cost;
            const billDisc = profit.pos.bill_discount ?? 0;
            const gp = revenue - billDisc - cost;
            const pctGp = revenue - billDisc > 0 ? (gp / (revenue - billDisc)) * 100 : 0;
            return (
              <>
                <Row gutter={[16, 16]}>
                  <Col xs={12} lg={6}><Statistic title="ยอดขาย (หลังส่วนลด)" value={revenue - billDisc} prefix="฿" /></Col>
                  <Col xs={12} lg={6}><Statistic title="ต้นทุนของที่ขาย" value={cost} prefix="฿" /></Col>
                  <Col xs={12} lg={6}>
                    <Statistic title="กำไรขั้นต้น" value={gp} prefix="฿"
                      valueStyle={{ color: gp >= 0 ? '#017A3A' : '#C9252B', fontWeight: 700 }} />
                  </Col>
                  <Col xs={12} lg={6}>
                    <Statistic title="อัตรากำไร" value={pctGp} precision={1} suffix="%"
                      valueStyle={{ color: gp >= 0 ? '#017A3A' : '#C9252B' }} />
                  </Col>
                </Row>
                {profit.missing_cost_lines > 0 ? (
                  <Text type="warning" style={{ fontSize: 13 }}>
                    มี {profit.missing_cost_lines} บรรทัดขายที่สินค้ายังไม่เคยกรอกทุน — กำไรจริงต่ำกว่าตัวเลขนี้
                    (กรอกทุนได้ตอนรับของเข้า หรือในหน้าสินค้า)
                  </Text>
                ) : null}
                <Table
                  className="mt-3"
                  size="small"
                  rowKey={(r) => `${r.name}-${r.size ?? ''}`}
                  pagination={{ pageSize: 15, showSizeChanger: false }}
                  dataSource={profit.products}
                  locale={{ emptyText: 'ยังไม่มีข้อมูลในช่วงนี้' }}
                  columns={[
                    { title: 'สินค้า', render: (_, r) => `${r.name}${r.size ? ` (${r.size})` : ''}` },
                    { title: 'ขาย (ชิ้น)', dataIndex: 'qty', width: 90, align: 'right',
                      sorter: (a, b) => a.qty - b.qty },
                    { title: 'ยอดขาย', dataIndex: 'revenue', width: 110, align: 'right',
                      render: (v) => baht(v), sorter: (a, b) => a.revenue - b.revenue,
                      defaultSortOrder: 'descend' as const },
                    { title: 'ทุน', dataIndex: 'cost', width: 110, align: 'right', render: (v) => baht(v) },
                    { title: 'กำไร', dataIndex: 'profit', width: 110, align: 'right',
                      sorter: (a, b) => a.profit - b.profit,
                      render: (v: number) => (
                        <span style={{ color: v < 0 ? '#C9252B' : undefined, fontWeight: v < 0 ? 600 : undefined }}>
                          {baht(v)}
                        </span>
                      ) },
                    { title: '%', width: 80, align: 'right',
                      render: (_, r) => (r.revenue > 0 ? `${((r.profit / r.revenue) * 100).toFixed(0)}%` : '-') },
                  ]}
                />
                <Text type="secondary" style={{ fontSize: 12.5 }}>
                  รายสินค้าคิดก่อนหักส่วนลดท้ายบิล · แถวสีแดง = ขายต่ำกว่าทุน ควรเช็คราคา
                </Text>
              </>
            );
          })()}
        </Card>
      ) : null}

      <Card title="สินค้าขายดี" className="mt-4" loading={loading}>
        <Table
          size="small"
          rowKey="name"
          pagination={false}
          locale={{ emptyText: 'ยังไม่มีข้อมูลในช่วงนี้' }}
          dataSource={data?.top ?? []}
          columns={[
            {
              title: '#',
              key: 'rank',
              width: 48,
              render: (_, __, i) => (
                <Tag color="#F5F5F5" style={{ color: '#5B8C6E', border: 'none', margin: 0 }}>{i + 1}</Tag>
              ),
            },
            { title: 'สินค้า', dataIndex: 'name', key: 'name' },
            { title: 'จำนวน', dataIndex: 'qty', key: 'qty', align: 'right', width: 100, render: (q: number) => `${q} ชิ้น` },
            { title: 'ยอดขาย', dataIndex: 'amount', key: 'amount', align: 'right', width: 120, render: (a: number) => <span className="font-medium">{baht(a)}</span> },
          ]}
        />
      </Card>

      <Card
        title={`สต็อกใกล้หมด / หมด${!lowStockError && lowStock.length ? ` (${lowStock.length})` : ''}`}
        className="mt-4"
        loading={lowStockLoading}>
        {lowStockError ? (
          <Alert
            type="error"
            showIcon
            message="โหลดรายการสต็อกใกล้หมดไม่สำเร็จ"
            description="นี่ไม่ใช่ผลจริงว่าสต็อกพอ — ลองรีเฟรชหน้านี้อีกครั้ง"
          />
        ) : (
          <Table<LowStockItem>
            size="small"
            rowKey={(r) => r.product_name + (r.size ?? '')}
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
            locale={{ emptyText: 'สต็อกเพียงพอทุกรายการ' }}
            dataSource={lowStock}
            columns={[
              {
                title: 'สินค้า',
                key: 'name',
                render: (_, r) => (r.size ? `${r.product_name} (${r.size})` : r.product_name),
              },
              {
                title: 'คงเหลือ',
                key: 'stock',
                align: 'right',
                width: 120,
                render: (_, r) => (
                  <Tag color={r.stock_qty <= 0 ? 'error' : 'warning'} bordered={false}>
                    {r.stock_qty <= 0 ? 'หมด' : `เหลือ ${r.stock_qty}`}
                  </Tag>
                ),
              },
              {
                title: 'แจ้งเตือนที่',
                dataIndex: 'threshold',
                key: 'threshold',
                align: 'right',
                width: 110,
                render: (t: number) => <span className="text-gray-400">≤ {t}</span>,
              },
            ]}
          />
        )}
      </Card>
    </>
  );
}

function ChannelBar({
  Icon,
  label,
  amount,
  count,
  pct,
  stroke,
}: {
  Icon: typeof RiStore2Line;
  label: string;
  amount: number;
  count: number;
  pct: number;
  stroke: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          {label}
          <Text type="secondary">· {count} บิล</Text>
        </span>
        <span className="font-semibold">{baht(amount)}</span>
      </div>
      <Progress percent={pct} showInfo={false} strokeColor={stroke} trailColor="#F0F0F0" />
    </div>
  );
}

function PayRow({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <Text type="secondary">{label}</Text>
      <span className="flex items-center gap-2">
        <Text type="secondary" className="text-xs">{pct}%</Text>
        <span className="font-medium w-20 text-right inline-block">{baht(value)}</span>
      </span>
    </div>
  );
}
