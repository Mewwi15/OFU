/**
 * สินค้าโปรด — ตาราง `favorites` (0101)
 *
 * RLS ปล่อยเฉพาะแถวของตัวเอง จึงไม่ต้องส่ง user_id ไปกรองเอง ยกเว้นตอนเขียนที่ต้องใส่
 * เพราะคอลัมน์เป็น not null (นโยบาย with check เป็นตัวกันไม่ให้ใส่เป็นคนอื่น)
 */

import { supabase } from '@/lib/supabase/client';

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('UNAUTHENTICATED');
  return data.user.id;
}

/** id ของสินค้าที่กดโปรดไว้ ใหม่ก่อนเก่า */
export async function listFavoriteIds(): Promise<string[]> {
  const { data, error } = await supabase
    .from('favorites')
    .select('product_id')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as { product_id: string }[]).map((r) => r.product_id);
}

export async function addFavorite(productId: string): Promise<void> {
  const userId = await uid();
  /* กดรัว ๆ หรือกดจากสองหน้าจอพร้อมกันแล้วชนกันได้ — คีย์หลักคู่ (user_id, product_id)
     กันซ้ำอยู่แล้ว ให้ครั้งที่สองเงียบแทนที่จะเด้ง error ใส่หน้าลูกค้า */
  const { error } = await supabase
    .from('favorites')
    .upsert({ user_id: userId, product_id: productId }, { onConflict: 'user_id,product_id' });
  if (error) throw error;
}

export async function removeFavorite(productId: string): Promise<void> {
  const userId = await uid();
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);
  if (error) throw error;
}
