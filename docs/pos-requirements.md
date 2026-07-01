# อู้ฟู่ POS + Admin — Requirements (v1 draft)

The admin web becomes a **unified POS + back-office**: sell on-site (หน้าร้าน) and
manage online orders from one app, over **one shared backend and one shared
inventory** (an on-site sale decrements the same stock as online).

## Locked decisions (from requirements session)

| # | Decision | Impact |
|---|---|---|
| 1 | **Offline-first POS** — the sell screen must keep working if the internet drops (record locally, sync when back online) | Local-first architecture; biggest technical driver |
| 2 | On-site payments: **cash + change**, **PromptPay QR**, **coupon / store credit** (no card/EDC in v1) | Checkout flow + store-credit ledger |
| 3 | Hardware: **barcode scanner** + **thermal receipt printer** (no cash drawer) | Barcode field on products; ESC/POS printing |
| 4 | **VAT-registered — issue tax invoices** (ใบกำกับภาษี) | VAT 7% pricing + tax-invoice numbering + receipt format |

---

## Modules & functional requirements

### 1. POS — Sell screen (on-site, offline-first)
- Add items by **barcode scan** (scanner = keyboard input → auto-add) or tap a
  category product grid or search.
- Cart: qty edit, per-line + whole-bill **discount**, apply **coupon**.
- **Park / hold** multiple bills; resume; void a bill.
- Checkout with **cash** (enter tendered → compute change), **PromptPay QR**
  (render QR for the exact amount → mark paid), **store credit / coupon**.
- Split payment (cash + QR) — *to confirm*.
- Print **abbreviated tax invoice** (ใบกำกับภาษีอย่างย่อ) by default; option for a
  **full tax invoice** (ใบกำกับภาษีเต็มรูป) capturing the customer's name + tax id.
- **Returns / refunds** of a prior sale (restock + refund/credit).
- Works fully **offline**: catalog, prices, stock cached locally; sales queued and
  synced on reconnect.

### 2. Shift / cash management (no drawer hardware)
- Open shift (opening cash float), close shift (counted cash vs expected).
- Per-shift summary: sales by payment method, cash in/out, over/short.

### 3. Online order management (extend what exists)
- Orders list, **slip review / payment approval**, order state machine,
  delivery + Flash parcel. (backend 0007 + Flash 0016 already built)

### 4. Inventory / catalog (shared — core)
- Products / variants / categories / price, **barcode**, VAT flag.
- **One shared stock** decremented by both on-site sales and online orders.
- Receive stock / adjust / low-stock alerts / movement history (stock_movements
  already exists — add on-site sale as a movement reason).
- Offline caveat: on-site sales may briefly oversell the last unit → **reconcile
  on sync** (server is source of truth; flag negatives).

### 5. Reports / dashboard
- Daily/monthly sales, **split by channel (on-site vs online)**, top products,
  gross margin, cash summary, VAT summary (output tax).

### 6. Staff / roles
- Staff accounts: **cashier** vs **admin/owner**; permissions (who can void,
  refund, discount, see reports, edit products).
- Action log / audit (audit_log exists).

### 7. Customers / members (optional v1)
- Store-credit wallet (needed for the "store credit" payment).
- Optional membership + points; link on-site customer ↔ online account. *(scope?)*

### 8. Settings
- Shop / VAT (tax id, rate 7%, branch, **price includes VAT** y/n), receipt/tax-
  invoice header + running number, payment methods, printer, barcode.

---

## Non-functional / technical

- **Offline-first**: local store (e.g. IndexedDB) caches catalog + prices + stock;
  sales recorded locally with a durable queue; background sync to Supabase;
  idempotent sync (client_op_id) so retries don't double-post. Conflict policy for
  stock = server authoritative, oversell flagged.
- **Barcode**: USB/BT scanners emulate a keyboard → capture into the sell input.
- **Thermal printer**: ESC/POS via WebUSB/WebSerial (Chrome) or a small local
  print agent; browser print-to-58/80mm template as fallback. *(method to confirm)*
- **VAT**: Thai retail prices are usually **VAT-inclusive**; receipt shows
  pre-VAT, VAT 7%, total; tax-invoice number is a gapless per-shop sequence.
- Same Supabase project/RLS; POS runs as a `cashier`/`admin` role.
- Deploys on Vercel (admin) — offline needs a PWA/service worker.

## Data model additions (high level, for the design phase)
- `product_variants.barcode`
- `shop_settings`: vat fields (registered, tax_id, rate, branch_code, price_incl_vat)
- **on-site sales**: either `orders.channel = 'onsite'` or a dedicated
  `pos_sales` + `pos_sale_items` (decide in design)
- `store_credit_ledger` (wallet) for store-credit payment
- `pos_shifts` (open/close, float, counts)
- tax-invoice / receipt number sequence(s)
- new `stock_movements` reason: `pos_sale` / `pos_refund`

## Decisions (confirmed)
1. ✅ **Single shop** for v1.
2. ✅ **No members/loyalty** in v1 — just the **store-credit wallet** (for the
   store-credit payment method).
3. ✅ **No split payment** in v1 (one payment method per sale) — split → P3.
4. ✅ **Prices are VAT-inclusive** (Thai retail); receipts back out the 7% VAT.
5. ⏳ Thermal printer model — owner to check. **Not blocking P1**: P1 prints a
   58/80mm receipt template via the browser; native ESC/POS integration → P3.
6. ⏳ Do products have barcodes — owner to check. **Not blocking P1**: add a
   `barcode` field now; the scanner reads it; populate/generate barcodes later.
7. ✅ On-site sales use a **dedicated `pos_sales` + `pos_sale_items`** (separate
   lifecycle from delivery orders), sharing stock + reports.

Cashier access: add a **`cashier`** admin tier (POS + own shift only); owner/admin
keep full back-office.

## Suggested phasing
- **P1 (online-only core POS)**: sell screen (scan/grid → cart → cash/QR →
  receipt) + shared stock + VAT receipt + shift open/close + cashier role. Online-
  connected first to validate the flow.
- **P2 (offline-first)**: local cache + sale queue + sync + PWA/service worker.
- **P3**: store credit/members, reports/dashboard, thermal-printer integration,
  full tax invoice, returns/refunds, split payment.
