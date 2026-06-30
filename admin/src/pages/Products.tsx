import { Badge, Select, SelectItem, Textarea, TextInput } from '@tremor/react';
import {
  RiAddLine,
  RiDeleteBinLine,
  RiEyeLine,
  RiEyeOffLine,
  RiPencilLine,
  RiStarFill,
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

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">สินค้า</h1>
          <p className="text-sm text-gray-400 mt-0.5">{products.length} รายการ</p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-1.5 bg-tremor-brand hover:bg-tremor-brand-emphasis text-white rounded-xl px-4 py-2.5 text-sm font-medium transition">
          <RiAddLine className="w-4 h-4" />
          เพิ่มสินค้า
        </button>
      </div>
      {error ? <p className="text-red-600 text-sm mb-3">{error}</p> : null}

      {loading ? (
        <p className="text-center text-gray-400 py-16">กำลังโหลด…</p>
      ) : products.length === 0 ? (
        <p className="text-center text-gray-400 py-16">ยังไม่มีสินค้า</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {products.map((p) => {
            const prices = p.product_variants.map((v) => v.price);
            const stock = p.product_variants.reduce((s, v) => s + v.stock_qty, 0);
            const img = primaryImage(p);
            const published = p.publish_state === 'published';
            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                <div className="relative aspect-[4/3] bg-gray-100">
                  {img ? (
                    <img src={img} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-gray-300 text-sm">ไม่มีรูป</div>
                  )}
                  <span className="absolute top-2.5 right-2.5">
                    <Badge color={published ? 'emerald' : 'gray'}>{published ? 'เผยแพร่' : 'ร่าง'}</Badge>
                  </span>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <Badge color="orange">{p.categories?.name ?? 'ไม่ระบุ'}</Badge>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <RiStarFill className="w-3.5 h-3.5 text-amber-400" />
                      {p.rating.toFixed(1)}
                    </span>
                  </div>
                  <h3 className="font-medium leading-snug line-clamp-2 min-h-[2.6em]">{p.name}</h3>
                  <div className="flex gap-5 mt-3 mb-4">
                    <Stat label="ราคาเริ่ม" value={prices.length ? `฿${Math.min(...prices)}` : '—'} />
                    <Stat label="สต็อก" value={String(stock)} />
                    <Stat label="ขนาด" value={String(p.product_variants.length)} className="ml-auto text-right" />
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <button
                      onClick={() => setVariantsFor(p)}
                      className="flex-1 bg-gray-900 hover:bg-gray-800 text-white rounded-xl py-2.5 text-sm font-medium transition">
                      ขนาด & สต็อก
                    </button>
                    <IconBtn title="แก้ไข" onClick={() => setEditing(p)}>
                      <RiPencilLine className="w-[18px] h-[18px]" />
                    </IconBtn>
                    <IconBtn title={published ? 'ซ่อน' : 'เผยแพร่'} onClick={() => void togglePublish(p)}>
                      {published ? <RiEyeOffLine className="w-[18px] h-[18px]" /> : <RiEyeLine className="w-[18px] h-[18px]" />}
                    </IconBtn>
                    <IconBtn title="ลบ" danger onClick={() => void onArchive(p)}>
                      <RiDeleteBinLine className="w-[18px] h-[18px]" />
                    </IconBtn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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

function Stat({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="font-medium text-gray-800">{value}</div>
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
