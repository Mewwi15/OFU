# Social login — setup (owner)

The app code is wired and ready; activating each provider only needs its keys.

## What's already in place (code)

- `lib/data/auth.ts → signInWithOAuthProvider('google' | 'apple')`: Supabase
  OAuth (PKCE) opened in an `expo-web-browser` auth session, then
  `exchangeCodeForSession`. Success flips the gate via the auth store's
  `onAuthStateChange`.
- Login screen: only the **Google** button is shown. **Apple was removed** (needs
  the paid Apple Developer Program) and **LINE was removed** (custom flow). The
  code still supports Apple (`signInWithOAuthProvider('apple')`) — re-add the
  button to enable it.
- Supabase client uses `flowType: 'pkce'`.
- Redirect URL `myrnapp://auth-callback` is allow-listed in `supabase/config.toml`
  (`auth.additional_redirect_urls`); app scheme is `myrnapp`.

## Google — enable

1. Google Cloud Console → **OAuth consent screen** + **Credentials → OAuth client
   IDs**. Create a **Web** client (Supabase uses the web client server-side) and,
   for native, the iOS/Android client IDs.
2. Authorized redirect URI (Web client):
   `https://<project-ref>.supabase.co/auth/v1/callback` (prod) /
   `http://127.0.0.1:54321/auth/v1/callback` (local).
3. **Local:** in `config.toml` set `[auth.external.google] enabled = true`,
   `client_id = "<web client id>"`, and export
   `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<web client secret>` before
   `supabase start`.
   **Prod:** Dashboard → Authentication → Providers → Google → paste client id +
   secret.

## Apple — removed (paid account; re-add later)

The Apple button was removed because Sign in with Apple needs the **Apple
Developer Program ($99/yr)**. The OAuth code path is still in place; to turn it
back on, re-add the Apple `SocialButton` in `app/login.tsx` and configure the
provider below.

### Apple — enable (when ready)

1. Apple Developer → an **App ID** with *Sign in with Apple*, a **Services ID**
   (the OAuth client_id), and a **Sign in with Apple key** (.p8) → build the
   client secret JWT.
2. `[auth.external.apple]` is already stubbed in `config.toml`: set
   `enabled = true`, `client_id = "<services id>"`, and
   `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET=<secret jwt>`. Prod: same in the Dashboard.
3. Redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
4. **iOS note:** the App Store prefers **native** Sign in with Apple
   (`expo-apple-authentication` → `supabase.auth.signInWithIdToken`) when other
   social logins are offered. The current web-OAuth path works; swapping iOS to
   native is a later refinement.

## LINE — removed (custom flow needed to re-add)

LINE is **not** a built-in Supabase OAuth provider, so the button was removed.
To add it back later, build one of:

- LINE Login (LIFF / OAuth) → an Edge Function that verifies LINE's id_token and
  mints a Supabase session (`auth.admin` + a custom token), or
- a third-party bridge (e.g. WorkOS) as the Supabase provider.

## After enabling

Rebuild the dev client if the scheme changed (it hasn't). Tap Google/Apple →
the provider sheet opens → on approval the app is signed in. New users are
provisioned by the `handle_new_auth_user` trigger (role customer, active).
