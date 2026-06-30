# Phone OTP — real SMS via a Thai aggregator (owner)

Phone login is fully wired. Locally it uses the test number
**`0812345678` → OTP `123456`** (no SMS sent). To send real OTPs to any number you
need a Thai SMS aggregator account — there's no free tier, every SMS costs money.

## What's already in place (code)

- `supabase/functions/send-sms-hook/index.ts` — a Supabase **Send SMS Hook**:
  verifies GoTrue's signed request, builds the Thai OTP message, and POSTs it to
  the aggregator. The provider call is one clearly-marked block to adapt.
- `config.toml` has a commented `[auth.hook.send_sms]` block + the local
  `[auth.sms.test_otp]` and dummy `[auth.sms.twilio]` (so the test number works
  offline).

## Steps (owner)

### 1. Pick + sign up for a Thai aggregator
e.g. **Thaibulk SMS**, **ANTS**, **SMSMKT**, **MoveMe**. Create an account, top up
credit, and get the **API endpoint + API key/token**.

### 2. Register a Sender-ID (longest lead time)
Apply for an alphanumeric sender name (e.g. `OOFOO`). Thai carriers require
registration + approval — start this early; it can take days–weeks.

### 3. Adapt the provider call
In `send-sms-hook/index.ts`, edit the block marked **"ADAPT THIS BLOCK"** to match
your provider's API (param names / auth scheme differ — check their docs). Some
providers want the phone as local `08…` rather than `66…` — convert there.

### 4. Set the secrets (never commit)
On the cloud project:
```
SEND_SMS_HOOK_SECRET   # generate in Supabase → Auth → Hooks (format v1,whsec_…)
SMS_API_URL            # the aggregator send endpoint
SMS_API_KEY            # the aggregator API key/token
SMS_SENDER             # your approved sender-ID, e.g. OOFOO
```
Set them as Edge Function secrets (`supabase secrets set …`) and in the auth hook
config.

### 5. Deploy + enable
1. `supabase functions deploy send-sms-hook`
2. In `config.toml` (or the Dashboard → Auth → Hooks): **enable** `[auth.hook.send_sms]`
   pointing at the deployed function, and **disable** `[auth.sms.twilio]`.
3. Apply: Dashboard saves immediately; locally `supabase stop && supabase start`.

### 6. Test
Request an OTP for a real number from the app → you should receive the SMS from
your sender-ID. Keep `[auth.sms.test_otp]` for the dev number — it short-circuits
before the hook, so local testing stays free.

## Notes

- The hook **overrides** the built-in provider, so only one of (twilio | hook)
  should be active in production — use the hook.
- Rate limiting: `[auth.sms] max_frequency` (currently 5s) throttles resend abuse.
- Cost control: keep OTP length/expiry sane and rely on `max_frequency` +
  Supabase's per-hour SMS rate limits.
