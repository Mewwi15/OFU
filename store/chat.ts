/**
 * Rider-chat store (zustand).
 *
 * A seeded customer ↔ rider conversation for the tracking chat screen. `send`
 * appends a customer message. Frontend-first: replies are static today and will
 * come over realtime once the backend lands.
 */

import { create } from 'zustand';

export type ChatMessage = {
  id: string;
  /** 'me' = customer (coral, right), 'rider' = rider (grey, left). */
  from: 'me' | 'rider';
  text: string;
  time: string;
};

const SEED: ChatMessage[] = [
  { id: 'm1', from: 'me', text: 'สวัสดีครับ', time: '08:30' },
  { id: 'm2', from: 'me', text: 'ของผมกำลังมาส่งไหมครับ', time: '08:30' },
  {
    id: 'm3',
    from: 'rider',
    text: 'สวัสดีครับ ผมเพิ่งรับของจากร้านอู้ฟู่มาครับ',
    time: '08:32',
  },
  { id: 'm4', from: 'me', text: 'เยี่ยมเลยครับ อีกประมาณกี่นาทีถึงครับ', time: '08:32' },
  { id: 'm5', from: 'rider', text: 'ประมาณ 15 นาทีถึงครับ', time: '08:32' },
];

let seq = 100;

/** Canned rider replies, cycled so the demo conversation feels alive. */
const CANNED_REPLIES = [
  'รับทราบครับ',
  'กำลังไปครับ อีกประมาณ 10 นาที',
  'ถึงปากซอยแล้วครับ',
  'ขอบคุณครับ เดี๋ยวถึงแล้วโทรหานะครับ',
];
let replyIdx = 0;

/** Current HH:MM, zero-padded. */
function nowLabel(): string {
  const d = new Date();
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

export type ChatState = {
  messages: ChatMessage[];
  send: (text: string) => void;
  /** Append the next canned rider reply (used after a "typing" delay). */
  riderReply: () => void;
};

export const useChat = create<ChatState>((set) => ({
  messages: SEED,
  send: (text) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { id: `m${++seq}`, from: 'me', text, time: nowLabel() },
      ],
    })),
  riderReply: () =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: `m${++seq}`,
          from: 'rider',
          text: CANNED_REPLIES[replyIdx++ % CANNED_REPLIES.length],
          time: nowLabel(),
        },
      ],
    })),
}));
