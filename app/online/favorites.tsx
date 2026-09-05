/** สินค้าโปรดของโหมดออนไลน์ — จอกลาง (components/shop/FavoritesScreen) ชุดสีน้ำเงิน */
import { FavoritesScreen } from '@/components/shop/FavoritesScreen';
import { ONLINE_ACCENT } from '@/constants/online';

export default function OnlineFavoritesScreen() {
  return <FavoritesScreen accent={ONLINE_ACCENT} shopHref="/online" />;
}
