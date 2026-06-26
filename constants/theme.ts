/**
 * Stylo design tokens.
 *
 * This file is the single source of truth for colors, spacing, radii, shadows,
 * and typography. Screens and components MUST import from here — never hardcode
 * hex colors or magic spacing numbers.
 *
 * NOTE: The `Colors` export also carries `light`/`dark` sub-objects so the
 * template's `useThemeColor` hook and a couple of legacy template screens keep
 * compiling. New code should use the flat Stylo palette keys (e.g.
 * `Colors.primary`, `Colors.background`).
 */

import { Platform, type TextStyle } from 'react-native';

/* -------------------------------------------------------------------------- */
/*  Colors                                                                     */
/* -------------------------------------------------------------------------- */

const palette = {
  /** App screen background, warm cream/peach. */
  background: '#FBEFE9',
  /** Slightly lighter sections. */
  backgroundAlt: '#FDF4F0',
  /** Card / elevated surface. */
  surface: '#FFFFFF',
  /** Coral accent — buttons, active tab pill, badges, etc. */
  primary: '#F2683C',
  /** Pressed state for coral elements. */
  primaryDark: '#DA552B',
  /** Light coral fill, e.g. inactive backgrounds. */
  primaryTint: '#FCE7DE',
  /** Primary text. */
  text: '#1E1E1E',
  /** Muted / secondary text. */
  textMuted: '#9B9B9B',
  /** Text drawn on top of the primary color. */
  textOnPrimary: '#FFFFFF',
  /** Rating stars, filled gold. */
  star: '#FBA72A',
  /** Hairline borders. */
  border: '#F0E6E0',
  /** Delete / trash actions. */
  danger: '#E5484D',
  /** Color swatch outline. */
  swatchBorder: '#E5E5E5',
  /** Translucent dark scrim over imagery (e.g. promo banner). */
  scrim: 'rgba(30,30,30,0.4)',
  /** Translucent white, e.g. inactive banner dot. */
  whiteAlpha: 'rgba(255,255,255,0.5)',
} as const;

/**
 * Stylo color tokens (flat). Also exposes `light`/`dark` sub-objects for
 * backward compatibility with the template's `useThemeColor` hook.
 */
export const Colors = {
  ...palette,
  light: {
    text: palette.text,
    background: palette.background,
    tint: palette.primary,
    icon: palette.textMuted,
    tabIconDefault: palette.textMuted,
    tabIconSelected: palette.primary,
  },
  dark: {
    text: palette.text,
    background: palette.background,
    tint: palette.primary,
    icon: palette.textMuted,
    tabIconDefault: palette.textMuted,
    tabIconSelected: palette.primary,
  },
} as const;

/* -------------------------------------------------------------------------- */
/*  Spacing                                                                    */
/* -------------------------------------------------------------------------- */

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  x2: 24,
  x3: 32,
} as const;

/* -------------------------------------------------------------------------- */
/*  Radius                                                                     */
/* -------------------------------------------------------------------------- */

export const Radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

/* -------------------------------------------------------------------------- */
/*  Shadow                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Soft card shadow. Spread into a style object:
 * `style={{ ...Shadow.card }}`.
 */
export const Shadow = {
  card: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: {
      elevation: 3,
    },
    default: {},
  }),
} as const;

/* -------------------------------------------------------------------------- */
/*  Fonts                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Poppins font-family name strings. The values match the export names from
 * `@expo-google-fonts/poppins` and the keys loaded in `app/_layout.tsx` via
 * `useFonts`.
 */
export const PoppinsFonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  boldItalic: 'Poppins_700Bold_Italic',
} as const;

/**
 * Legacy template font map (system fonts). Kept so the template's
 * `explore.tsx` keeps compiling until it is removed in part 2.
 */
export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

/* -------------------------------------------------------------------------- */
/*  Typography                                                                 */
/* -------------------------------------------------------------------------- */

export type TypographyVariant =
  | 'display'
  | 'banner'
  | 'h1'
  | 'h2'
  | 'body'
  | 'caption'
  | 'price'
  | 'button';

/**
 * Per-variant text styles (fontFamily + fontSize + sensible line height).
 * Consumed by `AppText` (components/ui/Text.tsx).
 */
export const Typography: Record<TypographyVariant, TextStyle> = {
  /** Brand "Stylo". */
  display: {
    fontFamily: PoppinsFonts.boldItalic,
    fontSize: 26,
    lineHeight: 32,
  },
  /** Promo banner headline (larger than h1). */
  banner: {
    fontFamily: PoppinsFonts.semiBold,
    fontSize: 22,
    lineHeight: 28,
  },
  /** Screen title. */
  h1: {
    fontFamily: PoppinsFonts.semiBold,
    fontSize: 20,
    lineHeight: 26,
  },
  /** Card title. */
  h2: {
    fontFamily: PoppinsFonts.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  /** Body copy. */
  body: {
    fontFamily: PoppinsFonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  /** Caption / muted. */
  caption: {
    fontFamily: PoppinsFonts.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  /** Price. */
  price: {
    fontFamily: PoppinsFonts.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  /** Button label. */
  button: {
    fontFamily: PoppinsFonts.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
};
