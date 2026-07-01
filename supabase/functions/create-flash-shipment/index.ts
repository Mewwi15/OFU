// create-flash-shipment — creates a Flash Express parcel for a confirmed ONLINE
// order and stores the returned tracking number (pno). Invoked by the
// dispatch_flash trigger (0016) via pg_net, or manually with { order_id }.
//
// Env (besides FLASH_*): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   FLASH_WAREHOUSE_NO      - your registered Flash pickup warehouse (sender)
//   FLASH_EXPRESS_CATEGORY  - default 1 (Normal); groceries/ของสด may be 5 (Fruit)
//   FLASH_ARTICLE_CATEGORY  - default 1
//   FLASH_DEFAULT_WEIGHT_G  - default 1000 (until real product weights exist)
// VERIFY parameter names, category codes, and the COD amount unit (satang vs baht)
// against your Flash merchant docs. See docs/flash-setup.md.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

import { flashPost } from '../_shared/flash.ts';

type Addr = {
  recipient_name: string;
  recipient_phone: string;
  address_line: string;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  postal_code: string | null;
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  const { order_id } = await req.json().catch(() => ({ order_id: null }));
  if (!order_id) return json({ error: 'order_id required' }, 400);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: o, error } = await sb
    .from('orders')
    .select('id, order_number, total, payment_method, address:address_id(recipient_name, recipient_phone, address_line, subdistrict, district, province, postal_code)')
    .eq('id', order_id)
    .single();
  if (error || !o) return json({ error: 'order not found' }, 404);

  const addr = o.address as unknown as Addr | null;
  if (!addr?.province || !addr?.postal_code) {
    return json({ error: 'recipient address missing province/postal' }, 422);
  }

  const expressCategory = Deno.env.get('FLASH_EXPRESS_CATEGORY') ?? '1';
  const weight = Deno.env.get('FLASH_DEFAULT_WEIGHT_G') ?? '1000';
  const cod = o.payment_method === 'cod';

  const params: Record<string, string> = {
    outTradeNo: o.order_number,
    warehouseNo: Deno.env.get('FLASH_WAREHOUSE_NO') ?? '',
    dstName: addr.recipient_name,
    dstPhone: addr.recipient_phone,
    dstProvinceName: addr.province,
    dstCityName: addr.district ?? addr.province,
    dstDistrictName: addr.subdistrict ?? '',
    dstPostalCode: addr.postal_code,
    dstDetailAddress: addr.address_line,
    articleCategory: Deno.env.get('FLASH_ARTICLE_CATEGORY') ?? '1',
    expressCategory,
    weight,
    insured: '0',
    codEnabled: cod ? '1' : '0',
    codAmount: cod ? String(Math.round(o.total * 100)) : '0', // satang — VERIFY unit
    remark: `Oofoo ${o.order_number}`,
  };

  const resp = await flashPost('/open/v3/orders', params);
  if (resp.code !== 1) {
    return json({ error: resp.message ?? 'flash create failed', resp }, 502);
  }
  const pno = (resp.data?.pno as string) ?? '';
  if (!pno) return json({ error: 'no pno in flash response', resp }, 502);

  await sb.rpc('record_flash_shipment', {
    p_order_id: order_id,
    p_pno: pno,
    p_express_category: Number(expressCategory),
    p_weight_g: Number(weight),
    p_cod_amount: cod ? Math.round(o.total) : 0,
  });

  return json({ pno });
});
