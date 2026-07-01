import { App, Switch, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { DndTable, DragHandle } from '../components/DndTable';
import {
  apiError,
  listFeaturedSections,
  reorderFeaturedSections,
  setFeaturedPublish,
  type FeaturedSection,
} from '../lib/api';

const { Title, Text } = Typography;

const TARGET_LABEL: Record<string, string> = {
  category: 'หมวดหมู่',
  product: 'สินค้า',
  promo: 'โปรโมชัน',
  url: 'ลิงก์',
};

export function Featured() {
  const { message } = App.useApp();
  const [sections, setSections] = useState<FeaturedSection[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setSections(await listFeaturedSections());
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function onReorder(next: FeaturedSection[]) {
    setSections(next);
    try {
      await reorderFeaturedSections(next.map((s) => s.id));
    } catch (e) {
      message.error(apiError(e));
      void load();
    }
  }

  async function togglePublish(s: FeaturedSection, published: boolean) {
    setSections((cur) =>
      cur.map((x) => (x.id === s.id ? { ...x, publish_state: published ? 'published' : 'draft' } : x)),
    );
    try {
      await setFeaturedPublish(s.id, published);
    } catch (e) {
      message.error(apiError(e));
      void load();
    }
  }

  return (
    <>
      <div className="mb-4">
        <Title level={3} style={{ margin: 0 }}>
          จัดหน้าแอป
        </Title>
        <Text type="secondary">ลากเพื่อจัดลำดับแถวสินค้าเด่นที่แสดงหน้าแรกของแอปลูกค้า · เปิด/ปิดการแสดง</Text>
      </div>

      <DndTable<FeaturedSection>
        items={sections}
        onReorder={onReorder}
        loading={loading}
        scroll={{ x: 520 }}
        style={{ background: '#fff', borderRadius: 12 }}
        locale={{ emptyText: 'ยังไม่มีแถวสินค้าเด่น' }}
        columns={[
          { title: '', key: 'drag', width: 48, render: () => <DragHandle /> },
          {
            title: 'ชื่อแถว',
            key: 'title',
            render: (_, s) => <span className="font-medium text-[#2B2320]">{s.title}</span>,
          },
          {
            title: 'ลิงก์ “ดูทั้งหมด”',
            key: 'target',
            render: (_, s) =>
              s.see_all_target_type ? (
                <Tag bordered={false}>{TARGET_LABEL[s.see_all_target_type] ?? s.see_all_target_type}</Tag>
              ) : (
                <Text type="secondary">—</Text>
              ),
          },
          {
            title: 'แสดงในแอป',
            key: 'publish',
            width: 120,
            align: 'center',
            render: (_, s) => (
              <Switch
                checked={s.publish_state === 'published'}
                onChange={(v) => void togglePublish(s, v)}
                checkedChildren="แสดง"
                unCheckedChildren="ซ่อน"
              />
            ),
          },
        ]}
      />
    </>
  );
}
