/**
 * แถบล่างของโหมดออนไลน์ — เจ้าของสั่ง 5 ก.ย. 2026 "พอกดเข้าไปในออนไลน์อะครับจะมี
 * bottom bar มี 5 เมนู หน้าหลัก โค้ดส่วนลด ตะกร้าสินค้า สินค้าโปรด บัญชีของฉัน"
 *
 * ★ ทำเป็นตัวนำทางของตัวเอง ไม่ใช่แถบลอย ๆ ที่วาดทับ ★ ถ้าแค่วาดแถบไว้บนหน้าร้าน
 * แล้วกดเมนูให้กระโดดไปเส้นทางเดิมของแอป พอไปถึงตะกร้าหรือบัญชี แถบล่างจะกลายเป็น
 * แถบหลักของแอปทันที ลูกค้าหลุดออกจากโหมดออนไลน์โดยไม่รู้ตัว การเป็นตัวนำทางจริง
 * ทำให้ทั้งห้าเมนูอยู่ในโหมดออนไลน์ตลอด
 *
 * หน้าโค้ดส่วนลด / ตะกร้า / บัญชี ใช้จอเดิมทั้งดุ้น ไม่ได้ก๊อป — ดูไฟล์ในโฟลเดอร์นี้
 */

import { Tabs } from 'expo-router';

import { TabBar } from '@/components/navigation/TabBar';
import { ONLINE_ACCENT } from '@/constants/online';

/** เมนูทั้งห้า — ชื่อและลำดับตามที่เจ้าของสั่งมาเป๊ะ ไม่ใช่คำสั้นแบบแถบหลักของแอป */
const ONLINE_TABS = {
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
  /* ตะกร้าเป็นปุ่มกลางที่ยกขึ้น — ในโหมดออนไลน์ตะกร้าคือปลายทางของทุกอย่างที่ลูกค้าทำ
     (แถบหลักของแอปยก "คำสั่งซื้อ" ขึ้นด้วยเหตุผลเดียวกัน) */
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

export default function OnlineLayout() {
  return (
    <Tabs
      /* น้ำเงินตามโหมด ไม่ใช่ส้มของแบรนด์ — ทั้งโหมดเป็นน้ำเงินหมดแล้ว แถบล่างเป็น
         ส้มอยู่อันเดียวจะโดดออกมาทันที (เจ้าของทัก 5 ก.ย. 2026 "สีต้องเป็นสีน้ำเงินสิครับ") */
      tabBar={(props) => <TabBar {...props} tabs={ONLINE_TABS} accent={ONLINE_ACCENT} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="coupons" />
      <Tabs.Screen name="cart" />
      <Tabs.Screen name="favorites" />
      <Tabs.Screen name="account" />
      {/* หน้าหมวดหมู่ — ไม่มีในตาราง ONLINE_TABS แถบจึงข้ามไป (TabBar ข้ามเส้นทางที่ไม่มี
          ข้อมูลอยู่แล้ว) แต่ยังได้แถบล่างติดไปด้วยตอนเลื่อนดูสินค้าในหมวด ซึ่งถูกแล้ว */}
      <Tabs.Screen name="[cat]" />
    </Tabs>
  );
}
