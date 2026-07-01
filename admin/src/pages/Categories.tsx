import { RiAddLine, RiDeleteBinLine, RiPencilLine } from '@remixicon/react';
import { App, Button, Form, Input, Modal, Popconfirm, Space, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';

import { DndTable, DragHandle } from '../components/DndTable';
import {
  apiError,
  deleteCategory,
  listCategories,
  reorderCategories,
  upsertCategory,
  type Category,
} from '../lib/api';

const { Title, Text } = Typography;

export function Categories() {
  const { message } = App.useApp();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | 'new' | null>(null);

  async function load() {
    setLoading(true);
    try {
      setCategories(await listCategories());
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function onReorder(next: Category[]) {
    setCategories(next); // optimistic
    try {
      await reorderCategories(next.map((c) => c.id));
    } catch (e) {
      message.error(apiError(e));
      void load();
    }
  }

  async function onDelete(c: Category) {
    try {
      await deleteCategory(c.id);
      message.success('ลบหมวดหมู่แล้ว');
      await load();
    } catch (e) {
      message.error(apiError(e));
    }
  }

  const columns: ColumnsType<Category> = [
    { title: '', key: 'drag', width: 48, render: () => <DragHandle /> },
    { title: 'ชื่อหมวดหมู่', key: 'name', render: (_, c) => <span className="font-medium text-[#2B2320]">{c.name}</span> },
    {
      title: 'จัดการ',
      key: 'actions',
      width: 110,
      align: 'right',
      render: (_, c) => (
        <Space size={4}>
          <Tooltip title="แก้ไข">
            <Button size="small" type="text" icon={<RiPencilLine className="w-[17px] h-[17px]" />} onClick={() => setEditing(c)} />
          </Tooltip>
          <Popconfirm title="ลบหมวดหมู่นี้?" okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }} onConfirm={() => void onDelete(c)}>
            <Button size="small" type="text" danger icon={<RiDeleteBinLine className="w-[17px] h-[17px]" />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            หมวดหมู่
          </Title>
          <Text type="secondary">ลากเพื่อจัดลำดับที่แสดงในแอป · ทั้งหมด {categories.length} หมวดหมู่</Text>
        </div>
        <Button type="primary" icon={<RiAddLine className="w-4 h-4" />} onClick={() => setEditing('new')}>
          เพิ่มหมวดหมู่
        </Button>
      </div>

      <DndTable<Category>
        items={categories}
        onReorder={onReorder}
        loading={loading}
        columns={columns}
        scroll={{ x: 420 }}
        style={{ background: '#fff', borderRadius: 12 }}
      />

      {editing ? (
        <CategoryModal
          category={editing === 'new' ? null : editing}
          defaultOrder={categories.length}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : null}
    </>
  );
}

function CategoryModal({
  category,
  defaultOrder,
  onClose,
  onSaved,
}: {
  category: Category | null;
  defaultOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      await upsertCategory({
        id: category?.id,
        name: v.name.trim(),
        display_order: category?.display_order ?? defaultOrder,
      });
      message.success(category ? 'บันทึกหมวดหมู่แล้ว' : 'เพิ่มหมวดหมู่แล้ว');
      onSaved();
    } catch (e) {
      message.error(apiError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={category ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'}
      onCancel={onClose}
      onOk={() => void submit()}
      okText="บันทึก"
      cancelText="ยกเลิก"
      confirmLoading={busy}
      destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false} initialValues={{ name: category?.name ?? '' }} className="mt-2">
        <Form.Item name="name" label="ชื่อหมวดหมู่" rules={[{ required: true, message: 'กรอกชื่อหมวดหมู่' }]}>
          <Input placeholder="เช่น ข้าวสาร" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
