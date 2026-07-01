/**
 * Default profile avatar (the อู้ฟู่ tiger mascot). Used when the user hasn't
 * uploaded their own photo. `avatarSource` picks the uploaded URL when present,
 * otherwise the bundled default asset.
 */

import type { ImageSource } from 'expo-image';

// require() returns a bundled-asset module id (a number) — a valid expo-image source.
export const DEFAULT_AVATAR = require('@/assets/images/avartar.png') as number;

export function avatarSource(avatar?: string | null): ImageSource | number {
  return avatar ? { uri: avatar } : DEFAULT_AVATAR;
}
