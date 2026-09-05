/**
 * รับของเข้า — ใบรับเข้าสินค้าแบบเดียวกับที่เจ้าของคุ้นจาก ETS POS (ทาง ก,
 * 23 ส.ค.): ผู้ขาย + เลขเอกสาร + หลายรายการต่อใบ + เลขใบวิ่งอัตโนมัติ
 * (IN260823-001) — เพื่อให้ OFU เป็นระบบเดียวที่แตะสต๊อก ETS เหลือไว้ดูย้อนหลัง
 *
 * ครึ่งบน: ฟอร์มใบใหม่ — ยิงบาร์โค้ด/พิมพ์ค้นหาแล้ว Enter = ลงบรรทัด (นิสัย
 * เดียวกับหน้าขาย), กรอกจำนวน+ทุนต่อหน่วย (ทุนใหม่ทับทุนเดิมของตัวนั้น —
 * ธรรมเนียม ETS: รับของคือตอนที่รู้ทุนล่าสุด)
 * ครึ่งล่าง: ประวัติใบรับเข้า กดขยายดูรายบรรทัด
 */

import { RiAddLine, RiDeleteBin6Line, RiEditLine, RiFileExcel2Line, RiPrinterLine } from '@remixicon/react';
import {
  Alert,
  AutoComplete,
  Form,
  Modal,
  Select,
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  InputNumber,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import * as XLSX from 'xlsx';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

// ตั้งชื่อ thDate เพราะไฟล์นี้มีตัวแปรท้องถิ่นชื่อ d อยู่แล้ว (พารามิเตอร์ DatePicker
// และตัวแปรอ่านวันที่จากไฟล์ import) — ชื่อซ้ำจะบังกันเงียบ ๆ ตอนมีคนมาแก้ทีหลัง
import { d as thDate } from '../lib/time';

dayjs.extend(customParseFormat);

/** ใบรับเข้าที่ยังทำไม่เสร็จ เก็บไว้ในเครื่องกันหายตอนรีเฟรช */
type ReceiveDraft = {
  supplier: string;
  docNo: string;
  receivedAt: string;
  note: string | null;
  lines: DraftLine[];
  savedAt: number;
};
const DRAFT_KEY = 'ofu-receive-draft';

function readDraft(): ReceiveDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as ReceiveDraft;
    /* ใบที่ค้างข้ามวันไปแล้วไม่ถามซ้ำ — คนรับของคงลืมไปแล้วว่าเคยทำอะไรค้างไว้ และการ
       เด้งถามทุกเช้าเรื่องใบเมื่อวานคือสิ่งที่ทำให้คนเลิกอ่านกล่องข้อความ */
    if (!d?.lines?.length || Date.now() - (d.savedAt ?? 0) > 24 * 60 * 60 * 1000) return null;
    return d;
  } catch {
    return null;
  }
}
function writeDraft(d: ReceiveDraft | null) {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* โหมดส่วนตัว/พื้นที่เต็ม — ไม่ใช่เรื่องที่ต้องหยุดการรับของ */
  }
}

/** แปลงสินค้าจากหลังบ้านเป็นรายการที่ช่องค้นหาของหน้ารับเข้าใช้ — เดิมเขียนซ้ำสองที่ */
function itemsFromProducts(ps: Awaited<ReturnType<typeof listProducts>>) {
  return ps.flatMap((p) => {
    const image =
      productThumb(
        p.product_images.find((i) => i.is_primary)?.storage_path ??
          p.product_images[0]?.storage_path ??
          null,
        64,
      ) ?? null;
    return p.product_variants.map((v) => ({
      variantId: v.id,
      label: `${p.name}${v.size ? ` (${v.size})` : ''}`,
      productName: p.name,
      size: v.size ?? null,
      barcode: v.barcode ?? null,
      sku: v.sku ?? null,
      cost: v.cost_price ?? null,
      stock: v.stock_qty ?? 0,
      image,
    }));
  });
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InputRef } from 'antd';

import {
  apiError,
  createGoodsReceipt,
  getGoodsReceiptLines,
  invalidateProductsCache,
  voidGoodsReceipt,
  listCategories,
  listProducts,
  upsertProduct,
  upsertVariant,
  type GoodsReceipt,
  type GoodsReceiptLine,
} from '../lib/api';
import { productThumb } from '../lib/image';

const baht = (n: number) => `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;

/**
 * เงินแบบปัดเป็นบาทถ้วน แสดงลงท้าย .00 เสมอ (เจ้าของสั่ง 5 ก.ย. 2026 "ยอดรวมที่เป็น
 * ทศนิยม ทำปัดเศษให้เป็น .00 เลย")
 *
 * ★ ใช้กับทั้งช่อง "รวม" ของแต่ละแถวและเงินรวมท้ายใบ ★ ถ้าปัดเฉพาะยอดรวม ตัวเลขในตาราง
 * จะบวกแล้วไม่เท่ากับยอดล่าง ซึ่งเป็นสิ่งที่คนตรวจใบรับของจับได้ทันทีและเชื่อตัวเลขไม่ได้
 * อีกเลย — ปัดที่ระดับแถวแล้วบวกจากค่าที่ปัดแล้ว ทุกอย่างบนจอจึงตรงกันเสมอ
 *
 * ทุนต่อชิ้นที่บันทึกลงฐานข้อมูลไม่ถูกแตะ ยังเก็บทศนิยมตามที่กรอกทุกประการ
 */
const bahtRound = (n: number) =>
  `฿${Math.round(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type PickItem = {
  variantId: string;
  label: string;
  productName: string;
  size: string | null;
  barcode: string | null;
  sku: string | null;
  cost: number | null;
  /* สต๊อกที่มีอยู่ตอนนี้ — ใช้โชว์เฉย ๆ ในใบรับเข้า ★ อ่านจากรายการสินค้าเสมอ ไม่เก็บลง
     บรรทัดใบ ★ ใบที่ทำค้างไว้ข้ามวันได้ ถ้าแช่ตัวเลขไว้ในใบ พรุ่งนี้มันจะโชว์สต๊อกของ
     เมื่อวานโดยไม่มีอะไรบอก */
  stock: number;
  image: string | null;
};

type DraftLine = PickItem & { qty: number; unitCost: number | null };

export function Receive() {
  const [items, setItems] = useState<PickItem[]>([]);
  const [supplier, setSupplier] = useState('');
  const [docNo, setDocNo] = useState('');
  // วันที่รับจริง — ย้อนหลังได้ (เคสคีย์ตามหลัง เช่นใบค้างจาก ETS)
  const [receivedAt, setReceivedAt] = useState<Dayjs>(dayjs());
  // ผลการ import ไฟล์: แถวที่จับคู่ไม่ได้ต้องเห็นตรง ๆ ห้ามหายเงียบ (บทเรียน M4)
  const [importReport, setImportReport] = useState<{
    matched: number;
    unmatchedRows: UnmatchedRow[];
  } | null>(null);
  const [creatingDrafts, setCreatingDrafts] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null); // 'เลขที่เอกสาร: ขนม' จากหัวไฟล์
  const [lines, setLines] = useState<DraftLine[]>([]);

  /* ── ใบที่ทำค้างไว้ ต้องไม่หายตอนรีเฟรช ──
     เจ้าของสั่ง 5 ก.ย. 2026 "รีทีนึงแล้วต้องเริ่มใหม่" — คนรับของยิงของไปแล้วสามสิบชิ้น
     เผลอกดรีเฟรช/แท็บถูกปิด แล้วต้องยิงใหม่ทั้งใบ ซึ่งเป็นงานที่เสียเวลาที่สุดของหน้านี้
     ★ เก็บในเครื่อง ไม่ใช่ในฐานข้อมูล ★ ใบที่ยังทำไม่เสร็จไม่ใช่เอกสารของร้าน ยังไม่ควรมี
     ตัวตนในระบบ — ถ้าเก็บขึ้นเซิร์ฟเวอร์ต้องมีเรื่องใครเป็นเจ้าของใบ ใบค้างของคนอื่น
     ลบได้ไหม ฯลฯ ทั้งที่ปัญหาจริงคือแค่ "อย่าให้หายตอนรีเฟรช" */
  const [restore, setRestore] = useState<ReceiveDraft | null>(null);
  const restoredRef = useRef(false);

  // เปิดหน้ามาแล้วเจอใบค้าง — ถามก่อน ไม่เติมให้เองเงียบ ๆ
  useEffect(() => {
    const d = readDraft();
    if (d) setRestore(d);
    else restoredRef.current = true;
  }, []);

  /* เก็บทุกครั้งที่ใบเปลี่ยน — แต่ไม่เก็บก่อนจะตอบเรื่องใบค้างเสร็จ ไม่งั้นสถานะว่าง ๆ
     ตอนเพิ่งเปิดหน้าจะไปทับใบที่ค้างอยู่ทิ้งทันที */
  useEffect(() => {
    if (!restoredRef.current) return;
    if (lines.length === 0) {
      writeDraft(null);
      return;
    }
    writeDraft({
      supplier,
      docNo,
      receivedAt: receivedAt.toISOString(),
      note: importNote,
      lines,
      savedAt: Date.now(),
    });
  }, [lines, supplier, docNo, receivedAt, importNote]);
  const [saving, setSaving] = useState(false);
  const [receipts, setReceipts] = useState<GoodsReceipt[] | null>(null);
  const [lineCache, setLineCache] = useState<Record<string, GoodsReceiptLine[]>>({});
  const [query, setQuery] = useState('');
  const searchRef = useRef<InputRef>(null);

  /* ── สร้างสินค้าใหม่ตรงนี้เลย (เจ้าของสั่ง 5 ก.ย. 2026) ──
     เดิมยิงบาร์โค้ดที่ยังไม่มีในระบบแล้วได้แค่คำเตือน "ไม่พบสินค้า" ต้องไปเปิดหน้าสินค้า
     สร้างเอง แล้วค่อยกลับมายิงใหม่ — ของกองอยู่ตรงหน้าแต่คนรับของต้องสลับหน้าไปมา
     ★ เป็นฉบับร่างเสมอ ★ ลูกค้าไม่เห็นจนกว่าจะไปตั้งราคา/รูปแล้วเผยแพร่เอง
     กติกาเดียวกับปุ่ม "สร้างสินค้าร่าง" ของฝั่ง import ที่ทำไว้แล้ว */
  const [newProduct, setNewProduct] = useState<{ code: string } | null>(null);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    void listCategories()
      .then((cs) => setCats(cs.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => setCats([]));
  }, []);

  /* สร้างสินค้าใหม่ (ฉบับร่าง) จากแถวที่ไม่พบ — เจ้าของยืนยัน: "น่าจะเป็นสินค้าใหม่"
   * ราคาขายตั้งต้น: ① เลขในชื่อ ("ขนม 10 บาท" → 10) ② ทุน×1.25 ปัดขึ้น (สูตรเดียว
   * กับ sync ใหญ่) ③ 0 — เป็นร่างเสมอ ลูกค้าไม่เห็นจนกว่าจะตั้งราคา/เผยแพร่เอง */
  const createDraftsFromUnmatched = async () => {
    if (!importReport) return;
    const rows = importReport.unmatchedRows.filter((u) => u.qty && u.qty > 0);
    if (!rows.length) return;
    setCreatingDrafts(true);
    let ok = 0;
    const failed: UnmatchedRow[] = [];
    for (const u of rows) {
      try {
        const name = u.name?.trim() || `สินค้า ${u.text}`;
        const mPrice = name.match(/(\d+(?:\.\d+)?)\s*บาท/);
        const price = mPrice
          ? Number(mPrice[1])
          : u.cost != null
            ? Math.ceil(u.cost * 1.25)
            : 0;
        const { id: productId } = await upsertProduct({ name });
        const { id: variantId } = await upsertVariant({
          product_id: productId,
          price,
          barcode: u.text,
          cost_price: u.cost ?? undefined,
        });
        setLines((prev) => [
          ...prev,
          {
            variantId,
            label: name,
            productName: name,
            size: null,
            barcode: u.text,
            sku: null,
            cost: u.cost ?? null,
            stock: 0,
            image: null,
            qty: u.qty as number,
            unitCost: u.cost ?? null,
          },
        ]);
        ok++;
      } catch {
        failed.push(u);
      }
    }
    invalidateProductsCache();
    void listProducts(true).then((ps) => {
      setItems(
        itemsFromProducts(ps),
      );
    });
    setImportReport((prev) =>
      prev ? { ...prev, matched: prev.matched + ok, unmatchedRows: failed } : prev,
    );
    setCreatingDrafts(false);
    message.success(
      `สร้างสินค้าร่าง ${ok} ตัว + เพิ่มเข้าใบแล้ว — อย่าลืมไปตั้งราคา/รูป/หมวด แล้วเผยแพร่ในหน้าสินค้า`,
    );
  };

  /* "ลบ" = ยกเลิกใบ (void): ถอนสต๊อกคืน + ใบติดป้ายยกเลิก ดูย้อนหลังได้
   * "แก้ไข" = ยกเลิกใบเดิม แล้วดึงทุกบรรทัดกลับเข้าฟอร์ม แก้เสร็จบันทึกเป็นใบใหม่ */
  const doVoid = (r: GoodsReceipt, thenEdit: boolean) => {
    Modal.confirm({
      title: thenEdit ? `แก้ไขใบ ${r.receipt_number}?` : `ยกเลิกใบ ${r.receipt_number}?`,
      content: thenEdit
        ? 'ใบเดิมจะถูกยกเลิก (สต๊อกถอนคืน) แล้วดึงรายการกลับมาแก้ในฟอร์ม — บันทึกใหม่ได้เลขใบใหม่'
        : 'สต๊อกที่รับเข้าจากใบนี้จะถูกถอนคืนทั้งหมด · ทุนที่เคยอัปเดตไปแล้วจะไม่ย้อนกลับ',
      okText: thenEdit ? 'ยกเลิกใบเดิมและแก้ไข' : 'ยกเลิกใบ',
      okButtonProps: { danger: true },
      cancelText: 'ไม่ทำ',
      onOk: async () => {
        try {
          const ls = lineCache[r.id] ?? (await getGoodsReceiptLines(r.id));
          await voidGoodsReceipt(r.id, thenEdit ? 'แก้ไขใบ' : undefined);
          message.success(`ยกเลิกใบ ${r.receipt_number} แล้ว — สต๊อกถอนคืนเรียบร้อย`);
          if (thenEdit) {
            // จับคู่บรรทัดเดิมกลับเป็นรายการในฟอร์มผ่านบาร์โค้ด
            const byBc = new Map(items.filter((i) => i.barcode).map((i) => [i.barcode as string, i]));
            setLines(
              ls.flatMap((l) => {
                const it = l.barcode ? byBc.get(l.barcode) : undefined;
                return it ? [{ ...it, qty: l.qty, unitCost: l.unit_cost }] : [];
              }),
            );
            setSupplier(r.supplier ?? '');
            setDocNo(r.doc_number ?? '');
            setReceivedAt(dayjs(r.received_at ?? r.created_at));
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          loadReceipts();
        } catch (e) {
          message.error(apiError(e));
        }
      },
    });
  };

  const loadReceipts = useCallback(() => {
    listGoodsReceiptsSafe().then(setReceipts);
  }, []);

  useEffect(() => {
    void listProducts().then((ps) => {
      setItems(
        itemsFromProducts(ps),
      );
    });
    loadReceipts();
  }, [loadReceipts]);

  /* ชื่อผู้ขายที่เคยใช้ — ให้ AutoComplete จำแทนคน */
  const supplierOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const r of receipts ?? []) if (r.supplier) seen.add(r.supplier);
    return [...seen].map((v) => ({ value: v }));
  }, [receipts]);

  /* ยิงบาร์โค้ดตรง = เข้าบรรทัดทันที · พิมพ์ = โชว์ตัวเลือกให้จิ้ม */
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter(
        (i) =>
          i.barcode === query.trim() ||
          i.sku?.toLowerCase() === q ||
          i.label.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [items, query]);

  const addLine = useCallback((item: PickItem) => {
    setLines((prev) => {
      const at = prev.findIndex((l) => l.variantId === item.variantId);
      if (at >= 0) {
        const next = [...prev];
        next[at] = { ...next[at], qty: next[at].qty + 1 };
        return next;
      }
      return [...prev, { ...item, qty: 1, unitCost: item.cost }];
    });
    setQuery('');
    searchRef.current?.focus();
  }, []);

  /**
   * สร้างสินค้าร่างจากข้อมูลที่กรอกใน modal แล้วเพิ่มเข้าใบรับเข้าทันที
   *
   * ราคาขายตั้งต้นใช้สูตรเดียวกับฝั่ง import: เลขในชื่อ ("ขนม 10 บาท" → 10) ก่อน
   * ถ้าไม่มีก็ทุน×1.25 ปัดขึ้น — ไม่ใช่ 0 เพราะของที่ราคา 0 ถ้าเผลอเผยแพร่คือขายฟรี
   */
  const createProductNow = async (v: { name: string; cost?: number; categoryId?: string }) => {
    const code = newProduct?.code ?? '';
    const name = v.name.trim();
    const mPrice = name.match(/(\d+(?:\.\d+)?)\s*บาท/);
    const price = mPrice ? Number(mPrice[1]) : v.cost != null ? Math.ceil(v.cost * 1.25) : 0;
    try {
      const { id: productId } = await upsertProduct({ name, category_id: v.categoryId ?? null });
      const { id: variantId } = await upsertVariant({
        product_id: productId,
        price,
        /* ใส่เป็นบาร์โค้ดเฉพาะตอนที่สิ่งที่พิมพ์มาเป็นรหัสจริง ๆ — ถ้าคนรับของพิมพ์ชื่อ
           สินค้าไปค้นแล้วไม่เจอ เอาชื่อไปใส่ช่องบาร์โค้ดจะทำให้ยิงของจริงไม่เจอตลอดไป */
        barcode: /^[0-9A-Za-z-]{6,}$/.test(code) ? code : undefined,
        cost_price: v.cost ?? undefined,
      });
      setLines((prev) => [
        ...prev,
        {
          variantId,
          label: name,
          productName: name,
          size: null,
          barcode: code,
          sku: null,
          cost: v.cost ?? null,
          stock: 0,
          image: null,
          qty: 1,
          unitCost: v.cost ?? null,
        },
      ]);
      invalidateProductsCache();
      void listProducts(true).then((ps) => setItems(itemsFromProducts(ps)));
      setNewProduct(null);
      setQuery('');
      searchRef.current?.focus();
      message.success(`เพิ่ม "${name}" เป็นสินค้าร่างแล้ว — อย่าลืมตั้งราคา/รูป แล้วเผยแพร่ในหน้าสินค้า`);
    } catch (e) {
      message.error(apiError(e));
    }
  };

  const onSearchEnter = () => {
    // บาร์โค้ดเป๊ะมาก่อน (เครื่องยิงจบด้วย Enter เสมอ) — ไม่งั้นถ้าเหลือตัวเดียวก็เอาตัวนั้น
    const exact = items.find((i) => i.barcode === query.trim());
    if (exact) return addLine(exact);
    if (matches.length === 1) return addLine(matches[0]);
    if (matches.length === 0 && query.trim()) setNewProduct({ code: query.trim() });
  };

  /* บวกจากค่าที่ปัดแล้วทีละแถว ไม่ใช่ปัดตอนท้าย — ตัวเลขในตารางกับยอดล่างจะได้ตรงกัน
     (ปัดตอนท้ายทำให้ 0.5+0.5 กลายเป็น 1 ทั้งที่ในตารางโชว์ 1+1 = 2) */
  const total = lines.reduce((s, l) => s + Math.round((l.unitCost ?? 0) * l.qty), 0);

  const save = async () => {
    if (lines.length === 0) return;
    setSaving(true);
    try {
      const res = await createGoodsReceipt({
        supplier: supplier.trim() || undefined,
        doc_number: docNo.trim() || undefined,
        received_at: receivedAt.toISOString(),
        note: importNote ?? undefined,
        items: lines.map((l) => ({
          variant_id: l.variantId,
          qty: l.qty,
          ...(l.unitCost != null ? { unit_cost: l.unitCost } : {}),
        })),
      });
      message.success(`บันทึกใบ ${res.receipt_number} — รับเข้า ${res.line_count} รายการ`);
      // บันทึกเข้าระบบแล้ว ใบค้างในเครื่องหมดหน้าที่ ต้องไม่ถามซ้ำรอบหน้า
      writeDraft(null);
      // ไม่พิมพ์อัตโนมัติ (เจ้าของสั่ง 23 ส.ค.) — ปุ่มพิมพ์อยู่ในประวัติเมื่อต้องการ
      setLines([]);
      setSupplier('');
      setDocNo('');
      setReceivedAt(dayjs());
      setImportReport(null);
      setImportNote(null);
      loadReceipts();
    } catch (e) {
      message.error(apiError(e));
    } finally {
      setSaving(false);
    }
  };

  /* สต๊อกอ่านจากรายการสินค้าที่โหลดมา ไม่ใช่จากบรรทัดในใบ — ใบค้างข้ามวันจะได้ไม่โชว์
     ตัวเลขของเมื่อวาน · สินค้าที่หาไม่เจอ (เพิ่งสร้างและยังไม่รีเฟรช) คืนค่าว่างให้โชว์ — */
  const stockOf = useCallback(
    (variantId: string) => items.find((i) => i.variantId === variantId)?.stock ?? null,
    [items],
  );

  const draftCols: ColumnsType<DraftLine> = [
    {
      title: 'สินค้า',
      render: (_, l) => (
        <span className="flex items-center gap-2">
          {l.image ? <img src={l.image} className="w-8 h-8 rounded object-cover" alt="" /> : null}
          <span>
            {l.productName}
            {l.size ? <Typography.Text type="secondary"> ({l.size})</Typography.Text> : null}
          </span>
        </span>
      ),
    },
    {
      /* เจ้าของสั่ง 5 ก.ย. 2026 — ตอนคีย์ใบรับเข้าจะได้เห็นว่าของเดิมมีเท่าไหร่ ไม่ต้อง
         เปิดหน้าสต็อกอีกจอ และเป็นตัวจับผิดว่ายิงผิดตัวหรือเปล่าตั้งแต่ตอนคีย์ */
      title: 'สต๊อกเดิม',
      width: 90,
      align: 'right',
      render: (_, l) => {
        const now = stockOf(l.variantId);
        return now == null ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          <span className="tabular-nums">{now}</span>
        );
      },
    },
    {
      title: 'จำนวน',
      width: 110,
      render: (_, l, i) => (
        <InputNumber
          min={1}
          max={100000}
          value={l.qty}
          onChange={(v) =>
            setLines((prev) => prev.map((x, j) => (j === i ? { ...x, qty: v ?? 1 } : x)))
          }
        />
      ),
    },
    {
      title: 'หลังรับ',
      width: 90,
      align: 'right',
      /* เดิม + ที่รับ — ตัวเลขที่จะกลายเป็นสต๊อกจริงหลังกดบันทึก ให้เห็นก่อนกด ไม่ใช่
         ไปเซอร์ไพรส์ทีหลังในหน้าสินค้า */
      render: (_, l) => {
        const now = stockOf(l.variantId);
        return now == null ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          <b className="tabular-nums">{now + l.qty}</b>
        );
      },
    },
    {
      title: 'ทุน/หน่วย',
      width: 130,
      render: (_, l, i) => (
        <InputNumber
          min={0}
          placeholder="ไม่บังคับ"
          value={l.unitCost ?? undefined}
          onChange={(v) =>
            setLines((prev) => prev.map((x, j) => (j === i ? { ...x, unitCost: v ?? null } : x)))
          }
        />
      ),
    },
    {
      title: 'รวม',
      width: 110,
      align: 'right',
      render: (_, l) => (l.unitCost != null ? bahtRound(l.unitCost * l.qty) : '—'),
    },
    {
      title: '',
      width: 46,
      render: (_, _l, i) => (
        <Button
          type="text"
          danger
          icon={<RiDeleteBin6Line className="w-4 h-4" />}
          onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
        />
      ),
    },
  ];

  const historyCols: ColumnsType<GoodsReceipt> = [
    { title: 'เลขที่ใบ', dataIndex: 'receipt_number', width: 150, render: (v, r) => (
        <span className={`font-mono ${r.voided_at ? 'line-through text-gray-400' : ''}`}>
          {v}{r.voided_at ? <Tag className="ml-1" color="default">ยกเลิก</Tag> : null}
        </span>
      ) },
    { title: 'วันที่รับ', dataIndex: 'received_at', width: 130, render: (v, r) => thDate(v ?? r.created_at).format('DD/MM/YYYY') },
    { title: 'ผู้ขาย', dataIndex: 'supplier', render: (v) => v ?? <Typography.Text type="secondary">—</Typography.Text> },
    { title: 'เลขเอกสาร', dataIndex: 'doc_number', width: 140, render: (v) => v ?? '—' },
    { title: 'รายการ', dataIndex: 'line_count', width: 90, align: 'right' },
    { title: 'ทุนรวม', dataIndex: 'total_cost', width: 120, align: 'right', render: (v) => (v > 0 ? baht(v) : '—') },
    {
      title: '',
      width: 132,
      render: (_, r) => (
        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            size="small"
            icon={<RiPrinterLine className="w-4 h-4" />}
            title="พิมพ์ใบนี้"
            onClick={async () => {
              const ls = lineCache[r.id] ?? (await getGoodsReceiptLines(r.id));
              if (!lineCache[r.id]) setLineCache((prev) => ({ ...prev, [r.id]: ls }));
              printReceiptSheet(
                { receipt_number: r.receipt_number, supplier: r.supplier, doc_number: r.doc_number, received_at: r.received_at ?? r.created_at },
                ls.map((l) => ({ productName: l.product_name, size: l.size, barcode: l.barcode, qty: l.qty, unitCost: l.unit_cost })),
              );
            }}
          />
          {!r.voided_at ? (
            <>
              <Button
                size="small"
                icon={<RiEditLine className="w-4 h-4" />}
                title="แก้ไข (ยกเลิกใบเดิม ดึงกลับมาแก้)"
                onClick={() => doVoid(r, true)}
              />
              <Button
                size="small"
                danger
                icon={<RiDeleteBin6Line className="w-4 h-4" />}
                title="ยกเลิกใบ (ถอนสต๊อกคืน)"
                onClick={() => doVoid(r, false)}
              />
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card title="สร้างใบรับเข้าสินค้า" size="small">
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <DatePicker
            value={receivedAt}
            onChange={(d) => d && setReceivedAt(d)}
            format="DD/MM/YYYY"
            allowClear={false}
            disabledDate={(d) => d.isAfter(dayjs().endOf('day')) || d.isBefore(dayjs().subtract(1, 'year'))}
          />
          <AutoComplete
            options={supplierOptions}
            value={supplier}
            onChange={setSupplier}
            placeholder="ผู้ขาย เช่น แม็คโคร"
            style={{ width: 220 }}
            filterOption={(input, opt) =>
              (opt?.value ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
          <Input
            value={docNo}
            onChange={(e) => setDocNo(e.target.value)}
            placeholder="เลขที่เอกสาร (ถ้ามี)"
            style={{ width: 200 }}
          />
          <Upload
            accept=".csv,.xls,.xlsx"
            showUploadList={false}
            beforeUpload={(file) => {
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const wb = XLSX.read(reader.result, { type: 'array' });
                  const res = parseReceiveFile(wb, items);
                  if (res.lines.length === 0 && res.unmatchedRows.length === 0) {
                    message.warning('ไฟล์ว่าง หรืออ่านไม่ได้');
                    return;
                  }
                  // เข้า "ตารางร่าง" ให้ตาเห็นก่อนเสมอ — ไม่บันทึกอัตโนมัติ
                  setLines((prev) => {
                    const map = new Map(prev.map((l) => [l.variantId, { ...l }]));
                    for (const nl of res.lines) {
                      const ex = map.get(nl.variantId);
                      if (ex) {
                        ex.qty += nl.qty;
                        if (nl.unitCost != null) ex.unitCost = nl.unitCost;
                      } else map.set(nl.variantId, nl);
                    }
                    return [...map.values()];
                  });
                  const filled: string[] = [];
                  if (res.head.supplier && !supplier.trim()) { setSupplier(res.head.supplier); filled.push(`ผู้ขาย ${res.head.supplier}`); }
                  if (res.head.docNumber && !docNo.trim()) { setDocNo(res.head.docNumber); filled.push(`เอกสาร ${res.head.docNumber}`); }
                  if (res.head.docDate) { setReceivedAt(dayjs(res.head.docDate)); filled.push(`วันที่ ${dayjs(res.head.docDate).format('DD/MM/YYYY')}`); }
                  if (res.head.refText) setImportNote(`อ้างอิง ETS: ${res.head.refText}`);
                  if (filled.length) message.info(`ดึงหัวใบจากไฟล์: ${filled.join(' · ')}`);
                  setImportReport({ matched: res.matched, unmatchedRows: res.unmatchedRows });
                  if (res.unmatchedRows.length === 0)
                    message.success(`นำเข้า ${res.matched} รายการ ครบทุกแถว — ตรวจในตารางแล้วกดบันทึก`);
                } catch {
                  message.error('อ่านไฟล์ไม่สำเร็จ — เช็คว่าเป็น .csv/.xls/.xlsx');
                }
              };
              reader.readAsArrayBuffer(file);
              return false; // ไม่อัปโหลดไปไหน อ่านในเครื่องเท่านั้น
            }}>
            <Button icon={<RiFileExcel2Line className="w-4 h-4" />}>นำเข้าไฟล์</Button>
          </Upload>
        </div>
        {importReport ? (
          <Alert
            className="mb-3"
            type={importReport.unmatchedRows.length ? 'warning' : 'success'}
            showIcon
            closable
            onClose={() => setImportReport(null)}
            message={
              importReport.unmatchedRows.length
                ? `นำเข้าได้ ${importReport.matched} รายการ · ไม่ได้ ${importReport.unmatchedRows.length} แถว (ไม่ถูกนำเข้า — ดูรายการด้านล่าง)`
                : `นำเข้าครบ ${importReport.matched} รายการ`
            }
            description={
              importReport.unmatchedRows.length ? (
                <div>
                  <div className="max-h-40 overflow-y-auto text-[13px]">
                    {importReport.unmatchedRows.map((u) => (
                      <div key={`${u.row}-${u.text}`}>
                        แถว {u.row} · <span className="font-mono">{u.text}</span>
                        {u.name ? ` · ${u.name}` : ''} — {u.why}
                      </div>
                    ))}
                  </div>
                  {importReport.unmatchedRows.some((u) => u.qty && u.qty > 0) ? (
                    <Button
                      className="mt-2"
                      type="primary"
                      loading={creatingDrafts}
                      onClick={() => void createDraftsFromUnmatched()}>
                      สร้างสินค้าร่าง + เพิ่มเข้าใบ ({importReport.unmatchedRows.filter((u) => u.qty && u.qty > 0).length} ตัว)
                    </Button>
                  ) : null}
                </div>
              ) : null
            }
          />
        ) : null}

        <Input
          ref={searchRef}
          data-flight-log="true"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onPressEnter={onSearchEnter}
          placeholder="ยิงบาร์โค้ด หรือพิมพ์ชื่อ/SKU แล้วกด Enter…"
          allowClear
          autoFocus
        />
        {matches.length > 1 ? (
          <div className="border rounded mt-1 divide-y" style={{ borderColor: 'var(--ant-color-border)' }}>
            {matches.map((m) => (
              <button
                key={m.variantId}
                type="button"
                onClick={() => addLine(m)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-black/5">
                <RiAddLine className="w-4 h-4 flex-none" />
                <span className="flex-1">{m.label}</span>
                {m.barcode ? <span className="font-mono text-xs opacity-60">{m.barcode}</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        {lines.length === 0 ? (
          <Empty className="my-6" description="ยิงบาร์โค้ดเพื่อเริ่มใบรับเข้า" />
        ) : (
          <>
            <Table
              className="mt-3"
              rowKey="variantId"
              columns={draftCols}
              dataSource={lines}
              pagination={false}
              size="small"
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-baseline gap-4">
                <span className="text-[15px]">
                  จำนวนรวม <b className="tabular-nums text-[19px]">{lines.reduce((s, l) => s + l.qty, 0)}</b> ชิ้น
                  <span className="text-gray-400"> · {lines.length} รายการ</span>
                </span>
                {total > 0 ? (
                  <span className="text-[15px]">
                    เงินรวม <b className="tabular-nums text-[19px]">{bahtRound(total)}</b>
                  </span>
                ) : null}
              </div>
              <Button type="primary" size="large" loading={saving} onClick={() => void save()}>
                บันทึกรับเข้า
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card title="ประวัติใบรับเข้า" size="small" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          columns={historyCols}
          dataSource={receipts ?? []}
          loading={receipts === null}
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: false }}
          expandable={{
            onExpand: (open, r) => {
              if (open && !lineCache[r.id])
                void getGoodsReceiptLines(r.id).then((ls) =>
                  setLineCache((prev) => ({ ...prev, [r.id]: ls })),
                );
            },
            expandedRowRender: (r) => {
              const ls = lineCache[r.id];
              if (!ls) return <Typography.Text type="secondary">กำลังโหลด…</Typography.Text>;
              return (
                <Table
                  rowKey={(l) => `${r.id}-${l.product_name}-${l.size ?? ''}-${l.barcode ?? ''}`}
                  size="small"
                  pagination={false}
                  dataSource={ls}
                  columns={[
                    { title: 'สินค้า', render: (_, l) => `${l.product_name}${l.size ? ` (${l.size})` : ''}` },
                    { title: 'บาร์โค้ด', dataIndex: 'barcode', width: 150, render: (v) => v ?? '—' },
                    { title: 'จำนวน', dataIndex: 'qty', width: 90, align: 'right' },
                    { title: 'ทุน/หน่วย', dataIndex: 'unit_cost', width: 110, align: 'right',
                      render: (v) => (v != null ? baht(v) : '—') },
                  ]}
                />
              );
            },
          }}
          locale={{ emptyText: <Empty description="ยังไม่มีใบรับเข้า" /> }}
        />
      </Card>

      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        รับของที่นี่ = สต๊อกบวกทันที ลงสมุดสต๊อกทุกบรรทัด · ทุนที่กรอกจะกลายเป็นทุนล่าสุดของสินค้าตัวนั้น
        · ปุ่ม <Tag className="mx-1">เติม</Tag> ในหน้าสต๊อกยังใช้ได้เหมือนเดิมสำหรับของชิ้นเดียวไม่มีเอกสาร
      </Typography.Text>

      {/* ── ใบที่ทำค้างไว้ ──
          ★ ถามก่อน ไม่เติมให้เองเงียบ ๆ ★ ถ้าเติมกลับให้อัตโนมัติ คนที่ตั้งใจจะเริ่มใบใหม่
          จะเผลอบันทึกของเก่าปนเข้าไปโดยไม่ทันสังเกต — ใบรับเข้าบวกสต๊อกจริง ผิดแล้วต้อง
          ไปตามยกเลิกใบ */}
      <Modal
        open={!!restore}
        title="มีใบรับเข้าที่ทำค้างไว้"
        okText="ทำต่อจากเดิม"
        cancelText="เริ่มใบใหม่"
        closable={false}
        maskClosable={false}
        onOk={() => {
          if (!restore) return;
          setSupplier(restore.supplier ?? '');
          setDocNo(restore.docNo ?? '');
          setReceivedAt(restore.receivedAt ? dayjs(restore.receivedAt) : dayjs());
          setImportNote(restore.note ?? null);
          setLines(restore.lines ?? []);
          setRestore(null);
          restoredRef.current = true;
        }}
        onCancel={() => {
          writeDraft(null);
          setRestore(null);
          restoredRef.current = true;
        }}>
        <p style={{ margin: 0 }}>
          ค้างไว้ <b>{restore?.lines.length ?? 0}</b> รายการ
          {restore?.supplier ? <> จาก <b>{restore.supplier}</b></> : null}
          {restore?.savedAt ? <> เมื่อ {thDate(restore.savedAt).format('D MMM HH:mm น.')}</> : null}
        </p>
        <p style={{ marginTop: 8, marginBottom: 0, color: '#8a807a' }}>
          ใบนี้ยังไม่ถูกบันทึกเข้าระบบ สต๊อกยังไม่ขยับ — เลือก “เริ่มใบใหม่” จะลบทิ้งเลย
        </p>
      </Modal>

      {newProduct && (
        <NewProductModal
          code={newProduct.code}
          categories={cats}
          onCancel={() => setNewProduct(null)}
          onCreate={createProductNow}
        />
      )}
    </div>
  );
}

/**
 * กรอกข้อมูลเบื้องต้นของสินค้าใหม่ตอนรับของ — ชื่อ ทุน หมวดหมู่
 *
 * ★ ขอแค่สามช่อง ★ คนรับของยืนอยู่หน้ากองของ ไม่ใช่หน้าจอจัดการสินค้า — ราคาขาย รูป
 * คำอธิบาย ไปตั้งทีหลังในหน้าสินค้าได้ ถ้าขอครบทุกช่องตรงนี้ของจะกองรอจนกว่าจะกรอกเสร็จ
 * สินค้าถูกสร้างเป็นฉบับร่างเสมอ ลูกค้าจึงยังไม่เห็นระหว่างที่ข้อมูลยังไม่ครบ
 */
function NewProductModal({
  code,
  categories,
  onCancel,
  onCreate,
}: {
  code: string;
  categories: { id: string; name: string }[];
  onCancel: () => void;
  onCreate: (v: { name: string; cost?: number; categoryId?: string }) => Promise<void>;
}) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  /* รหัสที่ยิงมาเป็นบาร์โค้ด (ตัวเลข/ตัวอักษรล้วน) → ชื่อยังว่าง ให้กรอกเอง
     ถ้าเป็นคำที่พิมพ์ค้นหา → เอามาเป็นชื่อตั้งต้นเลย คนพิมพ์ก็ตั้งใจจะเรียกของชิ้นนั้นอยู่แล้ว */
  const looksLikeBarcode = /^[0-9A-Za-z-]{6,}$/.test(code);

  return (
    <Modal
      open
      title="สินค้าใหม่ (ยังไม่มีในระบบ)"
      onCancel={onCancel}
      okText="สร้างเป็นร่าง + เพิ่มเข้าใบ"
      cancelText="ยกเลิก"
      confirmLoading={saving}
      onOk={async () => {
        const v = await form.validateFields();
        setSaving(true);
        try {
          await onCreate({
            name: v.name,
            cost: typeof v.cost === 'number' ? v.cost : undefined,
            categoryId: v.categoryId || undefined,
          });
        } finally {
          setSaving(false);
        }
      }}
      destroyOnHidden>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={looksLikeBarcode ? `บาร์โค้ด ${code}` : `ค้นหา "${code}" ไม่พบ`}
        description="สร้างเป็นฉบับร่างก่อน ลูกค้ายังไม่เห็น — ค่อยไปตั้งราคาขายกับรูปในหน้าสินค้าทีหลัง"
      />
      <Form form={form} layout="vertical" initialValues={{ name: looksLikeBarcode ? '' : code }}>
        <Form.Item name="name" label="ชื่อสินค้า" rules={[{ required: true, message: 'กรอกชื่อสินค้า' }]}>
          <Input placeholder="เช่น มาม่าโอเรียนทัลคิทเช่น" autoFocus maxLength={80} />
        </Form.Item>
        <Form.Item name="cost" label="ทุนต่อชิ้น (บาท)" extra="ใส่ไว้เลยจะได้ไม่ต้องกลับมากรอกทีหลัง">
          <InputNumber min={0} style={{ width: '100%' }} addonBefore="฿" />
        </Form.Item>
        <Form.Item name="categoryId" label="หมวดหมู่">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="เลือกหมวดหมู่ (ไม่บังคับ)"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/* แยกไว้ให้ล้มเงียบ ๆ ตอน migration ยังไม่ถูกรัน — หน้าโชว์ว่างเปล่าแทนที่จะพัง */
async function listGoodsReceiptsSafe(): Promise<GoodsReceipt[]> {
  try {
    const { listGoodsReceipts } = await import('../lib/api');
    return await listGoodsReceipts();
  } catch {
    return [];
  }
}

/* ═══ Import ไฟล์รับเข้า (จุดที่เจ้าของย้ำ: "ต้องถูกต้อง") ═══════════════════
 * รับ .csv / .xls / .xlsx — รวมรายงานที่ export จาก Crystal Reports ของ ETS
 * ซึ่งมี 2 กับดักที่เจอจากไฟล์จริง (1.xls, 23 ส.ค.):
 *   - หัวตารางกับตัวข้อมูลอยู่คนละคอลัมน์ (เซลล์ผสานเยื้องกัน 1 ช่อง)
 *   - หัวคอลัมน์สะกดผิดจากต้นทาง ("ราคาชื้อ")
 * จึงไม่ยึดตำแหน่งคอลัมน์ของตัวเลขเลย: เจอรหัสสินค้าในแถวไหน → กวาดเก็บ
 * ตัวเลขทั้งหมดหลังช่องรหัส ตามลำดับ [จำนวน, ราคา, ยอดสุทธิ] แล้ว
 * "ตรวจทานตัวเอง": จำนวน×ราคา ต้องตรงยอดสุทธิในไฟล์ ไม่ตรง = เตือนรายแถว
 * กติกาเดิมคงอยู่: เข้าตารางร่างเท่านั้น · แถวมีปัญหาไม่หายเงียบ (บทเรียน M4)
 */
export type UnmatchedRow = {
  row: number;
  text: string;
  why: string;
  name?: string;
  qty?: number;
  cost?: number;
};

export type FileHead = {
  supplier?: string;
  docNumber?: string;
  refText?: string;
  docDate?: string; // ISO
};

export function parseReceiveFile(
  wb: XLSX.WorkBook,
  items: PickItem[],
): { lines: DraftLine[]; matched: number; unmatchedRows: UnmatchedRow[]; head: FileHead } {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, raw: false, defval: '' });
  if (!rows.length) return { lines: [], matched: 0, unmatchedRows: [], head: {} };

  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
  const BARCODE_H = ['บาร์โค้ด', 'barcode', 'รหัส', 'รหัสสินค้า', 'sku', 'code'];
  const QTY_H = ['จำนวน', 'qty', 'quantity', 'รับเข้า', 'ชิ้น'];
  let headRow = -1;
  let cBar = -1;
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const cells = rows[r].map(norm);
    const bi = cells.findIndex((c) => BARCODE_H.includes(c));
    const qi = cells.findIndex((c) => QTY_H.includes(c));
    if (bi >= 0 && qi >= 0) {
      headRow = r;
      cBar = bi;
      break;
    }
  }
  if (headRow < 0) {
    return { lines: [], matched: 0, unmatchedRows: [{ row: 1, text: '-', why: 'ไม่พบหัวตาราง (ต้องมีคอลัมน์ รหัสสินค้า/บาร์โค้ด และ จำนวน)' }], head: {} };
  }

  /* หัวใบเหนือหัวตาราง (เจ้าของทัก: "ผู้ขาย เลขเอกสาร ก็มีในไฟล์ ทำไมไม่ทำ"):
   *   ผู้ขาย : สามก.ออยล์ · เลขที่เอกสารระบบ : IN2608080001 ·
   *   เลขที่เอกสาร : ขนม (ข้อความอ้างอิง) · วันที่เอกสาร : 2026-08-08
   * label กับค่าอยู่คนละเซลล์ในแถวเดียวกัน — เจอ label แล้วเก็บเซลล์ถัดไปที่ไม่ว่าง */
  const head: FileHead = {};
  const valueAfter = (cells: (string | number)[], from: number): string => {
    for (let j = from + 1; j < cells.length; j++) {
      const t = String(cells[j] ?? '').trim();
      if (t !== '') return t;
    }
    return '';
  };
  for (let r = 0; r < headRow; r++) {
    const cells = rows[r];
    for (let j = 0; j < cells.length; j++) {
      const label = String(cells[j] ?? '').replace(/[:：]/g, '').trim();
      if (label === 'ผู้ขาย' && !head.supplier) head.supplier = valueAfter(cells, j);
      else if (label === 'เลขที่เอกสารระบบ' && !head.docNumber) head.docNumber = valueAfter(cells, j);
      else if (label === 'เลขที่เอกสาร' && !head.refText) head.refText = valueAfter(cells, j);
      else if ((label === 'วันที่เอกสาร' || label === 'วันที่') && !head.docDate) {
        const raw = valueAfter(cells, j);
        let d = dayjs(raw, ['YYYY-MM-DD', 'DD/MM/YYYY', 'D/M/YYYY'], true);
        if (d.isValid()) {
          // ปี พ.ศ. จากบางรายงาน → แปลงเป็น ค.ศ.
          if (d.year() > 2400) d = d.subtract(543, 'year');
          head.docDate = d.toISOString();
        }
      }
    }
  }

  const byBarcode = new Map(items.filter((i) => i.barcode).map((i) => [i.barcode as string, i]));
  const bySku = new Map(items.filter((i) => i.sku).map((i) => [(i.sku as string).toLowerCase(), i]));
  const num = (v: unknown): number | null => {
    const t = String(v ?? '').trim().replace(/,/g, '');
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  const acc = new Map<string, DraftLine>();
  const unmatchedRows: UnmatchedRow[] = [];
  for (let r = headRow + 1; r < rows.length; r++) {
    const cells = rows[r];
    // หาช่องรหัส: ตำแหน่งหัวตารางก่อน · เยื้องได้ ±2 ช่อง (นิสัย Crystal)
    let barIdx = -1;
    for (const j of [cBar, cBar - 1, cBar + 1, cBar - 2, cBar + 2]) {
      if (j >= 0 && String(cells[j] ?? '').trim() !== '') { barIdx = j; break; }
    }
    if (barIdx < 0) continue; // แถวคั่น/แถวว่างของรายงาน — ข้ามเงียบได้
    const rawBar = String(cells[barIdx] ?? '').trim();
    if (!rawBar || BARCODE_H.includes(rawBar.toLowerCase())) continue;

    const item = byBarcode.get(rawBar) ?? bySku.get(rawBar.toLowerCase());
    if (!item) {
      // แถวสรุปท้ายรายงาน (เช่น "รวม") ไม่ใช่รหัส — รายงานเฉพาะที่หน้าตาเป็นรหัสจริง
      if (/^[0-9A-Za-z-]{3,}$/.test(rawBar)) {
        // เก็บ ชื่อ+จำนวน+ทุน จากไฟล์ไว้ด้วย — ปุ่ม "สร้างสินค้าร่าง" ใช้ต่อได้เลย
        let fname = '';
        for (let j = barIdx + 1; j < cells.length; j++) {
          const t = String(cells[j] ?? '').trim();
          if (t !== '' && num(cells[j]) === null && t.length > fname.length) fname = t;
        }
        const fnums: number[] = [];
        for (let j = barIdx + 1; j < cells.length; j++) {
          const n = num(cells[j]);
          if (n !== null) fnums.push(n);
        }
        unmatchedRows.push({
          row: r + 1,
          text: rawBar,
          why: 'ไม่พบสินค้าในระบบ (บาร์โค้ด/SKU ไม่ตรง)',
          name: fname || undefined,
          qty: fnums.length && Math.floor(fnums[0]) > 0 ? Math.floor(fnums[0]) : undefined,
          cost: fnums.length >= 2 ? fnums[1] : undefined,
        });
      }
      continue;
    }

    // กวาดตัวเลขทุกช่องหลังช่องรหัส → [จำนวน, ราคา, ยอดสุทธิ]
    const nums: number[] = [];
    for (let j = barIdx + 1; j < cells.length; j++) {
      const n = num(cells[j]);
      if (n !== null) nums.push(n);
    }
    if (nums.length === 0) {
      unmatchedRows.push({ row: r + 1, text: rawBar, why: 'ไม่พบตัวเลขจำนวนในแถว' });
      continue;
    }
    const qty = Math.floor(nums[0]);
    if (qty <= 0) {
      unmatchedRows.push({ row: r + 1, text: rawBar, why: `จำนวนไม่ถูกต้อง (${nums[0]})` });
      continue;
    }
    const cost = nums.length >= 2 ? nums[1] : null;
    // ตรวจทานตัวเอง: จำนวน×ราคา ต้องตรงยอดสุทธิในไฟล์ (เผื่อเศษปัดทศนิยม)
    if (cost != null && nums.length >= 3) {
      const expect = qty * cost;
      if (Math.abs(expect - nums[2]) > Math.max(0.5, expect * 0.01)) {
        unmatchedRows.push({
          row: r + 1,
          text: rawBar,
          why: `เช็คยอด: ${qty}×${cost} = ${expect.toFixed(2)} ไม่ตรงยอดในไฟล์ ${nums[2]} — นำเข้าแล้ว โปรดตรวจ`,
        });
      }
    }
    const prev = acc.get(item.variantId);
    if (prev) {
      prev.qty += qty;
      if (cost != null) prev.unitCost = cost;
    } else {
      acc.set(item.variantId, { ...item, qty, unitCost: cost ?? item.cost });
    }
  }
  return { lines: [...acc.values()], matched: acc.size, unmatchedRows, head };
}

/* ═══ พิมพ์ใบรับเข้า — iframe ซ่อน (ธรรมเนียมเดียวกับ printOrder: ไม่มีหน้าต่างเด้ง) ═══ */
const esc = (v: string | null | undefined) =>
  (v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function printReceiptSheet(
  head: { receipt_number: string; supplier?: string | null; doc_number?: string | null; received_at: string },
  lines: { productName: string; size: string | null; barcode: string | null; qty: number; unitCost: number | null }[],
  _viaDialog = false,
) {
  const money = (n: number) => `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
  /* ใบพิมพ์ใช้กติกาเดียวกับหน้าจอ — ใบที่พิมพ์ออกมาแล้วยอดไม่ตรงกับที่เห็นตอนกดบันทึก
     คือปัญหาที่อธิบายกับซัพพลายเออร์ไม่ได้ */
  const moneyRound = (n: number) =>
    `฿${Math.round(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const total = lines.reduce((s, l) => s + Math.round((l.unitCost ?? 0) * l.qty), 0);
  const pieces = lines.reduce((s, l) => s + l.qty, 0);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:'Noto Sans Thai',Sarabun,sans-serif;font-size:13px;color:#111;margin:24px}
    h1{font-size:18px;margin:0 0 2px} .m{color:#555;margin:0 0 14px}
    table{width:100%;border-collapse:collapse}
    th{font-size:11px;text-align:left;border-bottom:2px solid #111;padding:4px 6px}
    td{border-bottom:1px solid #ddd;padding:4px 6px}
    .r{text-align:right;font-variant-numeric:tabular-nums}
    tfoot td{border:0;font-weight:700;padding-top:10px}
  </style></head><body>
    <h1>ใบรับเข้าสินค้า ${esc(head.receipt_number)}</h1>
    <p class="m">วันที่รับ ${thDate(head.received_at).format('DD/MM/YYYY')}${head.supplier ? ` · ผู้ขาย ${esc(head.supplier)}` : ''}${head.doc_number ? ` · เอกสาร ${esc(head.doc_number)}` : ''}</p>
    <table>
      <thead><tr><th>บาร์โค้ด</th><th>สินค้า</th><th class="r">จำนวน</th><th class="r">ทุน/หน่วย</th><th class="r">รวม</th></tr></thead>
      <tbody>${lines.map((l) => `<tr>
        <td>${esc(l.barcode ?? '-')}</td>
        <td>${esc(l.productName)}${l.size ? ` (${esc(l.size)})` : ''}</td>
        <td class="r">${l.qty}</td>
        <td class="r">${l.unitCost != null ? money(l.unitCost) : '-'}</td>
        <td class="r">${l.unitCost != null ? moneyRound(l.unitCost * l.qty) : '-'}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="2">รวม ${lines.length} รายการ</td><td class="r">${pieces} ชิ้น</td><td></td><td class="r">${moneyRound(total)}</td></tr></tfoot>
    </table>
  </body></html>`;
  const frame = document.createElement('iframe');
  frame.style.display = 'none';
  document.body.appendChild(frame);
  frame.srcdoc = html;
  frame.onload = () => {
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  };
}
