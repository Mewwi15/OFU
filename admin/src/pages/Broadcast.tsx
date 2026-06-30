import { Select, SelectItem, Textarea, TextInput } from '@tremor/react';
import { RiCheckLine, RiMegaphoneLine } from '@remixicon/react';
import { useState } from 'react';

import { apiError, broadcastNotification, type BroadcastResult } from '../lib/api';

const CATEGORIES = [
  { value: 'promo', label: 'โปรโมชัน' },
  { value: 'shop', label: 'ประกาศร้าน' },
  { value: 'system', label: 'ระบบ' },
];

export function Broadcast() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('promo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BroadcastResult | null>(null);

  const send = async () => {
    if (!title.trim()) {
      setError('กรุณากรอกหัวข้อ');
      return;
    }
    if (!confirm('ส่งแจ้งเตือนนี้หาลูกค้าทุกคน?')) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await broadcastNotification({ title: title.trim(), body: body.trim() || undefined, category });
      setResult(r);
      setTitle('');
      setBody('');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">ส่งแจ้งเตือน</h1>
        <p className="text-sm text-gray-400 mt-0.5">ส่งโปรโมชันหรือประกาศ — เข้าฟีดในแอป + เด้งบนมือถือลูกค้าทุกคน</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-2xl">
        {result ? (
          <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-5">
            <RiCheckLine className="w-5 h-5 text-emerald-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-emerald-800">ส่งแล้ว</p>
              <p className="text-emerald-700 mt-0.5">
                เข้าฟีด {result.recipients} คน · ส่ง push {result.push} เครื่อง
              </p>
            </div>
          </div>
        ) : null}

        <div className="mb-4">
          <label className="text-xs text-gray-500 block mb-1">หัวข้อ</label>
          <TextInput value={title} onValueChange={setTitle} placeholder="เช่น ลด 10% วันนี้เท่านั้น!" />
        </div>
        <div className="mb-4">
          <label className="text-xs text-gray-500 block mb-1">ข้อความ</label>
          <Textarea value={body} onValueChange={setBody} rows={3} placeholder="รายละเอียดโปรโมชัน…" />
        </div>
        <div className="mb-5">
          <label className="text-xs text-gray-500 block mb-1">ประเภท</label>
          <Select value={category} onValueChange={setCategory} enableClear={false}>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </Select>
        </div>

        {error ? <p className="text-red-600 text-sm mb-3">{error}</p> : null}

        <button
          onClick={() => void send()}
          disabled={busy}
          className="flex items-center gap-1.5 bg-tremor-brand hover:bg-tremor-brand-emphasis text-white rounded-xl px-5 py-2.5 text-sm font-medium transition disabled:opacity-50">
          <RiMegaphoneLine className="w-4 h-4" />
          {busy ? 'กำลังส่ง…' : 'ส่งหาลูกค้าทุกคน'}
        </button>
      </div>
    </>
  );
}
