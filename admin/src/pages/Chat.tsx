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

const { Text } = Typography;

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
  // Whether to keep the view pinned to the newest message. True while the user
  // is at/near the bottom; set false once they scroll up so a realtime refresh
  // (which re-sets `messages`) doesn't yank them back down mid-read.
  const stickBottom = useRef(true);
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
      stickBottom.current = true; // a freshly opened thread always starts at the newest
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
    // Only stick to the bottom if the user hasn't scrolled up to read history.
    if (stickBottom.current) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const onListScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

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
  const customerAvatar = (t: ChatThread) => t.customer?.avatar_path || undefined;

  return (
    <div className="flex flex-col lg:h-[calc(100vh-8.5rem)]">
      <div className="mb-3 shrink-0">
        <Text type="secondary">
          ตอบคำถามลูกค้าจากแอป · ลูกค้าได้รับแจ้งเตือนบนมือถือเมื่อร้านตอบ
        </Text>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 flex-1 min-h-0 lg:grid-rows-1">
        {/* Thread list */}
        <Card className="h-full min-h-0" styles={{ body: { padding: 0, height: '100%', overflowY: 'auto' } }}>
          {loading ? (
            <div className="p-6 text-center text-tremor-content">กำลังโหลด…</div>
          ) : threads.length === 0 ? (
            <div className="py-16">
              <Empty description="ยังไม่มีแชตจากลูกค้า" />
            </div>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => void openThread(t)}
                className="w-full flex items-center gap-3 text-left cursor-pointer hover:bg-[#FAFAFA] border-b border-[#E8E8E8]"
                style={{
                  padding: '10px 14px',
                  background: selected?.id === t.id ? '#F5F5F5' : undefined,
                }}>
                <Avatar src={customerAvatar(t)} style={{ background: '#5B8C6E', flex: 'none' }}>
                  {customerName(t).slice(0, 1).toUpperCase()}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-[#2B2320]">
                      {customerName(t)}
                    </span>
                    <span className="text-xs text-[#B7ACA5] shrink-0">
                      {threadTime(t.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="line-clamp-1 text-sm text-[#6E625C]">
                      {t.last_message_preview ?? ''}
                    </span>
                    {t.admin_unread > 0 ? (
                      <Badge count={t.admin_unread} size="small" style={{ flex: 'none' }} />
                    ) : null}
                  </div>
                </div>
              </button>
            ))
          )}
        </Card>

        {/* Conversation */}
        <Card
          className="h-full min-h-0"
          styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}>
          {!selected ? (
            <div className="flex-1 grid place-items-center py-20">
              <Empty description="เลือกแชตจากรายการด้านซ้าย" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#E8E8E8] shrink-0">
                <Avatar src={customerAvatar(selected)} size="small" style={{ background: '#5B8C6E', flex: 'none' }}>
                  {customerName(selected).slice(0, 1).toUpperCase()}
                </Avatar>
                <span className="font-semibold text-[#2B2320]">{customerName(selected)}</span>
              </div>

              <div
                ref={listRef}
                onScroll={onListScroll}
                className="flex-1 min-h-0 overflow-y-auto px-4 py-3 max-h-[60vh] lg:max-h-none">
                {messages.map((m, idx) => {
                  const mine = m.sender === 'admin';
                  // Group consecutive messages from the same sender — show the
                  // time only on the last of a run, so it isn't repeated on
                  // every bubble (owner: cluttered/บั๊ก).
                  const next = messages[idx + 1];
                  const endOfRun = !next || next.sender !== m.sender;
                  return (
                    <div
                      key={m.id}
                      className={`flex ${mine ? 'justify-end' : 'justify-start'} ${endOfRun ? 'mb-3' : 'mb-0.5'}`}>
                      <div className={`max-w-[75%] ${mine ? 'text-right' : 'text-left'}`}>
                        {m.imageUrl ? (
                          <Image src={m.imageUrl} alt="รูปภาพ" width={200} style={{ borderRadius: 0 }} />
                        ) : (
                          <div
                            className="inline-block px-3 py-2 rounded-none whitespace-pre-wrap break-words text-left"
                            style={
                              mine
                                ? { background: '#5B8C6E', color: '#fff' }
                                : { background: '#F5F5F5', color: '#2B2320' }
                            }>
                            {m.body}
                          </div>
                        )}
                        {endOfRun ? (
                          <div className="text-[10px] text-[#B7ACA5] mt-0.5">{timeLabel(m.created_at)}</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 px-3 py-3 border-t border-[#E8E8E8] shrink-0">
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
    </div>
  );
}
