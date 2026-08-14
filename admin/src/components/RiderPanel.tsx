/**
 * RiderPanel — the delivery half of the order drawer.
 *
 * The shop owner delivers in person, so the POS phone doubles as the rider app.
 * Everything a person actually needs on a doorstep, in the order they need it:
 * navigate there, ring the customer, and — while out for delivery — share the
 * live position so the customer can see the bike approaching.
 *
 * Only rendered for `shop_mode = 'delivery'`; a nationwide parcel has a courier
 * and a tracking number instead.
 */

import { RiMapPinLine, RiNavigationLine, RiPhoneLine } from '@remixicon/react';
import { App, Alert, Button, Space, Switch, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';

import { markCodCollected, type Order } from '../lib/orders';
import { OrderMiniMap } from './OrderMiniMap';
import { navUrl, startRiderBroadcast, type BroadcastStatus, type RiderBroadcast } from '../lib/riderLocation';

const { Text } = Typography;

const baht = (n: number) => `฿${n.toLocaleString('th-TH')}`;

/** Thai mobile numbers are stored 66… — tel: wants a dialable form. */
const telHref = (phone: string) => `tel:${phone.startsWith('66') ? `+${phone}` : phone}`;

const STATUS_COPY: Record<BroadcastStatus, { text: string; tone: 'ok' | 'warn' | 'bad' | 'mute' }> = {
  idle: { text: 'ยังไม่ได้แชร์ตำแหน่ง', tone: 'mute' },
  starting: { text: 'กำลังขอตำแหน่ง…', tone: 'mute' },
  live: { text: 'ลูกค้าเห็นตำแหน่งคุณอยู่', tone: 'ok' },
  denied: { text: 'ยังไม่ได้อนุญาตให้เข้าถึงตำแหน่ง — เปิดในตั้งค่าเบราว์เซอร์', tone: 'bad' },
  unsupported: { text: 'อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง', tone: 'bad' },
  error: { text: 'สัญญาณตำแหน่งขาดหาย กำลังลองใหม่', tone: 'warn' },
};
const TONE_COLOR = { ok: '#1E9E5C', warn: '#9C5C08', bad: '#A32A2C', mute: '#6A7167' } as const;

export function RiderPanel({ order, onChanged }: { order: Order; onChanged: () => Promise<void> }) {
  const { message } = App.useApp();
  const [status, setStatus] = useState<BroadcastStatus>('idle');
  const [fixCount, setFixCount] = useState(0);
  const [collecting, setCollecting] = useState(false);
  const broadcast = useRef<RiderBroadcast | null>(null);

  const outForDelivery = order.order_status === 'out_for_delivery';
  const hasPin = order.ship_lat != null && order.ship_lng != null;

  // Stop on unmount and whenever the order leaves out_for_delivery — the RLS
  // policy would reject the sends anyway, but leaving the GPS watch running
  // would keep the radio and the wake lock alive for nothing.
  useEffect(() => {
    if (!outForDelivery && broadcast.current) {
      broadcast.current.stop();
      broadcast.current = null;
      setFixCount(0);
    }
  }, [outForDelivery]);
  useEffect(
    () => () => {
      broadcast.current?.stop();
      broadcast.current = null;
    },
    [],
  );

  const toggle = (on: boolean) => {
    if (!on) {
      broadcast.current?.stop();
      broadcast.current = null;
      setFixCount(0);
      return;
    }
    setFixCount(0);
    broadcast.current = startRiderBroadcast(order.id, {
      onStatus: (s, detail) => {
        setStatus(s);
        if (s === 'denied' && detail) message.error(detail);
      },
      onFix: () => setFixCount((n) => n + 1),
    });
  };

  const sharing = broadcast.current !== null;
  const copy = STATUS_COPY[status];

  return (
    <>
      {/* หมุดที่ลูกค้าปักไว้ — ตอบคำถามแรกของคนส่ง "ที่นี่อยู่ไหน" ก่อนกดออกไปนำทาง */}
      {hasPin ? (
        <div className="mt-3">
          <OrderMiniMap lat={order.ship_lat!} lng={order.ship_lng!} />
        </div>
      ) : null}

      <Space wrap style={{ marginTop: 12 }}>
        <Button
          type="primary"
          icon={<RiNavigationLine className="w-4 h-4" />}
          disabled={!hasPin}
          href={hasPin ? navUrl(order.ship_lat!, order.ship_lng!) : undefined}
          target="_blank"
          rel="noreferrer">
          นำทาง
        </Button>
        <Button
          icon={<RiPhoneLine className="w-4 h-4" />}
          disabled={!order.ship_phone}
          href={order.ship_phone ? telHref(order.ship_phone) : undefined}>
          โทรหาลูกค้า
        </Button>
      </Space>

      {!hasPin ? (
        <Alert
          className="mt-2"
          type="warning"
          showIcon
          icon={<RiMapPinLine className="w-4 h-4" />}
          message="ออเดอร์นี้ไม่มีพิกัดปักหมุด"
          description="ลูกค้าพิมพ์ที่อยู่เองโดยไม่ปักหมุดบนแผนที่ — ต้องหาเส้นทางจากข้อความที่อยู่เอง"
        />
      ) : null}

      {/* แชร์ตำแหน่ง: เปิดได้เฉพาะตอนกำลังนำส่ง เพราะ RLS ฝั่งเซิร์ฟเวอร์ก็บังคับแบบเดียวกัน */}
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <Switch
          checked={sharing}
          disabled={!outForDelivery}
          onChange={toggle}
          checkedChildren="แชร์อยู่"
          unCheckedChildren="แชร์ตำแหน่ง"
        />
        <Text style={{ color: TONE_COLOR[sharing ? copy.tone : 'mute'], fontSize: 13 }}>
          {outForDelivery
            ? sharing
              ? `${copy.text}${fixCount ? ` · ส่งไปแล้ว ${fixCount} ครั้ง` : ''}`
              : 'ยังไม่ได้แชร์ตำแหน่ง'
            : 'เลื่อนสถานะเป็น "กำลังนำส่ง" ก่อนถึงจะแชร์ตำแหน่งได้'}
        </Text>
      </div>

      {/* เก็บเงินปลายทาง — เงินเข้ากระเป๋าเดียวกับขายหน้าร้าน รายงานสิ้นวันจึงรวมให้ */}
      {order.payment_method === 'cod' ? (
        <div className="mt-3">
          {order.cod_collected_at ? (
            <Alert
              type="success"
              showIcon
              message={`รับเงินสดแล้ว ${baht(order.cod_amount ?? order.total)}`}
              description="ยอดนี้รวมอยู่ในเงินสดของรายงานสิ้นวันแล้ว"
            />
          ) : (
            <Button
              type="primary"
              loading={collecting}
              onClick={async () => {
                setCollecting(true);
                try {
                  await markCodCollected(order.id);
                  message.success('บันทึกรับเงินสดแล้ว');
                  await onChanged();
                } catch {
                  message.error('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง');
                } finally {
                  setCollecting(false);
                }
              }}>
              รับเงินสดแล้ว {baht(order.total)}
            </Button>
          )}
        </div>
      ) : null}

      {sharing ? (
        <Text type="secondary" className="block mt-1 text-xs">
          เปิดหน้าจอค้างไว้ตลอดทาง — เบราว์เซอร์หยุดอ่านตำแหน่งเมื่อจอดับหรือสลับแอป
          (ระบบล็อกหน้าจอไว้ให้แล้วถ้าเครื่องรองรับ)
        </Text>
      ) : null}
    </>
  );
}
