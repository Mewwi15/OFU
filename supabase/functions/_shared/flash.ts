// Flash Express Open API client (shared). Signs requests with the merchant
// secret and posts form-urlencoded, per the Flash Open API v3 contract.
//
// Env: FLASH_BASE_URL (default prod), FLASH_MERCHANT_ID, FLASH_SECRET_KEY.
// Sandbox base is typically https://open-api-tra.flashexpress.com — set via env.
//
// SIGNATURE: sort all params (except `sign`, skip empty) by key ascending,
// join as "k1=v1&k2=v2...", append "&key=<secret>", SHA-256, uppercase hex.
// VERIFY the exact scheme + field names against your Flash merchant docs.

const BASE = Deno.env.get('FLASH_BASE_URL') ?? 'https://open-api.flashexpress.com';
const MCH_ID = Deno.env.get('FLASH_MERCHANT_ID') ?? '';
const SECRET = Deno.env.get('FLASH_SECRET_KEY') ?? '';

async function sha256Upper(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export async function flashSign(params: Record<string, string>, secret = SECRET): Promise<string> {
  const keys = Object.keys(params)
    .filter((k) => k !== 'sign' && params[k] !== '' && params[k] != null)
    .sort();
  const str = keys.map((k) => `${k}=${params[k]}`).join('&') + `&key=${secret}`;
  return sha256Upper(str);
}

export type FlashResponse = { code?: number; message?: string; data?: Record<string, unknown> };

/** Signed form-urlencoded POST to a Flash Open API endpoint. */
export async function flashPost(path: string, params: Record<string, string>): Promise<FlashResponse> {
  const body: Record<string, string> = {
    mchId: MCH_ID,
    nonceStr: crypto.randomUUID().replace(/-/g, ''),
    ...params,
  };
  body.sign = await flashSign(body);
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  return (await res.json().catch(() => ({}))) as FlashResponse;
}

/** Verify a webhook callback's signature. */
export async function verifyFlashSign(params: Record<string, string>): Promise<boolean> {
  const given = params.sign;
  if (!given) return false;
  return given.toUpperCase() === (await flashSign(params));
}
