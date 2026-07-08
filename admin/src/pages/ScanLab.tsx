/**
 * /scan-lab — read the flight recorder (scanner haunting black box).
 *
 * Flow: reproduce the bug anywhere in the app (e.g. scan inside the product
 * modal), then open this page and copy the log. The interleaved key + route
 * events show exactly what the scanner sent and what triggered a navigation.
 * Also offers a focused test input for a clean capture of one scan.
 */

import { RiClipboardLine, RiDeleteBinLine, RiRefreshLine } from '@remixicon/react';
import { App, Button, Card, Input, Space, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { clearFlightLog, formatFlightLog, getFlightLog, type FlightEvent } from '../lib/flightRecorder';

const { Title, Text } = Typography;

function EventRow({ e }: { e: FlightEvent }) {
  if (e.kind === 'boot') {
    return (
      <div className="py-0.5 font-mono text-[12px] text-purple-600 font-semibold">
        #{e.seq} ===== เปิดหน้าใหม่ ({e.bootType}) → {e.path} =====
      </div>
    );
  }
  if (e.kind === 'nav') {
    return (
      <div className="py-0.5 font-mono text-[12px] text-red-600 font-semibold">
        #{e.seq} +{e.t}ms &gt;&gt;&gt; เปลี่ยนหน้า → {e.path}
      </div>
    );
  }
  const suspicious = e.key && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key) && (e.key.length > 1 && e.key !== 'Enter');
  return (
    <div className={`py-0.5 font-mono text-[12px] ${suspicious ? 'text-amber-600 font-semibold' : 'text-[#4b443f]'}`}>
      #{e.seq} +{e.t}ms key={e.mods ? `${e.mods}+` : ''}{e.key} <span className="text-[#a89c93]">code={e.code} gap={e.gap}ms target={e.target}</span>
      {e.prevented ? <Tag className="ml-2" color="green">ถูกดักไว้</Tag> : null}
    </div>
  );
}

export function ScanLab() {
  const { message } = App.useApp();
  const [log, setLog] = useState<FlightEvent[]>([]);
  const [probe, setProbe] = useState('');

  const refresh = () => setLog(getFlightLog());
  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 800);
    return () => clearInterval(iv);
  }, []);

  const copy = async () => {
    await navigator.clipboard.writeText(formatFlightLog());
    message.success('คัดลอก log แล้ว — ส่งให้ผู้ดูแลระบบได้เลย');
  };

  return (
    <>
      <div className="mb-4">
        <Title level={3} style={{ margin: 0 }}>ห้องแล็บสแกนเนอร์</Title>
        <Text type="secondary">
          กล่องดำบันทึกทุกปุ่มที่เครื่องยิงส่งมา + ทุกการเปลี่ยนหน้า — ทำให้เกิดอาการก่อน แล้วกลับมาหน้านี้กด "คัดลอก log"
        </Text>
      </div>

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Card size="small" title="ช่องทดสอบ (ยิงใส่ช่องนี้เพื่อดู log แบบสะอาด)">
          <Input
            autoComplete="off"
            placeholder="คลิกที่นี่แล้วยิงบาร์โค้ด 1 ครั้ง"
            value={probe}
            onChange={(e) => setProbe(e.target.value)}
            onPressEnter={() => setProbe('')}
          />
        </Card>

        <Card
          size="small"
          title={`เหตุการณ์ล่าสุด (${log.length})`}
          extra={
            <Space>
              <Button size="small" icon={<RiRefreshLine className="w-3.5 h-3.5" />} onClick={refresh}>รีเฟรช</Button>
              <Button size="small" icon={<RiDeleteBinLine className="w-3.5 h-3.5" />} onClick={() => { clearFlightLog(); refresh(); }}>ล้าง</Button>
              <Button size="small" type="primary" icon={<RiClipboardLine className="w-3.5 h-3.5" />} onClick={() => void copy()}>คัดลอก log</Button>
            </Space>
          }>
          <div className="max-h-[55vh] overflow-y-auto">
            {log.length === 0 ? (
              <Text type="secondary">ยังไม่มีเหตุการณ์ — ลองยิงบาร์โค้ดดู</Text>
            ) : (
              log.slice(-150).map((e) => <EventRow key={e.seq} e={e} />)
            )}
          </div>
        </Card>
      </Space>
    </>
  );
}
