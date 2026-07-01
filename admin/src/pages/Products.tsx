import { Select, SelectItem, Textarea, TextInput } from '@tremor/react';
import {
  RiAddLine,
  RiDeleteBinLine,
  RiEyeLine,
  RiEyeOffLine,
  RiImageLine,
  RiPencilLine,
  RiSearchLine,
} from '@remixicon/react';
import { useEffect, useState, type ReactNode } from 'react';

import {
  adjustStock,
  apiError,
  archiveProduct,
  listCategories,
  listProducts,
  setPublishState,
  upsertProduct,
  upsertVariant,
  type Category,
  type Product,
} from '../lib/api';

const primaryImage = (p: Product) =>
  p.product_images.find((i) => i.is_primary)?.storage_path ?? p.product_images[0]?.storage_path ?? null;

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [variantsFor, setVariantsFor] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([listProducts(), listCategories()]);
      setProducts(p);
      setCategories(c);
      setVariantsFor((cur) => (cur ? p.find((x) => x.id === cur.id) ?? null : null));
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function togglePublish(p: Product) {
    setError(null);
    try {
      await setPublishState(p.id, p.publish_state === 'published' ? 'draft' : 'published', p.row_version);
      await load();
    } catch (e) {
      setError(apiError(e));
    }
  }

  async function onArchive(p: Product) {
    if (!confirm(`ลบสินค้า "${p.name}" ?`)) return;
    try {
      await archiveProduct(p.id, p.row_version);
      await load();
    } catch (e) {
      setError(apiError(e));
    }
  }

  const shown = products.filter((p) => {
    if (catFilter && p.category_id !== catFilter) return false;
    const q = query.trim().toLowerCase();
    if (q && !p.name.toLowerCase().includes(q) && !(p.subtitle ?? '').toLowerCase().includes(q))
      return false;
    return true;
  });

  const rowProps = {
    onVariants: setVariantsFor,
    onEdit: (p: Product) => setEditing(p),
    onToggle: (p: Product) => void togglePublish(p),
    onArchive: (p: Product) => void onArchive(p),
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">สินค้า</h1>
          <p className="text-sm text-gray-400 mt-0.5">ทั้งหมด {products.length} รายการ</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-1.5 bg-tremor-brand hover:bg-tremor-brand-emphasis text-white rounded-xl px-4 py-2.5 text-sm font-medium transition shadow-sm">
          <RiAddLine className="w-4 h-4" />
          เพิ่มสินค้า
        </button>
      </div>

      {/* toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาสินค้า…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-tremor-brand-muted"
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-tremor-brand-muted">
          <option value="">ทุกหมวดหมู่</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className="text-red-600 text-sm mb-3">{error}</p> : null}

      {loading ? (
        <p className="text-center text-gray-400 py-16">กำลังโหลด…</p>
      ) : shown.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center text-gray-400 py-16">
          {products.length === 0 ? 'ยังไม่มีสินค้า' : 'ไม่พบสินค้าที่ค้นหา'}
        </div>
      ) : (
        <>
          {/* desktop table */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-3 font-medium">สินค้า</th>
                  <th className="px-3 py-3 font-medium">หมวดหมู่</th>
                  <th className="px-3 py-3 font-medium text-right">ราคา</th>
                  <th className="px-3 py-3 font-medium text-right">สต็อก</th>
                  <th className="px-3 py-3 font-medium text-center">สถานะ</th>
                  <th className="px-5 py-3 font-medium text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {shown.map((p) => (
                  <ProductRow key={p.id} p={p} {...rowProps} />
                ))}
              </tbody>
            </table>
          </div>

          {/* mobile stacked cards */}
          <div className="md:hidden space-y-3">
            {shown.map((p) => (
              <ProductCardMobile key={p.id} p={p} {...rowProps} />
            ))}
          </div>
        </>
      )}

      {editing ? (
        <ProductModal
          product={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : null}

      {variantsFor ? (
        <VariantsModal product={variantsFor} onClose={() => setVariantsFor(null)} onChanged={load} />
      ) : null}
    </>
  );
}

type RowActions = {
  onVariants: (p: Product) => void;
  onEdit: (p: Product) => void;
  onToggle: (p: Product) => void;
  onArchive: (p: Product) => void;
};

function priceText(p: Product): string {
  const prices = p.product_variants.map((v) => v.price);
  if (!prices.length) return '—';
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi ? `฿${lo}` : `฿${lo}–${hi}`;
}
const totalStock = (p: Product) => p.product_variants.reduce((s, v) => s + v.stock_qty, 0);
const isLow = (p: Product) => p.product_variants.some((v) => v.stock_qty <= v.low_stock_threshold);

function StatusPill({ published }: { published: boolean }) {
  return published ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 text-green-700 text-xs font-medium px-2.5 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
      เผยแพร่
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium px-2.5 py-1">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      ร่าง
    </span>
  );
}

function Thumb({ p, size }: { p: Product; size: string }) {
  const img = primaryImage(p);
  return (
    <div className={`${size} rounded-lg overflow-hidden bg-gray-100 shrink-0 grid place-items-center`}>
      {img ? (
        <img src={img} alt={p.name} className="w-full h-full object-cover" />
      ) : (
        <RiImageLine className="w-5 h-5 text-gray-300" />
      )}
    </div>
  );
}

function RowActionButtons({ p, onVariants, onEdit, onToggle, onArchive }: { p: Product } & RowActions) {
  const published = p.publish_state === 'published';
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        onClick={() => onVariants(p)}
        className="rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium px-3 py-2 whitespace-nowrap">
        ขนาด / สต็อก
      </button>
      <IconBtn title="แก้ไข" onClick={() => onEdit(p)}>
        <RiPencilLine className="w-[18px] h-[18px]" />
      </IconBtn>
      <IconBtn title={published ? 'ซ่อน' : 'เผยแพร่'} onClick={() => onToggle(p)}>
        {published ? <RiEyeOffLine className="w-[18px] h-[18px]" /> : <RiEyeLine className="w-[18px] h-[18px]" />}
      </IconBtn>
      <IconBtn title="ลบ" danger onClick={() => onArchive(p)}>
        <RiDeleteBinLine className="w-[18px] h-[18px]" />
      </IconBtn>
    </div>
  );
}

function ProductRow({ p, ...actions }: { p: Product } & RowActions) {
  const stock = totalStock(p);
  const low = isLow(p);
  return (
    <tr className="hover:bg-gray-50/60">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Thumb p={p} size="w-11 h-11" />
          <div className="min-w-0">
            <div className="font-medium text-gray-800 truncate">{p.name}</div>
            {p.subtitle ? <div className="text-xs text-gray-400 truncate">{p.subtitle}</div> : null}
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-gray-500">{p.categories?.name ?? '—'}</td>
      <td className="px-3 py-3 text-right font-medium text-gray-800 whitespace-nowrap">{priceText(p)}</td>
      <td className="px-3 py-3 text-right whitespace-nowrap">
        <span
          className={
            stock === 0 ? 'text-red-600 font-medium' : low ? 'text-amber-600 font-medium' : 'text-gray-700'
          }>
          {stock}
        </span>
        <span className="text-gray-300 text-xs"> · {p.product_variants.length} ขนาด</span>
      </td>
      <td className="px-3 py-3 text-center">
        <StatusPill published={p.publish_state === 'published'} />
      </td>
      <td className="px-5 py-3">
        <RowActionButtons p={p} {...actions} />
      </td>
    </tr>
  );
}

function ProductCardMobile({ p, ...actions }: { p: Product } & RowActions) {
  const stock = totalStock(p);
  const low = isLow(p);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
      <div className="flex items-start gap-3">
        <Thumb p={p} size="w-14 h-14" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-800 truncate">{p.name}</div>
          {p.subtitle ? <div className="text-xs text-gray-400 truncate">{p.subtitle}</div> : null}
          <div className="flex items-center gap-2 mt-1.5">
            <StatusPill published={p.publish_state === 'published'} />
            <span className="text-xs text-gray-400">{p.categories?.name ?? '—'}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50 text-sm">
        <span className="font-medium text-gray-800">{priceText(p)}</span>
        <span className="text-gray-500">
          สต็อก{' '}
          <span className={stock === 0 ? 'text-red-600 font-medium' : low ? 'text-amber-600 font-medium' : ''}>
            {stock}
          </span>{' '}
          · {p.product_variants.length} ขนาด
        </span>
      </div>
      <div className="mt-3">
        <RowActionButtons p={p} {...actions} />
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={
        'w-10 grid place-items-center rounded-xl border transition ' +
        (danger
          ? 'border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-600 hover:border-red-100'
          : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800')
      }>
      {children}
    </button>
  );
}

/* ── Modal shell (custom — reliable visibility + full control) ─────────────── */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-[480px] max-w-full max-h-[90vh] overflow-auto p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="mb-3">
    <label className="text-xs text-gray-500 block mb-1">{label}</label>
    {children}
  </div>
);

function ProductModal({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '');
  const [subtitle, setSubtitle] = useState(product?.subtitle ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) {
      setErr('กรุณากรอกชื่อสินค้า');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await upsertProduct({
        id: product?.id,
        category_id: categoryId || null,
        name: name.trim(),
        subtitle: subtitle.trim() || null,
        description: description.trim() || null,
        expected_row_version: product?.row_version,
      });
      onSaved();
    } catch (e) {
      setErr(apiError(e));
      setBusy(false);
    }
  };

  return (
    <Modal title={product ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'} onClose={onClose}>
      <Field label="ชื่อสินค้า">
        <TextInput value={name} onValueChange={setName} />
      </Field>
      <Field label="หมวดหมู่">
        <Select value={categoryId} onValueChange={setCategoryId} enableClear={false}>
          <SelectItem value="">— ไม่ระบุ —</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </Select>
      </Field>
      <Field label="คำโปรย">
        <TextInput value={subtitle} onValueChange={setSubtitle} />
      </Field>
      <Field label="รายละเอียด">
        <Textarea value={description} onValueChange={setDescription} rows={3} />
      </Field>
      {err ? <p className="text-red-600 text-sm">{err}</p> : null}
      <div className="flex gap-3 mt-5">
        <button className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm hover:bg-gray-50" onClick={onClose}>
          ยกเลิก
        </button>
        <button
          className="flex-1 bg-tremor-brand hover:bg-tremor-brand-emphasis text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
          disabled={busy}
          onClick={() => void save()}>
          {busy ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
      </div>
    </Modal>
  );
}

function VariantsModal({
  product,
  onClose,
  onChanged,
}: {
  product: Product;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [size, setSize] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    const p = Number(price);
    if (!p || p <= 0) {
      setErr('ราคาต้องมากกว่า 0');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await upsertVariant({
        product_id: product.id,
        size: size.trim() || null,
        price: p,
        stock_qty: stock ? Number(stock) : 0,
      });
      setSize('');
      setPrice('');
      setStock('');
      await onChanged();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const bump = async (variantId: string, delta: number) => {
    setErr(null);
    try {
      await adjustStock(variantId, delta);
      await onChanged();
    } catch (e) {
      setErr(apiError(e));
    }
  };

  return (
    <Modal title={`ขนาด / สต็อก — ${product.name}`} onClose={onClose}>
      <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden mb-4">
        {product.product_variants.length === 0 ? (
          <div className="text-gray-400 text-sm p-4">ยังไม่มีขนาด</div>
        ) : (
          product.product_variants.map((v) => (
            <div key={v.id} className="flex items-center gap-3 p-3 text-sm">
              <div className="flex-1 font-medium">{v.size ?? 'ปกติ'}</div>
              <div className="w-16 text-right">฿{v.price}</div>
              <div className="w-24 text-right text-gray-500">
                สต็อก {v.stock_qty}
                {v.reserved_qty ? ` (จอง ${v.reserved_qty})` : ''}
              </div>
              <button
                className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                onClick={() => void bump(v.id, -1)}>
                −
              </button>
              <button
                className="w-10 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                onClick={() => void bump(v.id, +10)}>
                +10
              </button>
            </div>
          ))
        )}
      </div>

      <p className="font-medium text-sm mb-2">เพิ่มขนาด</p>
      <div className="flex gap-3">
        <Field label="ขนาด (เว้นว่าง = ปกติ)">
          <TextInput value={size} onValueChange={setSize} placeholder="1 กก." />
        </Field>
        <Field label="ราคา (฿)">
          <TextInput value={price} onValueChange={setPrice} />
        </Field>
        <Field label="สต็อก">
          <TextInput value={stock} onValueChange={setStock} />
        </Field>
      </div>
      {err ? <p className="text-red-600 text-sm">{err}</p> : null}
      <div className="flex gap-3 mt-4">
        <button className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm hover:bg-gray-50" onClick={onClose}>
          ปิด
        </button>
        <button
          className="flex-1 bg-tremor-brand hover:bg-tremor-brand-emphasis text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
          disabled={busy}
          onClick={() => void add()}>
          {busy ? 'กำลังเพิ่ม…' : 'เพิ่มขนาด'}
        </button>
      </div>
    </Modal>
  );
}
