import { useEffect, useState } from 'react';

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
      <div className="page-head">
        <h1>สินค้า</h1>
        <button className="btn" onClick={() => setEditing('new')}>
          + เพิ่มสินค้า
        </button>
      </div>
      {error ? <div className="err" style={{ marginBottom: 12 }}>{error}</div> : null}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="center-note">กำลังโหลด…</div>
        ) : products.length === 0 ? (
          <div className="center-note">ยังไม่มีสินค้า</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>หมวด</th>
                <th>ขนาด</th>
                <th className="right">ราคาเริ่ม</th>
                <th className="right">สต็อก</th>
                <th>สถานะ</th>
                <th className="right">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const prices = p.product_variants.map((v) => v.price);
                const stock = p.product_variants.reduce((s, v) => s + v.stock_qty, 0);
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="muted">{p.categories?.name ?? '—'}</td>
                    <td>{p.product_variants.length}</td>
                    <td className="right">{prices.length ? `฿${Math.min(...prices)}` : '—'}</td>
                    <td className="right">{stock}</td>
                    <td>
                      <span className={'badge ' + (p.publish_state === 'published' ? 'badge-green' : 'badge-muted')}>
                        {p.publish_state === 'published' ? 'เผยแพร่' : 'ร่าง'}
                      </span>
                    </td>
                    <td className="right" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn-ghost btn-sm" onClick={() => setVariantsFor(p)}>
                        ขนาด/สต็อก
                      </button>{' '}
                      <button className="btn-ghost btn-sm" onClick={() => setEditing(p)}>
                        แก้ไข
                      </button>{' '}
                      <button className="btn-ghost btn-sm" onClick={() => void togglePublish(p)}>
                        {p.publish_state === 'published' ? 'ซ่อน' : 'เผยแพร่'}
                      </button>{' '}
                      <button className="btn-danger btn-sm" onClick={() => void onArchive(p)}>
                        ลบ
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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
        <VariantsModal
          product={variantsFor}
          onClose={() => setVariantsFor(null)}
          onChanged={async () => {
            await load();
            // refresh the open modal's product reference
            setVariantsFor((cur) => (cur ? products.find((p) => p.id === cur.id) ?? cur : cur));
          }}
        />
      ) : null}
    </>
  );
}

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
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{product ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}</h2>
        <label>ชื่อสินค้า</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <label>หมวดหมู่</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">— ไม่ระบุ —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label>คำโปรย</label>
        <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        <label>รายละเอียด</label>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        {err ? <div className="err">{err}</div> : null}
        <div className="row" style={{ marginTop: 20 }}>
          <button className="btn-ghost" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="btn" disabled={busy} onClick={() => void save()}>
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </div>
    </div>
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
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>ขนาด / สต็อก — {product.name}</h2>
        <table style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>ขนาด</th>
              <th className="right">ราคา</th>
              <th className="right">สต็อก</th>
              <th className="right">ปรับ</th>
            </tr>
          </thead>
          <tbody>
            {product.product_variants.map((v) => (
              <tr key={v.id}>
                <td>{v.size ?? 'ปกติ'}</td>
                <td className="right">฿{v.price}</td>
                <td className="right">
                  {v.stock_qty}
                  {v.reserved_qty ? <span className="muted"> (จอง {v.reserved_qty})</span> : null}
                </td>
                <td className="right" style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn-ghost btn-sm" onClick={() => void bump(v.id, -1)}>
                    −
                  </button>{' '}
                  <button className="btn-ghost btn-sm" onClick={() => void bump(v.id, +10)}>
                    +10
                  </button>
                </td>
              </tr>
            ))}
            {product.product_variants.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  ยังไม่มีขนาด
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <h3 style={{ marginTop: 18, fontSize: 15 }}>เพิ่มขนาด</h3>
        <div className="row">
          <div>
            <label>ขนาด (เว้นว่าง = ปกติ)</label>
            <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="1 กก." />
          </div>
          <div>
            <label>ราคา (฿)</label>
            <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" />
          </div>
          <div>
            <label>สต็อก</label>
            <input value={stock} onChange={(e) => setStock(e.target.value)} inputMode="numeric" />
          </div>
        </div>
        {err ? <div className="err">{err}</div> : null}
        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn-ghost" onClick={onClose}>
            ปิด
          </button>
          <button className="btn" disabled={busy} onClick={() => void add()}>
            {busy ? 'กำลังเพิ่ม…' : 'เพิ่มขนาด'}
          </button>
        </div>
      </div>
    </div>
  );
}
