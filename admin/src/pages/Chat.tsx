import { RiImageAddLine, RiSendPlaneFill } from '@remixicon/react';
import { App, Avatar, Badge, Button, Card, Empty, Image, Input, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiError } from '../lib/api';
import {
  listMessages,
  listThreads,
  markRead,
  sendImage,
  sendText,
  subscribeChatActivity,
  type ChatMessage,
  type ChatThread,
} from '../lib/chat';

const { Title, Text } = Typography;

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

function threadTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? timeLabel(iso) : dayLabel(iso);
}

export function Chat() {
  const { message } = App.useApp();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // The realtime callback needs the CURRENT selection without resubscribing.
  const selectedRef = useRef<ChatThread | null>(null);
  selectedRef.current = selected;

  const loadThreads = useCallback(async () => {
    try {
      setThreads(await listThreads());
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setLoading(false);
    }
  }, [message]);

  const openThread = useCallback(
    async (t: ChatThread) => {
      setSelected(t);
      try {
        setMessages(await listMessages(t.id));
        await markRead(t.id);
        setThreads((prev) => prev.map((x) => (x.id === t.id ? { ...x, admin_unread: 0 } : x)));
      } catch (e) {
        message.error(apiError(e));
      }
    },
    [message],
  );

  useEffect(() => {
    void loadThreads();
    const unsub = subscribeChatActivity(() => {
      void loadThreads();
      const cur = selectedRef.current;
      if (cur) {
        void listMessages(cur.id).then(setMessages);
        void markRead(cur.id);
      }
    });
    return unsub;
  }, [loadThreads]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const onSend = async () => {
    const text = draft.trim();
    if (!text || !selected || busy) return;
    setBusy(true);
    setDraft('');
    try {
      await sendText(selected.id, text);
      setMessages(await listMessages(selected.id));
    } catch (e) {
      setDraft(text);
      message.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onPickImage = async (file: File) => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await sendImage(selected.id, selected.user_id, file);
      setMessages(await listMessages(selected.id));
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const customerName = (t: ChatThread) => t.customer?.display_name || 'ลูกค้า';

  return (
    <>
      <div className="mb-4">
        <Title level={3} style={{ margin: 0 }}>
          แชตลูกค้า
        </Title>
        <Text type="secondary">
          ตอบคำถามลูกค้าจากแอป · ลูกค้าได้รับแจ้งเตือนบนมือถือเมื่อร้านตอบ
        </Text>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4" style={{ minHeight: 520 }}>
        {/* Thread list */}
        <Card styles={{ body: { padding: 0 } }}>
          {loading ? (
            <Card loading variant="borderless" />
          ) : threads.length === 0 ? (
            <div className="py-16">
              <Empty description="ยังไม่มีแชตจากลูกค้า" />
            </div>
          ) : (
            <div>
              {threads.map((t) => (
                <button
                  key={t.id}
                  onClick={() => void openThread(t)}
                  className="w-full flex items-center gap-3 text-left cursor-pointer hover:bg-[#FAFAFA] border-b border-[#E8E8E8]"
                  style={{
                    padding: '10px 14px',
                    background: selected?.id === t.id ? '#F5F5F5' : undefined,
                  }}>
                  <Badge count={t.admin_unread} size="small">
                    <Avatar style={{ background: '#5B8C6E' }}>
                      {customerName(t).slice(0, 1).toUpperCase()}
                    </Avatar>
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-[#2B2320]">
                        {customerName(t)}
                      </span>
                      <span className="text-xs text-[#B7ACA5] shrink-0">
                        {threadTime(t.last_message_at)}
                      </span>
                    </div>
                    <div className="line-clamp-1 text-sm text-[#6E625C]">
                      {t.last_message_preview ?? ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Conversation */}
        <Card
          styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}>
          {!selected ? (
            <div className="flex-1 grid place-items-center py-20">
              <Empty description="เลือกแชตจากรายการด้านซ้าย" />
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-[#E8E8E8] font-semibold text-[#2B2320]">
                {customerName(selected)}
              </div>

              <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2" style={{ maxHeight: 480 }}>
                {messages.map((m) => {
                  const mine = m.sender === 'admin';
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] ${mine ? 'text-right' : 'text-left'}`}>
                        {m.imageUrl ? (
                          <Image
                            src={m.imageUrl}
                            alt="รูปภาพ"
                            width={200}
                            style={{ borderRadius: 0 }}
                          />
                        ) : (
                          <div
                            className="inline-block px-3 py-2 rounded-none whitespace-pre-wrap break-words text-left"
                            style={
                              mine
                                ? { background: '#5B8C6E', color: '#fff', borderBottomRightRadius: 4 }
                                : { background: '#F5F5F5', color: '#2B2320', borderBottomLeftRadius: 4 }
                            }>
                            {m.body}
                          </div>
                        )}
                        <div className="text-[10px] text-[#B7ACA5] mt-0.5">{timeLabel(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 px-3 py-3 border-t border-[#E8E8E8]">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void onPickImage(f);
                  }}
                />
                <Button
                  icon={<RiImageAddLine className="w-4 h-4" />}
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                  title="แนบรูปภาพ"
                />
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onPressEnter={() => void onSend()}
                  placeholder="พิมพ์ข้อความ…"
                  disabled={busy}
                />
                <Button
                  type="primary"
                  icon={<RiSendPlaneFill className="w-4 h-4" />}
                  loading={busy}
                  disabled={!draft.trim()}
                  onClick={() => void onSend()}>
                  ส่ง
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
