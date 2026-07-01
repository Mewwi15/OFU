# Flash Express — real parcel tracking (owner)

The whole flow is code-ready. Turning it on needs a **Flash merchant account +
API key** (business registration with Flash Express — like a sender-ID, it takes
time to approve).

## How it works (once the key is in)

```
online order confirmed
  → trg_dispatch_flash (pg_net) → create-flash-shipment fn
      → Flash Open API "create order" → pno (tracking no)
      → record_flash_shipment RPC → parcel_shipments.tracking_no
Flash parcel moves
  → Flash posts to flash-webhook fn (your callback URL)
      → apply_flash_state RPC → parcel_shipments + orders.order_status
      → notify_order_status (0011) notifies the customer + Realtime
      → the app's ParcelTrackingView shows the live timeline
```

**The app side needs nothing more** — ParcelTrackingView already reads
`parcel_shipments` (tracking_no) and follows `order_status` live.

## What's built

- `supabase/migrations/0016_flash.sql` — `record_flash_shipment`,
  `apply_flash_state` (Flash state 1–9 → order_status), and the `dispatch_flash`
  trigger (env-portable pg_net; no-ops until configured).
- `supabase/functions/_shared/flash.ts` — signed Flash API client (SHA-256 sign).
- `supabase/functions/create-flash-shipment` — creates the parcel.
- `supabase/functions/flash-webhook` — receives status callbacks.

Validated locally (without the key) end-to-end: record a pno → feed states 2/5/6
→ order advances preparing → picked_up → out_for_delivery → delivered, timestamps
stamp, and the customer is notified on each change.

## Owner steps

1. **Register** as a Flash Express merchant; get `merchant id` + `secret key`.
2. **Register a pickup warehouse** with Flash → note its `warehouseNo` (the sender).
3. **Set the webhook/notify URL** in the Flash merchant portal to:
   `https://<project-ref>.supabase.co/functions/v1/flash-webhook`
4. **Deploy** the functions: `supabase functions deploy create-flash-shipment flash-webhook`
5. **Set secrets** (`supabase secrets set …` + the DB settings for pg_net):
   ```
   FLASH_BASE_URL           # prod or the sandbox base
   FLASH_MERCHANT_ID
   FLASH_SECRET_KEY
   FLASH_WAREHOUSE_NO
   FLASH_EXPRESS_CATEGORY   # 1 Normal … 5 Fruit (ของสด)
   FLASH_ARTICLE_CATEGORY
   FLASH_DEFAULT_WEIGHT_G   # until real product weights exist
   ```
   plus (once, so the trigger can reach the function):
   `alter database postgres set app.functions_url = 'https://<ref>.supabase.co/functions/v1';`
   `alter database postgres set app.service_role_key = '<service_role_key>';`

## ⚠️ Verify against your Flash docs (numbering can differ per contract)

- **Signature** scheme (param sort + `&key=` + SHA-256 uppercase).
- **Create-order** endpoint path (`/open/v3/orders`) + parameter names
  (`dstProvinceName`/`dstCityName`/`dstDistrictName`/`dstPostalCode`, `weight` in
  grams, `expressCategory`/`articleCategory` codes).
- **COD amount unit** — the code sends satang (baht×100); confirm baht vs satang.
- **Webhook** payload field names (`pno`, `state`, `stateText`) and the **state
  codes 1–9** → adjust the `apply_flash_state` CASE in 0016 if they differ:
  `1 preparing · 2 picked_up · 3/4 in_transit · 5 out_for_delivery · 6 delivered ·
  7 delivery_failed · 8 returned · 9 cancelled`.

Start the merchant registration early — the code is ready to plug the key in.
