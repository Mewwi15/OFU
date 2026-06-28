/**
 * theme/tokens.ts — อู้ฟู่ design system, THE single source of truth.
 *
 * This is the ONLY file allowed to contain raw hex / sizing literals.
 * - Tier 1  `ref.*`          primitives (hue+scale)
 * - Tier 2  `tokens.color.*` + tokens.{spacing,layout,radius,elevation,motion,a11y,type}
 * - Tier 3  adapters (bottom): `flatColors` (Family A) and `bnaLightColors`/`bnaDarkColors`
 *           (Family B) are PURE projections — no hex — re-exported by constants/theme.ts
 *           and theme/colors.ts so a value is declared exactly once.
 *
 * Every color carries the WCAG ratio computed by the authoritative contrast pass.
 * v1 is LIGHT-ONLY: the dark projection is key-complete (= light) so React Navigation
 * DarkTheme and useColor's `keyof light & keyof dark` intersection never break.
 */

import { Platform, type TextStyle } from 'react-native';

/* -------------------------------------------------------------------------- */
/*  Tier 1 — ref primitives (the only hex)                                     */
/* -------------------------------------------------------------------------- */

const ref = {
  // neutrals
  white: '#FFFFFF',
  ink: '#1E1E1E', // primary text 16.67:1 / canvas 15.02:1
  gray50: '#F2F3F5', // app canvas
  gray100: '#EEF1F3', // muted surface
  gray150: '#ECEFF1', // hairline border (decorative)
  gray300: '#E5E5E5', // swatch outline (decorative)
  gray500: '#929292', // STRONG/visible control+input outline — 3.11:1 on white
  gray600: '#6A6A6A', // accessible muted text/icon — 5.41:1 white / 4.87:1 canvas

  // green
  green500: '#00A94F', // brand fill (graphic) — 3.09:1 on white
  green600: '#018A3F', // header gradient end (decorative, no AA req)
  green700: '#017A3A', // accessible green text + text-bearing fill — 5.46:1 white
  greenTint: '#E2F5E9', // decorative tint

  // orange (deepened — #F5821F retired: 2.59:1 fails even 3:1)
  orange500: '#E06C0A', // brand fill (graphic) — 3.32:1 on white
  orange700: '#B23E0A', // accessible orange text + text-bearing fill — 5.86:1 white
  orangeTint: '#FDECD9', // decorative tint

  // red
  red500: '#E5484D', // danger graphic / trash icon — 3.91:1 (NOT for label text)
  red700: '#C9252B', // accessible danger text + fill behind white — 5.55:1

  // amber / star
  amber500: '#FBA72A', // decorative star — 1.97:1 (must pair w/ numeric value)
  amber700: '#9C6B08', // accessible informative star — 4.65:1 white / 4.18:1 canvas

  // reserved status (NOT in the verifier's tested set — verify before first use)
  blueInfo: '#2563EB',

  // iOS system passthroughs — decorative/native only, NOT AA-guaranteed
  sysBlue: '#007AFF', sysGreen: '#34C759', sysRed: '#E5484D', sysYellow: '#FFCC00',
  sysPink: '#FF7DA8', sysPurple: '#AF52DE', sysTeal: '#5AC8FA', sysIndigo: '#5856D6',

  // overlays
  scrim: 'rgba(30,30,30,0.55)', // deepened from 0.40
  whiteAlpha: 'rgba(255,255,255,0.5)',
} as const;

/* -------------------------------------------------------------------------- */
/*  Tier 2 — semantic color tokens (role → ref)                                */
/* -------------------------------------------------------------------------- */

const color = {
  bg: { canvas: ref.gray50 },
  surface: { base: ref.white, muted: ref.gray100 },

  text: {
    default: ref.ink,           // 16.67:1 white / 15.02:1 canvas — PASS
    muted: ref.gray600,         // 5.41:1 white / 4.87:1 canvas — PASS
    inverse: ref.white,         // on *Strong fills below
    brandGreen: ref.green700,   // 5.46:1 white / 4.92:1 canvas / 4.80:1 on greenTint — PASS
    brandOrange: ref.orange700, // 5.86:1 white / 5.27:1 canvas — PASS
    link: ref.green700,         // 5.46:1 white — PASS
    danger: ref.red700,         // 5.55:1 white — PASS
  },

  brand: {
    green: ref.green500,        // 3.09:1 graphic only
    greenDark: ref.green600,    // decorative gradient
    greenStrong: ref.green700,  // 5.46:1 text + fill behind white text
    greenTint: ref.greenTint,
    orange: ref.orange500,      // 3.32:1 graphic only
    orangeStrong: ref.orange700,// 5.86:1 text + fill behind white text
    orangeTint: ref.orangeTint,
  },

  // foreground used ON a colored fill
  on: {
    primary: ref.white,  // on greenStrong — 5.46:1
    accent: ref.white,   // on orangeStrong — 5.86:1
    danger: ref.white,   // on dangerStrong — 5.55:1
    tint: ref.green700,  // on greenTint — 4.80:1
  },

  border: {
    default: ref.gray150, // decorative hairline (1.15:1, informational only)
    strong: ref.gray500,  // visible control outline — 3.11:1
    swatch: ref.gray300,  // swatch outline (decorative)
    input: ref.gray500,   // input boundary — 3.11:1
  },

  focus: { ring: ref.green700 }, // 5.46:1 (passes UI 3:1)

  icon: {
    default: ref.gray600,       // 5.41:1 — default glyph / inactive tab icon
    muted: ref.gray600,         // 5.41:1
    inverse: ref.white,
    brandGreen: ref.green500,   // 3.09:1 graphic
    brandOrange: ref.orange500, // 3.32:1 graphic
  },

  status: {
    success: ref.green700, successFg: ref.white,   // 5.46:1 — codemod target for button/badge
    warning: ref.orange700, warningFg: ref.white,  // 5.86:1
    danger: ref.red500,                            // 3.91:1 icon/graphic only
    dangerStrong: ref.red700, dangerFg: ref.white, // 5.55:1 text-bearing
    info: ref.blueInfo, infoFg: ref.white,         // RESERVED — not verifier-tested
  },

  star: {
    decorative: ref.amber500, // 1.97:1 — pair with numeric value in text.muted
    strong: ref.amber700,     // 4.65:1 — standalone informative glyph
  },

  // decorative/native iOS hues — not AA-guaranteed; do not use as text-bearing fills
  system: {
    blue: ref.sysBlue, green: ref.sysGreen, red: ref.sysRed, orange: ref.orange500,
    yellow: ref.sysYellow, pink: ref.sysPink, purple: ref.sysPurple,
    teal: ref.sysTeal, indigo: ref.sysIndigo,
  },

  overlay: { scrim: ref.scrim, whiteAlpha: ref.whiteAlpha },
} as const;

/* -------------------------------------------------------------------------- */
/*  Tier 2 — non-color primitives                                              */
/* -------------------------------------------------------------------------- */

const spacing = {
  none: 0, xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, x2: 24, x3: 32,
} as const;

const layout = { tabBarClearance: 110 } as const;

const radius = { sm: 12, md: 16, lg: 20, xl: 24, pill: 999 } as const;

const elevation = {
  e0: Platform.select({ ios: {}, android: { elevation: 0 }, default: {} }),
  e1: Platform.select({
    ios: { shadowColor: '#000000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: 3 }, default: {},
  }),
  e2: Platform.select({
    ios: { shadowColor: '#000000', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 8 }, default: {},
  }),
  e3: Platform.select({
    ios: { shadowColor: '#000000', shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
    android: { elevation: 16 }, default: {},
  }),
} as const;

const motion = {
  duration: { instant: 0, fast: 150, base: 250, slow: 350, slower: 500 },
  easing: {
    standard: 'cubic-bezier(0.2,0,0,1)',
    decelerate: 'cubic-bezier(0,0,0,1)',
    accelerate: 'cubic-bezier(0.3,0,1,1)',
    linear: 'linear',
  },
  spring: {
    press: { damping: 15, stiffness: 400, mass: 0.5 },
    settle: { damping: 20, stiffness: 400, mass: 0.8 },
    slide: { damping: 15, stiffness: 180, mass: 0.6 },
    gentle: { damping: 20, stiffness: 120, mass: 1 },
  },
  bannerInterval: 5000, // raised from 2000 (Thai reading time + WCAG 2.2.2)
  bannerTransition: 250,
  autoRotate: true,            // forced false under reduce-motion
  respectReduceMotion: true,
} as const;

const a11y = {
  minTouchTarget: 44,
  controlMinHeight: 48, // use minHeight, never fixed height (Thai dynamic type)
  hitSlop: { sm: 6, xs: 2 },
} as const;

/* -------------------------------------------------------------------------- */
/*  Tier 2 — typography (canonical Thai-tuned scale; one source)               */
/* -------------------------------------------------------------------------- */

const font = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  boldItalic: 'Poppins_700Bold_Italic',
} as const;

const typeMeta = {
  baseSize: 15,
  lineHeightRatio: 1.45, // target range 1.40–1.50
  maxFontSizeMultiplierDefault: 1.6,
} as const;

type TypeToken = TextStyle & { maxFontSizeMultiplier: number; wcag: 'large' | 'normal' };

const type: Record<
  | 'display' | 'heading' | 'title' | 'subtitle' | 'body' | 'bodyStrong'
  | 'price' | 'button' | 'caption' | 'link' | 'label',
  TypeToken
> = {
  display:    { fontFamily: font.boldItalic, fontSize: 26, lineHeight: 38, maxFontSizeMultiplier: 1.3, wcag: 'large' },
  heading:    { fontFamily: font.bold,       fontSize: 28, lineHeight: 40, maxFontSizeMultiplier: 1.3, wcag: 'large' },
  title:      { fontFamily: font.bold,       fontSize: 22, lineHeight: 32, maxFontSizeMultiplier: 1.3, wcag: 'large' },
  subtitle:   { fontFamily: font.semibold,   fontSize: 18, lineHeight: 26, maxFontSizeMultiplier: 1.4, wcag: 'normal' },
  body:       { fontFamily: font.regular,    fontSize: 15, lineHeight: 22, maxFontSizeMultiplier: 1.7, wcag: 'normal' },
  bodyStrong: { fontFamily: font.semibold,   fontSize: 15, lineHeight: 22, maxFontSizeMultiplier: 1.7, wcag: 'normal' },
  price:      { fontFamily: font.bold,       fontSize: 15, lineHeight: 22, maxFontSizeMultiplier: 1.3, wcag: 'normal' }, // color set by caller
  button:     { fontFamily: font.semibold,   fontSize: 15, lineHeight: 22, maxFontSizeMultiplier: 1.3, wcag: 'normal' },
  caption:    { fontFamily: font.regular,    fontSize: 13, lineHeight: 19, maxFontSizeMultiplier: 1.8, wcag: 'normal', color: color.text.muted },
  link:       { fontFamily: font.medium,     fontSize: 15, lineHeight: 22, maxFontSizeMultiplier: 1.7, wcag: 'normal', textDecorationLine: 'underline' },
  label:      { fontFamily: font.medium,     fontSize: 13, lineHeight: 19, maxFontSizeMultiplier: 1.8, wcag: 'normal' },
};

/* -------------------------------------------------------------------------- */
/*  Public canonical token object                                              */
/* -------------------------------------------------------------------------- */

export const tokens = {
  ref, color, spacing, layout, radius, elevation, motion, a11y, font, type, typeMeta,
} as const;

export type ColorTokens = typeof color;

/* -------------------------------------------------------------------------- */
/*  Tier 3 adapters — pure projections, NO hex                                 */
/*  (re-exported by constants/theme.ts and theme/colors.ts)                    */
/* -------------------------------------------------------------------------- */

const c = tokens.color;

// ---- Family A: flat `Colors` (constants/theme.ts) -------------------------
const flatScheme = {
  text: c.text.default,
  background: c.bg.canvas,
  tint: c.brand.green,
  icon: c.icon.default,          // a11y: #9B9B9B → #6A6A6A
  tabIconDefault: c.icon.muted,  // a11y: #9B9B9B → #6A6A6A
  tabIconSelected: c.brand.green,
} as const;

export const flatColors = {
  background: c.bg.canvas,
  backgroundAlt: c.surface.base,
  surface: c.surface.base,
  surfaceMuted: c.surface.muted,
  primary: c.brand.green,             // graphic fill only (3.09:1)
  primaryStrong: c.brand.greenStrong, // text + behind-white-text fills (5.46:1)
  primaryDark: c.brand.greenDark,
  primaryTint: c.brand.greenTint,
  accent: c.brand.orange,             // graphic fill only (3.32:1); was #F5821F
  accentStrong: c.brand.orangeStrong, // text + behind-white-text fills (5.86:1)
  accentTint: c.brand.orangeTint,
  text: c.text.default,
  textMuted: c.text.muted,            // a11y: #9B9B9B → #6A6A6A
  textOnPrimary: c.text.inverse,
  star: c.star.decorative,
  starStrong: c.star.strong,
  border: c.border.default,
  borderStrong: c.border.strong,
  danger: c.status.danger,            // icon/graphic only (3.91:1)
  dangerStrong: c.status.dangerStrong,// text + behind-white-text (5.55:1)
  swatchBorder: c.border.swatch,
  scrim: c.overlay.scrim,
  whiteAlpha: c.overlay.whiteAlpha,
  // key-complete light/dark sub-objects (collapsible.tsx reads Colors.dark.icon)
  light: flatScheme,
  dark: flatScheme, // v1 light-only: dark = light projection
} as const;

// ---- Family B: BNA `lightColors`/`darkColors` (theme/colors.ts) -----------
export const bnaLightColors = {
  background: c.bg.canvas,
  foreground: c.text.default,
  card: c.surface.base,
  cardForeground: c.text.default,
  popover: c.surface.base,
  popoverForeground: c.text.default,
  primary: c.brand.greenStrong,         // default Button fill: white label 5.46:1 (was 3.09)
  primaryForeground: c.on.primary,
  secondary: c.brand.greenTint,
  secondaryForeground: c.text.brandGreen, // on tint 4.80:1 (fixes secondary badge)
  muted: c.surface.muted,
  mutedForeground: c.text.muted,        // a11y: #9B9B9B → #6A6A6A
  accent: c.brand.greenTint,            // DEPRECATED alias (unused) — frozen
  accentForeground: c.text.brandGreen,  // DEPRECATED alias — frozen
  destructive: c.status.dangerStrong,   // text-bearing fill: white label 5.55:1 (was 3.91)
  destructiveForeground: c.status.dangerFg,
  border: c.border.default,
  input: c.border.input,                // visible control outline 3.11:1 (was #ECEFF1)
  ring: c.focus.ring,                   // greenStrong 5.46:1
  text: c.text.default,
  textMuted: c.text.muted,
  tint: c.brand.green,                  // vivid brand graphic (tabs)
  icon: c.icon.default,                 // unify with Family A: #6A6A6A (was #6E6E6E)
  tabIconDefault: c.icon.muted,         // a11y: #9B9B9B → #6A6A6A
  tabIconSelected: c.brand.green,
  // codemod targets for button.tsx / badge.tsx (replace system.green/red)
  success: c.status.success,            // #017A3A
  successForeground: c.status.successFg,
  warning: c.status.warning,
  warningForeground: c.status.warningFg,
  dangerStrong: c.status.dangerStrong,
  borderStrong: c.border.strong,
  starStrong: c.star.strong,
  // iOS system passthroughs — decorative/native only, NOT AA-guaranteed
  blue: c.system.blue,
  green: c.system.green,
  red: c.system.red,
  orange: c.brand.orange,               // shares flat-`accent` SOURCE (ref.orange500)
  yellow: c.system.yellow,
  pink: c.system.pink,
  purple: c.system.purple,
  teal: c.system.teal,
  indigo: c.system.indigo,
  star: c.star.decorative,
} as const;

// v1 light-only: key-IDENTICAL dark projection so theme-provider.tsx
// (Colors.dark.{primary,background,card,text,border,red}) and useColor's
// `keyof light & keyof dark` intersection never break.
export const bnaDarkColors = { ...bnaLightColors } as const;

export const bnaColors = { light: bnaLightColors, dark: bnaDarkColors } as const;

/* -------------------------------------------------------------------------- */
/*  globals.ts aliases (BNA primitives read ONE source)                        */
/* -------------------------------------------------------------------------- */

export const HEIGHT = tokens.a11y.controlMinHeight; // 48
export const FONT_SIZE = tokens.typeMeta.baseSize;  // 15
export const BORDER_RADIUS = tokens.radius.lg;      // 20
export const CORNERS = tokens.radius.pill;          // 999
