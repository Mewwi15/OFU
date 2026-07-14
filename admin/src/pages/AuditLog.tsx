import { RiHistoryLine } from '@remixicon/react';
import { App, Button, Result, Select, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';

import { useAuth } from '../auth';
import { apiError, listAuditLog, type AuditLogEntry } from '../lib/api';

const { Title, Text } = Typography;

const ROLE_LABEL: Record<string, string> = { admin: 'แอดมิน', customer: 'ลูกค้า', rider: 'ไรเดอร์' };
const TIER_LABEL: Record<string, string> = { owner: 'เจ้าของร้าน', staff: 'พนักงาน' };

/** ประวัติแก้ไข — owner-only read of audit_log (RLS: audit_owner policy,
 * 0003_rls.sql). write_audit() has recorded every admin RPC mutation since
 * 0006; this page is simply the first place anyone can read it back. */
export function AuditLog() {
  const { profile } = useAuth();
  const { message } = App.useApp();
  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [moreLeft, setMoreLeft] = useState(true);
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const isOwner = profile?.tier === 'owner';

  async function load() {
    setLoading(true);
    try {
      const r = await listAuditLog(100);
      setRows(r);
      setMoreLeft(r.length === 100);
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (isOwner) void load();
    else setLoading(false);
    // mount-only fetch; load isn't memoized so listing it would refetch every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  const loadMore = async () => {
    const last = rows[rows.length - 1];
    if (!last) return;
    setLoading(true);
    try {
      const r = await listAuditLog(100, { created_at: last.created_at, id: last.id });
      setRows((prev) => [...prev, ...r]);
      setMoreLeft(r.length === 100);
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  if (!isOwner) {
    return (
      <Result
        status="403"
        title="เฉพาะเจ้าของร้าน"
        subTitle="ประวัติแก้ไขเห็นได้เฉพาะเจ้าของร้านเท่านั้น"
      />
    );
  }

  const actions = [...new Set(rows.map((r) => r.action))].sort();
  const shown = actionFilter ? rows.filter((r) => r.action === actionFilter) : rows;

  const columns: ColumnsType<AuditLogEntry> = [
    {
      title: 'เวลา',
      key: 'time',
      width: 150,
      render: (_, r) => (
        <span className="text-sm text-gray-500">{new Date(r.created_at).toLocaleString('th-TH')}</span>
      ),
    },
    {
      title: 'ผู้ทำรายการ',
      key: 'actor',
      width: 180,
      render: (_, r) => (
        <div>
          <div className="text-[#2B2320]">{r.app_users?.display_name ?? '—'}</div>
          <Text type="secondary" className="text-xs">
            {ROLE_LABEL[r.actor_role] ?? r.actor_role}
            {r.actor_tier ? ` · ${TIER_LABEL[r.actor_tier] ?? r.actor_tier}` : ''}
          </Text>
        </div>
      ),
    },
    {
      title: 'การกระทำ',
      dataIndex: 'action',
      key: 'action',
      width: 180,
      render: (v: string) => (
        <Tag className="font-mono text-xs" bordered={false}>
          {v}
        </Tag>
      ),
    },
    {
      title: 'เป้าหมาย',
      key: 'target',
      width: 160,
      render: (_, r) =>
        r.target_table ? (
          <span className="text-xs text-gray-500">
            {r.target_table}
            {r.target_id ? ` · ${r.target_id.slice(0, 8)}…` : ''}
          </span>
        ) : (
          '—'
        ),
    },
    {
      title: 'รายละเอียด',
      key: 'summary',
      render: (_, r) => (
        <div>
          <div>{r.summary ?? '—'}</div>
          {r.reason && (
            <Text type="secondary" className="text-xs">
              เหตุผล: {r.reason}
            </Text>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            ประวัติแก้ไข
          </Title>
          <Text type="secondary">รายการที่แอดมิน/พนักงานแก้ไขในระบบ · เรียงล่าสุดก่อน</Text>
        </div>
        <Select
          allowClear
          placeholder="ทุกการกระทำ"
          style={{ width: 220 }}
          value={actionFilter}
          onChange={setActionFilter}
          options={actions.map((a) => ({ value: a, label: a }))}
        />
      </div>

      <Table<AuditLogEntry>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={shown}
        pagination={false}
        scroll={{ x: 900 }}
        style={{ background: '#fff', borderRadius: 12 }}
      />

      {moreLeft && !actionFilter && (
        <div className="flex justify-center mt-4">
          <Button icon={<RiHistoryLine className="w-4 h-4" />} onClick={() => void loadMore()} loading={loading}>
            โหลดเพิ่ม
          </Button>
        </div>
      )}
    </>
  );
}
