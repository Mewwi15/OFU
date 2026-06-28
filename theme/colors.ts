/**
 * BNA UI color tokens — Family B adapter for the อู้ฟู่ brand (7-Eleven green/orange).
 *
 * Now a THIN, no-hex adapter over the single source of truth `theme/tokens.ts`.
 * BNA `components/ui/*` keep reading colors via `useColor()` (which reads the
 * `Colors.light`/`Colors.dark` shape exported here), but every value is declared
 * exactly once in `theme/tokens.ts`. v1 is light-only: `darkColors` is a
 * key-complete projection of light so `useColor`'s `keyof light & keyof dark`
 * intersection and React Navigation's DarkTheme never break.
 *
 * See `docs/08-design-system.md`. AA: `primary`/`destructive` project the
 * *Strong text-bearing fills; vivid brand hues live under `tint`/`orange`.
 */

import { bnaColors, bnaDarkColors, bnaLightColors } from '@/theme/tokens';

export const Colors = bnaColors;

// Individual schemes for easier access (kept for API parity).
export const lightColors = bnaLightColors;
export const darkColors = bnaDarkColors;

// Utility type for color keys.
export type ColorKeys = keyof typeof bnaLightColors;

/** Get a color with opacity (hex or rgba in, rgba out). */
export const withOpacity = (color: string, opacity: number): string => {
  if (color.startsWith('rgba')) {
    return color;
  }
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
};
