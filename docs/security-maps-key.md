# Google Maps API key — exposure & remediation

## Status (current)

- ✅ The key is **no longer in any tracked file**. `app.config.js` injects it from
  `process.env.GOOGLE_MAPS_API_KEY`, which is read from `.env.local` (gitignored).
- ✅ `.env.local` is **not** tracked; only `.env.example` (empty placeholder) is.
- ⚠️ The key **still exists in git history** — it was committed inside `app.json`
  in two early commits:
  - `7371e0f` feat: delivery address + map picker …
  - `4464c7e` feat: อู้ฟู่ frontend-first build …

Anyone with read access to the repo (or a clone/fork) can recover the key from
history. Removing it from the working tree does **not** remove it from history.

## Do this now (≈5 min, owner) — neutralize the leaked key *without* rotating

An Android Maps SDK key can be locked to your app, so the leaked value becomes
useless to anyone else. In **Google Cloud Console → APIs & Services →
Credentials → (the key)**:

1. **Application restrictions → Android apps.** Add an entry:
   - Package name: `com.oofoo.shop` (renamed 2026-07 for the store release; the
     pre-rename dev builds used `com.anonymous.myrnapp` — keep both entries
     while old dev installs are still around)
   - SHA-1 certificate fingerprint: see below.
2. **API restrictions → Restrict key →** select **Maps SDK for Android** only.
3. Save.

After this, the key only works when called from *your* signed app. A copy pulled
from git history can't be used elsewhere → the practical risk drops to near zero,
with no key rotation and no history rewrite.

### Getting the SHA-1 fingerprint

- Local debug build:
  ```sh
  keytool -list -v -keystore ~/.android/debug.keystore \
    -alias androiddebugkey -storepass android -keypass android | grep SHA1
  ```
- EAS / release builds (the signing cert EAS manages):
  ```sh
  eas credentials   # Android → view the keystore's SHA-1
  ```
  Add **every** SHA-1 you ship with (debug + release/Play App Signing).

## Do this at go-live (owner) — rotate

1. Create a **new** key in Google Cloud, restrict it the same way (package +
   SHA-1 + Maps SDK for Android).
2. Put it in `.env.local` (`GOOGLE_MAPS_API_KEY=…`) and in the cloud build secret
   (EAS secret / CI env), then rebuild the Android client.
3. **Delete** the old key. Once deleted, the value in git history is dead.

## Why we don't purge git history

Rewriting history (`git filter-repo` / BFG) changes every commit hash after the
leak, which breaks existing clones, forks, and any open PRs, and must be
force-pushed. Because an Android key can be fully neutralized by restriction +
rotation (above), that is the standard, lower-risk fix. Only consider a history
purge if the key were unrestrictable (e.g. a server secret).

## Guardrails already in place

- `app.config.js` reads the key from the environment — it can't be hardcoded
  back into `app.json` by accident for the native config.
- `.gitignore` ignores `.env*.local`.
- iOS uses Apple Maps (no key needed), so only the Android key is in scope.
