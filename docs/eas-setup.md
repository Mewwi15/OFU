# EAS setup — getting a real Android/iOS build that talks to the backend

Runbook for the owner. **No key values appear in this file** — every command
below is one you run yourself, and the values only ever exist on your machine and
on EAS's servers.

Project: `mewwi/my-rn-app` · app name **OFU** · bundle id / package
`com.oofoo.shop` (same on both platforms).

Verified against **eas-cli 21.0.1**.

---

## ⚠️ Read this first — there is no staging backend

Every environment (`development`, `preview`, `production`) points at the **same
Supabase project as the live shop**. That was a deliberate call, and it has a
sharp edge:

> **A test order placed from a preview or development build is a REAL order in
> the real shop.** It takes real stock, it shows up in the POS, and it lands in
> the owner's order list.

When testing a build:

- Prefer looking at screens over completing a checkout.
- If you must place one, cancel it in the admin afterwards — or, for an unpaid
  PromptPay order, let it expire: migration 0064 auto-cancels those past
  `shop_settings.payment_window_min` (currently 30 min) and returns the stock.
- **COD test orders do NOT auto-expire.** 0064 deliberately never touches COD, so
  those sit there as real work for the shop until cancelled by hand.

---

## What the app needs, and what breaks without it

| Variable | Used when | Missing ⇒ |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | inlined into the JS bundle at build | **app crashes on launch** |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | inlined into the JS bundle at build | **app crashes on launch** |
| `GOOGLE_MAPS_API_KEY` | **build time** — baked into AndroidManifest | build succeeds, **Android map blank** |
| `EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY` | inlined into the JS bundle at build | web map falls back to OpenStreetMap |

The important part: **a missing variable never fails the build.** It fails later,
on a device — which is why this has to be right up front rather than discovered
from a store review.

`EXPO_PUBLIC_*` values are readable by anyone who unzips the app; that is what the
prefix means. It is fine here — the Supabase anon key is public by design (RLS is
the real gate) and the Maps keys are protected by GCP restrictions. Keeping them
in EAS rather than git is about not leaving keys lying around in the repo, not
about hiding them from users.

---

## Step 1 — install the CLI and log in

`npx eas` does **not** work (there is no `eas` package — the binary comes from
`eas-cli`). Either install it globally:

```sh
npm install -g eas-cli
eas login
eas whoami        # expect: mewwi
```

…or prefix every command below with `npx eas-cli@latest` instead of `eas`.

## Step 2 — create the variables

`--environment` can be repeated, so each variable is **one** command covering all
three environments — four commands total.

```sh
eas env:create --name EXPO_PUBLIC_SUPABASE_URL \
  --value "<supabase project url>" --visibility plaintext \
  --environment development --environment preview --environment production

eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
  --value "<supabase anon key>" --visibility plaintext \
  --environment development --environment preview --environment production

eas env:create --name EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY \
  --value "<maps JS/web key>" --visibility plaintext \
  --environment development --environment preview --environment production

eas env:create --name GOOGLE_MAPS_API_KEY \
  --value "<android maps key>" --visibility sensitive \
  --environment development --environment preview --environment production
```

Prefer prompts? Just run `eas env:create` with no flags.
Fixing a value later: same command plus `--force`.

Check what landed:

```sh
eas env:list --environment production
eas env:list --environment production --include-sensitive   # reveals sensitive values
```

### Why `sensitive` and not `secret` for the Maps key

All three visibilities are available during a build. The difference:

- `plaintext` — shown in logs/dashboard, pullable with `eas env:pull`.
- `sensitive` — hidden in logs/UI, still pullable.
- `secret` — hidden and **cannot be read back at all**.

**Never make the `EXPO_PUBLIC_*` variables `secret`.** Secret values can't be used
to bundle JavaScript, so an `eas update` would ship a bundle with them missing —
that is the launch crash above, delivered over the air to people who already had
a working app.

`GOOGLE_MAPS_API_KEY` is native config, not JS, so `secret` would technically work
for it. `sensitive` is suggested only so you can still `eas env:pull` it for local
work. Either is defensible.

## Step 3 — local development (optional)

```sh
eas env:pull --environment development     # writes .env.local (gitignored)
```

`EXPO_PUBLIC_*` are inlined at bundle time, so **restart Metro with a clear cache
after changing them** or you keep running the old values:

```sh
npx expo start -c
```

## Step 4 — Android signing key → Google Cloud

The Android Maps key is restricted by package name **+ SHA-1 fingerprint**. A
build signed with a different key shows a **blank map** even though the key is
correct. Each build credential has its own fingerprint, so repeat this for every
new one (and note Play App Signing re-signs uploads with a *different* key —
that fingerprint must be added too).

```sh
eas credentials -p android
```

Pick the build profile, read the **SHA-1 certificate fingerprint**, then in Google
Cloud Console:

> APIs & Services → Credentials → the Android Maps key → Application restrictions
> → Android apps → **Add** package `com.oofoo.shop` + that SHA-1

See `docs/security-maps-key.md` for how the key is scoped.

## Step 5 — build

```sh
eas build --profile preview    --platform android   # APK, internal
eas build --profile production --platform android
eas build --profile production --platform ios
```

`eas.json` sets `cli.appVersionSource: "remote"`, so **EAS owns the version
counters**. iOS has no `buildNumber` in `app.json` on purpose: EAS initialises it
to 1 and `production.autoIncrement` takes it from there. Don't add one by hand —
that reintroduces exactly the two-sources-of-truth problem the remote counter
exists to prevent.

---

## If the build works but the app doesn't

| Symptom | Almost certainly |
|---|---|
| Crashes instantly on launch, never shows a screen | Supabase vars missing from that profile's environment |
| App fine, map area blank/grey (Android) | `GOOGLE_MAPS_API_KEY` missing at build, **or** SHA-1 not registered in GCP |
| Works, but data is wrong/absent | Pointed at the wrong Supabase project |

To see what a profile actually has, and what the native config will bake in:

```sh
eas env:list --environment preview
npx expo config --type public --json
```
