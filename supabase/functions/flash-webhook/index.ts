// flash-webhook — receives Flash Express tracking-status callbacks and applies
// them to the order (apply_flash_state RPC, 0016). Configure this function's URL
// as the notify/callback URL in your Flash merchant settings.
//
// Flash posts form-urlencoded with a `sign` we verify against FLASH_SECRET_KEY.
// VERIFY the exact payload field names (`pno`, `state`, `stateText`) + the state
// codes against your Flash merchant docs. See docs/flash-setup.md.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FLASH_SECRET_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

import { verifyFlashSign } from '../_shared/flash.ts';

Deno.serve(async (req) => {
  const raw = await req.text();
  // Flash sends application/x-www-form-urlencoded; fall back to JSON just in case.
  let params: Record<string, string>;
  if (raw.trim().startsWith('{')) {
    params = JSON.parse(raw);
  } else {
    params = Object.fromEntries(new URLSearchParams(raw));
  }

  if (!(await verifyFlashSign(params))) {
    return new Response('invalid signature', { status: 401 });
  }

  const pno = params.pno;
  const state = Number(params.state);
  const stateText = params.stateText ?? params.message ?? null;
  if (!pno || Number.isNaN(state)) {
    return new Response('bad payload', { status: 400 });
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  await sb.rpc('apply_flash_state', { p_pno: pno, p_state: state, p_state_text: stateText });

  // Flash expects a plain success acknowledgement.
  return new Response('success', { status: 200 });
});
