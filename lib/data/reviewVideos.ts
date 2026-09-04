/**
 * คลังคลิปรีวิวสินค้า — ตาราง `review_videos` (0099)
 *
 * อ่านอย่างเดียวจากฝั่งแอป ลูกค้าเขียนอะไรไม่ได้เลย (RLS ปล่อยเฉพาะ select และเฉพาะ
 * แถวที่เผยแพร่แล้ว) การเพิ่ม/แก้/ลบทำที่หลังร้านผ่าน RPC ของแอดมินเท่านั้น
 */

import { supabase } from '@/lib/supabase/client';

export type ReviewVideo = {
  id: string;
  /** URL เต็มของไฟล์วิดีโอ พร้อมส่งให้ตัวเล่นได้เลย */
  video: string;
  /** ภาพปก — โชว์ระหว่างรอคลิปโหลด null = ไม่ได้ตั้งไว้ */
  poster: string | null;
  caption: string | null;
  /** สินค้าที่คลิปนี้รีวิว — null = ไม่ได้ผูก (หรือสินค้าถูกลบไปแล้ว) */
  productId: string | null;
};

type Row = {
  id: string;
  video_path: string;
  poster_path: string | null;
  caption: string | null;
  product_id: string | null;
};

/**
 * แปลง path ในบักเก็ตเป็น URL เต็ม
 *
 * ฐานข้อมูลเก็บ path ล้วน ไม่ใช่ URL — โดเมนของ storage เปลี่ยนได้ตอนย้ายโปรเจกต์
 * ถ้าเก็บ URL เต็มไว้ทุกแถวจะต้องไล่แก้ทั้งตาราง ประกอบเอาตอนอ่านจึงถูกต้องเสมอ
 * ถ้าเผลอเก็บ URL เต็มมาแล้ว (ข้อมูลเก่า) ก็ปล่อยผ่านไปตรง ๆ ไม่ประกอบซ้ำ
 */
function publicUrl(bucket: string, path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** คลิปรีวิวที่เผยแพร่แล้ว เรียงตามลำดับที่หลังร้านจัดไว้ */
export async function listReviewVideos(): Promise<ReviewVideo[]> {
  const { data, error } = await supabase
    .from('review_videos')
    .select('id, video_path, poster_path, caption, product_id')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as Row[])
    .map((r) => ({
      id: r.id,
      video: publicUrl('review-videos', r.video_path) as string,
      poster: publicUrl('product-images', r.poster_path),
      caption: r.caption,
      productId: r.product_id,
    }))
    /* กันแถวที่ประกอบ URL ไม่ได้ — คลิปที่เล่นไม่ได้ทำให้แถวมีช่องดำค้างอยู่
       ซึ่งดูเหมือนแอปพังมากกว่าการไม่มีคลิปนั้นเลย */
    .filter((v) => !!v.video);
}
