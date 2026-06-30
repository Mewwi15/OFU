// send-sms-hook — Supabase "Send SMS Hook". GoTrue calls this to deliver phone
// OTPs; we forward them to a Thai SMS aggregator's HTTP API.
//
// Wiring (config.toml): [auth.hook.send_sms] enabled=true, uri points here,
// secret = env(SEND_SMS_HOOK_SECRET). The hook overrides the built-in provider,
// so disable [auth.sms.twilio] in production. [auth.sms.test_otp] still short-
// circuits the local test number before this hook is ever called.
//
// Env:
//   SEND_SMS_HOOK_SECRET  - the hook signing secret ("v1,whsec_…", from Supabase)
//   SMS_API_URL           - the aggregator's send endpoint
//   SMS_API_KEY           - the aggregator API key/token
//   SMS_SENDER            - the registered sender-ID (e.g. "OOFOO")

import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

const HOOK_SECRET = (Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '').replace('v1,whsec_', '');
const SMS_API_URL = Deno.env.get('SMS_API_URL') ?? '';
const SMS_API_KEY = Deno.env.get('SMS_API_KEY') ?? '';
const SMS_SENDER = Deno.env.get('SMS_SENDER') ?? 'OOFOO';

function fail(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: { message, http_code: status } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const raw = await req.text();

  // 1) Verify the request really came from GoTrue (signed with the hook secret).
  let phone: string;
  let otp: string;
  try {
    const wh = new Webhook(HOOK_SECRET);
    const { user, sms } = wh.verify(raw, Object.fromEntries(req.headers)) as {
      user: { phone: string };
      sms: { otp: string };
    };
    phone = user.phone; // E.164 without '+', e.g. "66812345678"
    otp = sms.otp;
  } catch (_e) {
    return fail('invalid hook signature', 401);
  }

  const message = `รหัส OTP อู้ฟู่ ของคุณคือ ${otp} (ใช้ได้ภายใน 5 นาที ห้ามบอกผู้อื่น)`;

  // 2) Hand off to the Thai aggregator. ── ADAPT THIS BLOCK to your provider's
  //    API docs (param names / auth scheme differ: Thaibulk, ANTS, SMSMKT, …).
  try {
    const res = await fetch(SMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SMS_API_KEY}`,
      },
      body: JSON.stringify({
        sender: SMS_SENDER,
        msisdn: phone, // some providers want a local "08…" — convert here if so
        message,
      }),
    });
    if (!res.ok) {
      return fail(`sms provider error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
  } catch (e) {
    return fail(`sms request failed: ${String(e)}`);
  }

  return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
});
