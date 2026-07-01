/**
 * Category artwork — `<CategoryIcon category="ของสด" />`.
 *
 * Renders the owner-designed illustrated category tiles (green rounded squares
 * with soft 3D product art, sliced from assets/icon-src/icon.png into
 * assets/images/categories/*). One tile per catalog category; the tile already
 * carries its own background + rounded corners, so it is shown standalone (no
 * wrapper chip). Falls back to the "all" basket tile for any unknown category.
 */

import { Image } from 'expo-image';

type Props = {
  category: string;
  size?: number;
};

/** Per-category illustrated tile (PNG, transparent rounded corners). Unknown
 *  (admin-added) categories fall back to the "all" basket tile. */
const TILES: Record<string, ReturnType<typeof require>> = {
  ทั้งหมด: require('@/assets/images/categories/cat-all.png'),
  ของสด: require('@/assets/images/categories/cat-fresh.png'),
  เครื่องดื่ม: require('@/assets/images/categories/cat-drinks.png'),
  ของแห้ง: require('@/assets/images/categories/cat-dry.png'),
  ของใช้ในบ้าน: require('@/assets/images/categories/cat-home.png'),
  ขนม: require('@/assets/images/categories/cat-snacks.png'),
  ยา: require('@/assets/images/categories/cat-medicine.png'),
};

export function CategoryIcon({ category, size = 56 }: Props) {
  const source = TILES[category] ?? TILES['ทั้งหมด'];
  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
