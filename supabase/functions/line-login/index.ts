// line-login — completes the LINE Login OAuth flow for the web store.
// Deployed with --no-verify-jwt (the 'login' mode is called signed-out);
// 'link' mode authenticates the caller itself via the Authorization JWT.
//
//  { code, redirect_uri, mode: 'link' }  + user JWT
//     → exchange code, verify id_token, set app_users.line_user_id = sub
//  { code, redirect_uri, mode: 'login' }
//     → find-or-create the auth user for that LINE sub (synthetic email,
//       never mailed) and return a magiclink token_hash the client redeems
//       with verifyOtp for a real session.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LINE_LOGIN_CHANNEL_ID,
// LINE_LOGIN_CHANNEL_SECRET.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';
/** Synthetic mailbox domain for LINE-only accounts — nothing is ever sent. */
const LINE_EMAIL_DOMAIN = 'line.oofoo.app';

// Called from the browser (supabase.functions.invoke on ofu-shop.vercel.app)
// — must answer the CORS preflight and tag every response.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  const { code, redirect_uri, mode } = (await req.json().catch(() => ({}))) as {
    code?: string;
    redirect_uri?: string;
    mode?: 'link' | 'login';
  };
  if (!code || !redirect_uri || !mode) return json({ error: 'BAD_REQUEST' }, 400);

  // ── OAuth code → id_token → verified LINE profile ────────────────────────
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri,
      client_id: Deno.env.get('LINE_LOGIN_CHANNEL_ID')!,
      client_secret: Deno.env.get('LINE_LOGIN_CHANNEL_SECRET')!,
    }),
  });
  if (!tokenRes.ok) return json({ error: 'LINE_CODE_INVALID' }, 400);
  const { id_token } = (await tokenRes.json()) as { id_token?: string };
  if (!id_token) return json({ error: 'NO_ID_TOKEN' }, 400);

  const verifyRes = await fetch(VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      id_token,
      client_id: Deno.env.get('LINE_LOGIN_CHANNEL_ID')!,
    }),
  });
  if (!verifyRes.ok) return json({ error: 'LINE_TOKEN_INVALID' }, 401);
  const profile = (await verifyRes.json()) as { sub: string; name?: string; picture?: string };

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── link: attach this LINE to the signed-in customer ─────────────────────
  if (mode === 'link') {
    const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'UNAUTHENTICATED' }, 401);
    const { data: auth } = await admin.auth.getUser(jwt);
    if (!auth.user) return json({ error: 'UNAUTHENTICATED' }, 401);

    const { error } = await admin
      .from('app_users')
      .update({ line_user_id: profile.sub })
      .eq('id', auth.user.id);
    if (error) {
      // unique violation → this LINE is already on another account
      return json({ error: 'LINE_TAKEN' }, 409);
    }
    return json({ linked: true });
  }

  // ── login: find-or-create the account for this LINE sub ─────────────────
  const { data: existing } = await admin
    .from('app_users')
    .select('id')
    .eq('line_user_id', profile.sub)
    .maybeSingle();

  let userId = existing?.id as string | undefined;
  if (!userId) {
    const email = `line-${profile.sub.toLowerCase()}@${LINE_EMAIL_DOMAIN}`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        display_name: profile.name ?? '',
        avatar_url: profile.picture ?? '',
        line_user_id: profile.sub,
      },
    });
    if (createErr || !created.user) {
      // The auth user may exist from an earlier partial signup — reuse it.
      const { data: byMail } = await admin
        .from('app_users')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (!byMail) return json({ error: 'CREATE_FAILED' }, 500);
      userId = byMail.id as string;
    } else {
      userId = created.user.id;
    }
    await admin
      .from('app_users')
      .update({
        line_user_id: profile.sub,
        ...(profile.name ? { display_name: profile.name } : {}),
      })
      .eq('id', userId);
  }

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const email = authUser.user?.email;
  if (!email) return json({ error: 'NO_EMAIL' }, 500);

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr || !link.properties?.hashed_token) return json({ error: 'SESSION_FAILED' }, 500);

  return json({ token_hash: link.properties.hashed_token });
});
