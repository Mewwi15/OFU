/**
 * พนักงาน — รายชื่อ + รหัสที่ใช้เปิด-ปิดรอบ (เจ้าของสั่ง 30 ส.ค. 2026)
 *
 * ก่อนหน้านี้ช่องรหัสพนักงานบนจอเปิดรอบเป็นช่องให้พิมพ์เฉย ๆ ใครพิมพ์อะไรก็ผ่าน
 * หน้านี้ทำให้รหัสมีเจ้าของจริง และ RPC เปิด/ปิดรอบจะปฏิเสธรหัสที่ไม่มีในลิสต์
 *
 * "พักงาน" กับ "ลบ" ต่างกันตรงประวัติ — รอบเก่าเก็บรหัสเป็นข้อความของตัวเอง
 * ลบคนออกประวัติจึงไม่หาย แต่ถ้าแค่หยุดพักชั่วคราวให้ปิดสวิตช์ไว้ ชื่อจะยังอยู่
 * ให้ประวัติแสดงได้
 */

import { RiAddLine, RiDeleteBin6Line } from '@remixicon/react';
import { Alert, Button, Card, Form, Input, Modal, Popconfirm, Switch, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../auth';
import { apiError, deleteStaff, listStaff, upsertStaff, type Staff as StaffRow } from '../lib/api';

const { Text } = Typography;

export function Staff() {
  const { profile } = useAuth();
  const isOwner = profile?.tier === 'owner';

  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StaffRow | 'new' | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listStaff()
      .then(setRows)
      .catch((e) => message.error(apiError(e)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const open = (row: StaffRow | 'new') => {
    setEditing(row);
    setCode(row === 'new' ? '' : row.code);
    setName(row === 'new' ? '' : row.name);
    setActive(row === 'new' ? true : row.active);
  };

  const save = async () => {
    setBusy(true);
    try {
      await upsertStaff({ id: editing === 'new' || !editing ? undefined : editing.id, code, name, active });
      setEditing(null);
      load();
      message.success('บันทึกแล้ว');
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: StaffRow) => {
    try {
      await deleteStaff(row.id);
      load();
      message.success(`ลบ ${row.name} แล้ว`);
    } catch (e) {
      message.error(apiError(e));
    }
  };

  const columns: ColumnsType<StaffRow> = [
    {
      title: 'รหัส', width: 110,
      render: (_, r) => (
        <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.code}</span>
      ),
    },
    { title: 'ชื่อ', render: (_, r) => <span style={{ fontSize: 15 }}>{r.name}</span> },
    {
      title: 'สถานะ', width: 120,
      render: (_, r) =>
        r.active ? <Tag color="green">ทำงานอยู่</Tag> : <Tag>พักงาน</Tag>,
    },
    {
      title: '', width: 150, align: 'right',
      render: (_, r) =>
        isOwner ? (
          <span className="flex justify-end gap-1">
            <Button size="small" onClick={() => open(r)}>แก้ไข</Button>
            <Popconfirm
              title={`ลบ ${r.name}?`}
              description="ประวัติรอบเก่ายังอยู่เหมือนเดิม"
              okText="ลบ" cancelText="ยกเลิก" okButtonProps={{ danger: true }}
              onConfirm={() => void remove(r)}
            >
              <Button size="small" danger icon={<RiDeleteBin6Line className="w-4 h-4" />} />
            </Popconfirm>
          </span>
        ) : null,
    },
  ];

  return (
    <>
      <div className="mb-4">
        <Text type="secondary">รหัสที่พนักงานใช้เปิด-ปิดรอบ และเปิดลิ้นชัก</Text>
      </div>

      {/* ยังไม่มีใครในลิสต์ = RPC ปล่อยผ่านทุกรหัส ต้องบอกให้เห็น ไม่ใช่ปล่อยให้
          เจ้าของเข้าใจว่ากันไว้แล้วทั้งที่ยังไม่ได้กัน (หลักเดียวกับรหัสหลังร้าน) */}
      {!loading && rows.length === 0 && (
        <Alert
          type="warning" showIcon className="mb-4"
          message="ยังไม่มีพนักงานในระบบ — ตอนนี้ใส่รหัสอะไรก็เปิดรอบได้"
          description="เพิ่มพนักงานอย่างน้อยหนึ่งคน แล้วระบบจะเริ่มปฏิเสธรหัสที่ไม่มีในลิสต์"
        />
      )}

      <Card
        title="พนักงาน"
        size="small"
        extra={
          isOwner && (
            <Button type="primary" icon={<RiAddLine className="w-4 h-4" />} onClick={() => open('new')}>
              เพิ่มพนักงาน
            </Button>
          )
        }
      >
        <Table rowKey="id" size="small" loading={loading} pagination={false} dataSource={rows} columns={columns} />
      </Card>

      <Modal
        open={editing !== null}
        title={editing === 'new' ? 'เพิ่มพนักงาน' : 'แก้ไขพนักงาน'}
        onCancel={() => setEditing(null)}
        okText="บันทึก" cancelText="ยกเลิก"
        okButtonProps={{ loading: busy, disabled: code === '' || name.trim() === '' }}
        onOk={() => void save()}
        destroyOnHidden
      >
        <Form layout="vertical" requiredMark={false}>
          <Form.Item label="รหัส (ตัวเลข)">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 20))}
              placeholder="เช่น 07"
              inputMode="numeric"
              autoFocus
              style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            />
          </Form.Item>
          <Form.Item label="ชื่อ">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น สมชาย" />
          </Form.Item>
          <Form.Item label="สถานะ" className="mb-0">
            <Switch checked={active} onChange={setActive} checkedChildren="ทำงานอยู่" unCheckedChildren="พักงาน" />
            <div className="text-xs text-gray-400 mt-1">พักงาน = ใช้รหัสนี้เปิดรอบไม่ได้ แต่ประวัติยังแสดงชื่อ</div>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
