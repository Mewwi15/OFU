/**
 * อู้ฟู่ design tokens — Family A flat adapter.
 *
 * This file is now a THIN, no-hex adapter over the single source of truth
 * `theme/tokens.ts`. Screens and bespoke components keep importing `Colors`,
 * `Spacing`, `Radius`, `Shadow`, `Typography` from here unchanged, but every
 * value is declared exactly once in `theme/tokens.ts` (so the old two-palette
 * drift is structurally impossible).
 *
 * NEW code should prefer `import { tokens } from '@/theme/tokens'` directly.
 *
 * Color accessibility note: text/behind-white-text colors use the `*Strong`
 * tokens (e.g. `Colors.primaryStrong`, `Colors.accentStrong`) which pass WCAG
 * AA; the vivid brand tokens (`Colors.primary`, `Colors.accent`) are for
 * non-text fills/decorative use only. See `docs/08-design-system.md`.
 */

import type { TextStyle } from 'react-native';

import { flatColors, tokens } from '@/theme/tokens';

export { tokens };

/* -------------------------------------------------------------------------- */
/*  Colors (flat) — projection of tokens.color                                 */
/* -------------------------------------------------------------------------- */

export const Colors = flatColors;

/* -------------------------------------------------------------------------- */
/*  Spacing / Radius / Shadow — projections of the token primitives            */
/* -------------------------------------------------------------------------- */

export const Spacing = tokens.spacing;

export const Radius = tokens.radius;

/**
 * Soft shadows. `card` = subtle resting elevation; `float` = a softer, larger
 * shadow for cards that should feel lifted (Oroshi look). Spread into a style:
 * `style={{ ...Shadow.float }}`.
 */
export const Shadow = {
  card: tokens.elevation.e1,
  float: tokens.elevation.e2,
} as const;

/* -------------------------------------------------------------------------- */
/*  Fonts                                                                      */
/* -------------------------------------------------------------------------- */

/** App font-family name strings — Mitr (matches `useFonts` keys in app/_layout.tsx). */
export const AppFonts = tokens.font;

/* -------------------------------------------------------------------------- */
/*  Typography — canonical Thai-tuned scale (projected to plain TextStyle)      */
/* -------------------------------------------------------------------------- */

export type TypographyVariant = keyof typeof tokens.type;

/**
 * Per-variant text styles (fontFamily + fontSize + Thai-tuned lineHeight).
 * Projected from `tokens.type`, dropping the non-style metadata
 * (`maxFontSizeMultiplier`, `wcag`) so each entry is a clean `TextStyle`.
 */
export const Typography = Object.fromEntries(
  Object.entries(tokens.type).map(
    ([key, { maxFontSizeMultiplier, wcag, ...style }]) => [key, style],
  ),
) as Record<TypographyVariant, TextStyle>;
