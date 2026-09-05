/** สินค้าโปรดของโหมดเดลิเวอรี่ — จอเดียวกับฝั่งออนไลน์ ต่างที่ชุดสีส้มของแบรนด์ */
import { FavoritesScreen } from '@/components/shop/FavoritesScreen';
import { BRAND_ACCENT } from '@/constants/accent';

export default function DeliveryFavoritesScreen() {
  return <FavoritesScreen accent={BRAND_ACCENT} shopHref="/delivery" />;
}
