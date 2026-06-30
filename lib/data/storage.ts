/**
 * Storage repository — uploads to Supabase Storage.
 *
 * The image picker hands us a base64 string; we decode it to bytes and upload
 * the raw bytes (a Uint8Array — avoids the React Native fetch/Blob upload gotcha
 * where a file:// Blob uploads as 0 bytes).
 */

import { supabase } from '@/lib/supabase/client';

const LOOKUP = (() => {
  const t = new Uint8Array(256).fill(255);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < chars.length; i++) t[chars.charCodeAt(i)] = i;
  return t;
})();

/** Decode a standard base64 string to bytes (ignores whitespace/padding). */
export function base64ToBytes(b64: string): Uint8Array {
  let len = b64.length;
  while (len > 0 && b64[len - 1] === '=') len--;
  const out = new Uint8Array((len * 3) >> 2);
  let o = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < len; i++) {
    const v = LOOKUP[b64.charCodeAt(i)];
    if (v === 255) continue; // skip non-base64 chars (newlines etc.)
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  return o === out.length ? out : out.subarray(0, o);
}

/**
 * Upload a payment slip (base64 JPEG from the image picker) for an order.
 * Returns the storage path recorded via attach_payment_slip.
 */
export async function uploadSlip(orderId: string, base64: string): Promise<string> {
  const path = `${orderId}.jpg`;
  const { error } = await supabase.storage
    .from('payment-slips')
    .upload(path, base64ToBytes(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  return path;
}

/**
 * Upload the signed-in user's profile photo (base64 JPEG) to the public avatars
 * bucket (keyed by uid). Returns a cache-busted public URL to store + display.
 */
export async function uploadAvatar(base64: string): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('UNAUTHENTICATED');
  const path = `${u.user.id}.jpg`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, base64ToBytes(base64), { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
