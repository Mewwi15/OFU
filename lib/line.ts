/**
 * LINE Login (web) — builds the OAuth redirect for the two flows the shop
 * uses: linking a logged-in customer's LINE (order notifications) and
 * signing in with LINE. The callback lands on /line-callback, which hands
 * the code to the line-login Edge Function. Web-only: the redirect flow
 * needs a browser origin (native would use the LINE SDK — not built yet).
 *
 * bot_prompt=aggressive shows the "add OUF@official as friend" step inside
 * the consent screen — required for the OA to be able to push messages.
 */

export type LineAuthMode = 'link' | 'login';

const LINE_LOGIN_CHANNEL_ID = '2010688920'; // public (visible in the auth URL)
const AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize';
export const LINE_STATE_KEY = 'oofoo-line-state';

export function startLineAuth(mode: LineAuthMode): void {
  const state = `${mode}:${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  sessionStorage.setItem(LINE_STATE_KEY, state);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINE_LOGIN_CHANNEL_ID,
    redirect_uri: `${window.location.origin}/line-callback`,
    state,
    scope: 'profile openid',
    bot_prompt: 'aggressive',
  });
  window.location.href = `${AUTHORIZE_URL}?${params}`;
}
