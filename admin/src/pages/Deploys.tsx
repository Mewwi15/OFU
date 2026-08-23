/**
 * Deploys — live view of the push→deploy pipeline (GitHub Actions), styled
 * after Vercel's deployments list, because that is literally what the owner
 * asked for: "หน้า monitor สำหรับดูว่ากำลังอัปเดตอยู่ เหมือนดูใน vercel".
 *
 * Every green row here means: web store deployed + OTA sent to both app
 * platforms. One row = one push.
 *
 * Data comes straight from GitHub's public REST API — the repo is public so
 * no token lives in this page. The unauthenticated limit is 60 requests/hour
 * per IP, which polling would blow through, so every request is conditional
 * (If-None-Match): GitHub serves 304s for free when nothing changed. Polling
 * also pauses while the tab is hidden.
 */

import { RiExternalLinkLine, RiGitBranchLine } from '@remixicon/react';
import { Alert, Badge, Card, Space, Spin, Table, Tag, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

const RUNS_URL =
  'https://api.github.com/repos/Mewwi15/OFU/actions/runs?per_page=12&event=push';
const ACTIVE_POLL_MS = 20_000; // a deploy is running — follow it closely
const IDLE_POLL_MS = 90_000; // nothing happening — just keep the page honest

type Run = {
  id: number;
  display_title: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: string | null;
  run_started_at: string;
  updated_at: string;
  html_url: string;
};

type JobRow = { name: string; status: string; conclusion: string | null };

const thTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const durationText = (run: Run) => {
  const end = run.status === 'completed' ? new Date(run.updated_at) : new Date();
  const s = Math.max(0, Math.round((end.getTime() - new Date(run.run_started_at).getTime()) / 1000));
  return s < 60 ? `${s} วิ` : `${Math.floor(s / 60)} นาที ${s % 60} วิ`;
};

function statusTag(run: Run) {
  if (run.status !== 'completed')
    return (
      <Tag color="processing" icon={<Spin size="small" style={{ marginRight: 6 }} />}>
        กำลังอัปเดต
      </Tag>
    );
  if (run.conclusion === 'success') return <Tag color="success">สำเร็จ</Tag>;
  if (run.conclusion === 'cancelled') return <Tag>ยกเลิก</Tag>;
  return <Tag color="error">ล้มเหลว</Tag>;
}

export function Deploys() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  // ETags make refreshes free: GitHub doesn't count 304s against the limit.
  const etags = useRef<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const fetchJson = useCallback(async <T,>(url: string): Promise<T | 'unchanged'> => {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(etags.current[url] ? { 'If-None-Match': etags.current[url] } : {}),
      },
    });
    if (res.status === 304) return 'unchanged';
    if (res.status === 403) throw new Error('rate');
    if (!res.ok) throw new Error(String(res.status));
    const tag = res.headers.get('etag');
    if (tag) etags.current[url] = tag;
    return (await res.json()) as T;
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson<{ workflow_runs: Run[] }>(RUNS_URL);
      let latest: Run | undefined;
      if (data !== 'unchanged') {
        setRuns(data.workflow_runs);
        setError(null);
        latest = data.workflow_runs[0];
      }
      // Job breakdown only for the newest run — that's the one being watched.
      if (latest) {
        const j = await fetchJson<{ jobs: JobRow[] }>(
          `https://api.github.com/repos/Mewwi15/OFU/actions/runs/${latest.id}/jobs`,
        );
        if (j !== 'unchanged') setJobs(j.jobs);
      }
    } catch (e) {
      setError(
        (e as Error).message === 'rate'
          ? 'GitHub จำกัดจำนวนครั้งที่ดูได้ต่อชั่วโมง — หน้าจะอัปเดตช้าลงชั่วคราว'
          : 'ดึงข้อมูลไม่สำเร็จ — จะลองใหม่อัตโนมัติ',
      );
    }
  }, [fetchJson]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (document.visibilityState === 'visible') await load();
      if (cancelled) return;
      const active = document.visibilityState === 'visible' && runsRef.current?.[0]?.status !== 'completed';
      timer.current = setTimeout(tick, active ? ACTIVE_POLL_MS : IDLE_POLL_MS);
    };
    void tick();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  // The poll callback needs the freshest runs without re-arming the effect.
  const runsRef = useRef<Run[] | null>(null);
  runsRef.current = runs;

  const latest = runs?.[0];
  const updating = latest && latest.status !== 'completed';

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* Banner: the one-glance answer to "มีอะไรกำลังอัปเดตไหม" */}
      <Card>
        {!runs ? (
          <Space>
            <Spin />
            <Typography.Text>กำลังโหลด…</Typography.Text>
          </Space>
        ) : updating ? (
          <Space size={12}>
            <Spin />
            <div>
              <Typography.Text strong style={{ fontSize: 16 }}>
                กำลังอัปเดตระบบ…
              </Typography.Text>
              <div>
                <Typography.Text type="secondary">
                  {latest.display_title} · เริ่ม {thTime(latest.run_started_at)} ·{' '}
                  {durationText(latest)}
                </Typography.Text>
              </div>
              <Space size={4} style={{ marginTop: 6 }} wrap>
                {jobs.map((j) => (
                  <Tag
                    key={j.name}
                    color={
                      j.status !== 'completed' ? 'processing'
                      : j.conclusion === 'success' ? 'success'
                      : 'error'
                    }>
                    {j.name}
                  </Tag>
                ))}
              </Space>
            </div>
          </Space>
        ) : (
          <Space size={12}>
            <Badge status={latest?.conclusion === 'success' ? 'success' : 'error'} />
            <div>
              <Typography.Text strong style={{ fontSize: 16 }}>
                {latest?.conclusion === 'success'
                  ? 'ระบบเป็นเวอร์ชันล่าสุด'
                  : 'รอบล่าสุดล้มเหลว'}
              </Typography.Text>
              <div>
                <Typography.Text type="secondary">
                  รอบล่าสุด: {latest ? `${latest.display_title} · ${thTime(latest.updated_at)}` : '-'}
                </Typography.Text>
              </div>
            </div>
          </Space>
        )}
      </Card>

      {error ? <Alert type="warning" showIcon message={error} /> : null}

      <Card title="ประวัติการอัปเดต" styles={{ body: { padding: 0 } }}>
        <Table<Run>
          rowKey="id"
          size="middle"
          pagination={false}
          dataSource={runs ?? []}
          loading={!runs}
          columns={[
            {
              title: 'สถานะ',
              width: 130,
              render: (_, r) => statusTag(r),
            },
            {
              title: 'รายการ',
              ellipsis: true,
              render: (_, r) => (
                <Space size={6}>
                  <RiGitBranchLine className="w-4 h-4" style={{ color: '#999', flex: 'none' }} />
                  <Typography.Text ellipsis style={{ maxWidth: 420 }}>
                    {r.display_title}
                  </Typography.Text>
                </Space>
              ),
            },
            { title: 'เวลา', width: 150, render: (_, r) => thTime(r.run_started_at) },
            { title: 'ใช้เวลา', width: 110, render: (_, r) => durationText(r) },
            {
              title: '',
              width: 60,
              render: (_, r) => (
                <a href={r.html_url} target="_blank" rel="noreferrer" aria-label="เปิดใน GitHub">
                  <RiExternalLinkLine className="w-4 h-4" />
                </a>
              ),
            },
          ]}
        />
      </Card>

      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        หนึ่งแถว = หนึ่งการอัปเดต ครอบทั้งเว็บร้านและแอปมือถือ (OTA) · สีเขียว =
        ของถึงเซิร์ฟเวอร์แล้ว ลูกค้าได้รับเมื่อเปิดแอปใหม่ · หน้านี้รีเฟรชตัวเอง
      </Typography.Text>
    </Space>
  );
}
