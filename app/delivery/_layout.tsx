/**
 * แถบล่างของโหมดเดลิเวอรี่ — เจ้าของสั่ง 5 ก.ย. 2026 "ทำ bottom bar ในหน้า delivery
 * ด้วยครับ ให้เหมือน ONLINE แต่สีส้มนะครับ"
 *
 * ★ ทำเป็นตัวนำทางของตัวเอง ไม่ใช่แถบลอย ๆ ที่วาดทับ ★ เหตุผลเดียวกับฝั่งออนไลน์: ถ้าแค่
 * วาดแถบไว้บนหน้าร้านแล้วกดเมนูให้กระโดดไปเส้นทางเดิมของแอป พอไปถึงตะกร้าหรือบัญชี
 * แถบล่างจะกลายเป็นแถบหลักของแอปทันที ลูกค้าหลุดออกจากโหมดโดยไม่รู้ตัว
 *
 * ★ ก๊อปตารางเมนู ไม่ก๊อปตัวแถบ ★ ตัวแถบ (components/navigation/TabBar) เป็นตัวเดียวกัน
 * ทั้งสองโหมด ส่งตารางเมนูกับชุดสีเข้าไปเท่านั้น — ระยะ เงา ปุ่มกลางที่ยกขึ้น จังหวะสั่น
 * จะได้เหมือนกันตลอด แก้ที่เดียวขยับทั้งสองแถบ
 *
 * หน้าโค้ดส่วนลด / ตะกร้า / บัญชี ใช้จอเดิมทั้งดุ้น ส่วนสินค้าโปรดใช้จอกลางร่วมกับฝั่ง
 * ออนไลน์ ต่างแค่ชุดสี — ดูไฟล์ในโฟลเดอร์นี้
 */

import { Tabs, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { TabBar } from '@/components/navigation/TabBar';
import { BRAND_ACCENT } from '@/constants/accent';
import { useMode, type ShopMode } from '@/store/mode';

/** เมนูทั้งห้า — ชุดเดียวกับโหมดออนไลน์เป๊ะ ตามที่เจ้าของสั่งว่า "ให้เหมือน ONLINE" */
const DELIVERY_TABS = {
  index: {
    labelKey: 'tab.home',
    label: 'หน้าหลัก',
    active: 'home' as const,
    inactive: 'home-outline' as const,
  },
  coupons: {
    labelKey: 'tab.coupons',
    label: 'โค้ดส่วนลด',
    active: 'pricetag' as const,
    inactive: 'pricetag-outline' as const,
  },
  /* ตะกร้าเป็นปุ่มกลางที่ยกขึ้น — ตะกร้าคือปลายทางของทุกอย่างที่ลูกค้าทำในโหมดร้านค้า */
  cart: {
    labelKey: 'tab.cart',
    label: 'ตะกร้าสินค้า',
    active: 'cart' as const,
    inactive: 'cart-outline' as const,
    raised: true,
  },
  favorites: {
    labelKey: 'tab.favorites',
    label: 'สินค้าโปรด',
    active: 'heart' as const,
    inactive: 'heart-outline' as const,
  },
  account: {
    labelKey: 'tab.account',
    label: 'บัญชีของฉัน',
    active: 'person' as const,
    inactive: 'person-outline' as const,
  },
};


/**
 * เข้ากลุ่มนี้ = อยู่โหมดเดลิเวอรี่ ★ ตั้งโหมดที่ตัวนำทาง ไม่ใช่ที่จอเตรียมพร้อมอย่างเดียว ★
 *
 * ตะกร้ากับหน้าชำระเงินอ่านโหมดจาก useMode เพื่อเลือกว่าจะใช้ใบไหน — เดิมมีแต่จอเตรียม
 * พร้อม (delivery-check) ที่ตั้งค่าให้ พอแถบล่างมีเมนูตะกร้าอยู่ในตัว ใครที่เข้าหน้าร้าน
 * ได้โดยไม่ผ่านจอนั้น (กดย้อนกลับ เปิดจากลิงก์ หรือแอปจำหน้าสุดท้ายไว้) จะกดตะกร้าแล้ว
 * เจอใบของอีกโหมด — เจอจริงตอนทดสอบบนซิม 5 ก.ย. 2026: เข้า /delivery แล้วกดตะกร้า
 * ได้ใบพัสดุสีน้ำเงินขึ้นมา
 *
 * ผูกกับ "จอได้โฟกัส" ไม่ใช่แค่ตอนโหลดครั้งแรก เพราะกลุ่มนี้ค้างอยู่ในสแตกได้ กลับเข้ามา
 * อีกครั้งต้องตั้งโหมดใหม่เสมอ
 */
function useLockMode(mode: ShopMode) {
  useFocusEffect(
    useCallback(() => {
      if (useMode.getState().mode !== mode) useMode.getState().setMode(mode);
    }, [mode]),
  );
}

export default function DeliveryLayout() {
  useLockMode('delivery');

  return (
    <Tabs
      /* ส้มของแบรนด์ — ทั้งโหมดเป็นส้มอยู่แล้ว (หัวจอ ปุ่มบนการ์ดสินค้า ลิงก์ดูทั้งหมด)
         แถบล่างจึงต้องเป็นส้มตัวเดียวกัน ไม่ใช่สีอื่นมาโดดอยู่ท้ายจอ */
      tabBar={(props) => <TabBar {...props} tabs={DELIVERY_TABS} accent={BRAND_ACCENT} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="coupons" />
      <Tabs.Screen name="cart" />
      <Tabs.Screen name="favorites" />
      <Tabs.Screen name="account" />
      {/* หน้าหมวดหมู่ — ไม่มีในตาราง DELIVERY_TABS แถบจึงข้ามไป (TabBar ข้ามเส้นทางที่ไม่มี
          ข้อมูลอยู่แล้ว) แต่ยังได้แถบล่างติดไปด้วยตอนเลื่อนดูสินค้าในหมวด ซึ่งถูกแล้ว */}
      <Tabs.Screen name="[cat]" />
    </Tabs>
  );
}
