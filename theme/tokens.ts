/**
 * theme/tokens.ts — อู้ฟู่ design system, THE single source of truth.
 *
 * WARM rebrand: coral/orange PRIMARY on a warm peach canvas; GREEN is reserved
 * for success/discount only. (Reverts the prior 7-Eleven-green direction back to
 * the iconic อู้ฟู่ coral #F2683C lineage.)
 *
 * This is the ONLY file allowed to contain raw hex / sizing literals.
 * - Tier 1  `ref.*`          primitives (hue+scale)
 * - Tier 2  `tokens.color.*` + tokens.{spacing,layout,radius,elevation,motion,a11y,type}
 * - Tier 3  adapters (bottom): `flatColors` (Family A) and `bnaLightColors`/`bnaDarkColors`
 *           (Family B) are PURE projections — no hex — re-exported by constants/theme.ts
 *           and theme/colors.ts so a value is declared exactly once.
 *
 * Architecture is UNCHANGED from the green build: only Tier-1 hex is re-hued and
 * the Tier-2 semantic tokens are renamed to ROLE-based names (primary=coral,
 * accent=green). Every Tier-3 adapter EXPORT KEY is byte-identical, so no
 * component import breaks.
 *
 * Every color carries the WCAG 2.1 ratio computed by the authoritative contrast
 * pass (sRGB relative luminance). Notation: `(vs white / vs peach #FBEFE9)`.
 * Three refs were minimally darkened (hue-preserving) by the verifier so the
 * WHOLE palette provably passes AA at every required threshold:
 *   coral500     #F2683C -> #F15929  (UI 3:1 on peach: 2.73 -> 3.00)
 *   borderStrong #948A85 -> #948984  (UI 3:1 on peach: 2.99 -> 3.02)
 *   amber700     #9C6B08 -> #946508  (AA 4.5 on peach: 4.12 -> 4.52)
 *
 * v1 is LIGHT-ONLY: the dark projection is key-complete (= light) so React
 * Navigation DarkTheme and useColor's `keyof light & keyof dark` never break.
 */

import { Platform, type TextStyle } from 'react-native';

/* -------------------------------------------------------------------------- */
/*  Tier 1 — ref primitives (the only hex)                                     */
/* -------------------------------------------------------------------------- */

const ref = {
  // neutrals
  white: '#FFFFFF',
  ink: '#1E1E1E',         // default text — 16.67:1 white / 14.79:1 peach / 14.37:1 warmMuted
  peach50: '#FBEFE9',     // app canvas (warm peach)
  warmMuted100: '#F3EDE9',// muted surface (warm) — fill only (1.16:1 vs white; ink-on 14.37, muted-on 5.08)
  borderHair: '#EFE4DD',  // decorative hairline — 1.25:1 white / 1.11:1 peach (informational only)
  swatch300: '#E7DAD2',   // swatch outline (decorative)
  borderStrong: '#948984',// visible control/input outline — 3.40:1 white / 3.02:1 peach (was #948A85; +0.012 fix on peach)
  warmGray600: '#6E625C', // accessible muted text/icon — 5.89:1 white / 5.23:1 peach / 5.08:1 warmMuted — PASSES both surfaces

  // coral (PRIMARY family)
  coral500: '#F15929',    // brand fill / splash graphic — 3.39:1 white / 3.00:1 peach (was #F2683C; darkened to clear UI 3:1 on peach)
  coral600: '#DA5226',    // primaryDark / gradient end (decorative, no AA req) — 4.03:1 white
  coralStrong: '#B83C18', // primaryStrong: text + fill behind white 15px label — 5.68:1 white / 5.04:1 peach / 4.77:1 on coralTint; white-on 5.68
  coralTint: '#FCE7DE',   // decorative tint (อู้ฟู่ original)

  // green (ACCENT / success-discount family)
  green500: '#1E9E5C',    // accent fill + success icon (graphic) — 3.44:1 white / 3.05:1 peach (deepened from #2EAD6A 2.88 to clear 3:1)
  green600: '#178A4E',    // accentDark / gradient (decorative, no AA req)
  greenStrong: '#017A3A', // accentStrong: text + fill behind white 15px label — 5.46:1 white / 4.84:1 peach / 4.68:1 on greenTint; white-on 5.46
  greenTint: '#DCF3E5',   // decorative tint

  // red
  red500: '#E5484D',      // danger graphic / trash icon — 3.91:1 white (NOT for label text)
  red700: '#C9252B',      // accessible danger text + fill behind white — 5.55:1 white; white-on 5.55

  // amber / star
  amber500: '#FBA72A',    // decorative star — 1.97:1 white (MUST pair with a numeric value)
  amber700: '#946508',    // informative star / warning text + fill — 5.09:1 white / 4.52:1 peach; white-on 5.09 (was #9C6B08; darkened to clear AA on peach)

  // reserved status (NOT in the verifier's tested set — verify before first use)
  blueInfo: '#2563EB',

  // iOS system passthroughs — decorative/native only, NOT AA-guaranteed
  sysBlue: '#007AFF', sysGreen: '#34C759', sysRed: '#E5484D', sysYellow: '#FFCC00',
  sysPink: '#FF7DA8', sysPurple: '#AF52DE', sysTeal: '#5AC8FA', sysIndigo: '#5856D6',

  // overlays
  scrim: 'rgba(30,30,30,0.55)',
  whiteAlpha: 'rgba(255,255,255,0.5)',

  // warm shadow tint — a deep coffee-brown so card shadows read warm on the
  // peach canvas instead of the muddy gray a pure-black shadow produces.
  shadowWarm: '#3D2113',
} as const;

/* -------------------------------------------------------------------------- */
/*  Tier 2 — semantic color tokens (role → ref)                                */
/*  Role-based names: primary = CORAL, accent = GREEN.                          */
/* -------------------------------------------------------------------------- */

const color = {
  bg: { canvas: ref.peach50 },
  surface: { base: ref.white, muted: ref.warmMuted100 },

  text: {
    default: ref.ink,              // 16.67:1 white / 14.79:1 peach — PASS
    muted: ref.warmGray600,        // 5.89:1 white / 5.23:1 peach — PASS both
    inverse: ref.white,            // on *Strong fills below
    brandPrimary: ref.coralStrong, // 5.68:1 white / 5.04:1 peach / 4.77:1 on coralTint — PASS (coral text)
    brandAccent: ref.greenStrong,  // 5.46:1 white / 4.84:1 peach / 4.68:1 on greenTint — PASS (green text)
    link: ref.coralStrong,         // 5.68:1 white — PASS (interactive = primary coral)
    danger: ref.red700,            // 5.55:1 white — PASS
  },

  brand: {
    primary: ref.coral500,         // 3.39:1 white / 3.00:1 peach — graphic/large fill only
    primaryDark: ref.coral600,     // decorative gradient
    primaryStrong: ref.coralStrong,// 5.68:1 — text + fill behind white text
    primaryTint: ref.coralTint,
    accent: ref.green500,          // 3.44:1 white / 3.05:1 peach — graphic only (success/discount)
    accentDark: ref.green600,      // decorative gradient
    accentStrong: ref.greenStrong, // 5.46:1 — text + fill behind white text
    accentTint: ref.greenTint,
  },

  // foreground used ON a colored fill
  on: {
    primary: ref.white,            // on coralStrong — 5.68:1
    accent: ref.white,             // on greenStrong — 5.46:1
    danger: ref.white,             // on dangerStrong — 5.55:1
    primaryTint: ref.coralStrong,  // on coralTint — 4.77:1
    accentTint: ref.greenStrong,   // on greenTint — 4.68:1
  },

  border: {
    default: ref.borderHair,       // decorative hairline (1.25:1, informational only)
    strong: ref.borderStrong,      // visible control outline — 3.40:1 white / 3.02:1 peach
    swatch: ref.swatch300,         // swatch outline (decorative)
    input: ref.borderStrong,       // input boundary — 3.40:1 white / 3.02:1 peach
  },

  focus: { ring: ref.coralStrong },// 5.68:1 (passes UI 3:1) — brand-primary focus

  icon: {
    default: ref.warmGray600,      // 5.89:1 — default glyph / inactive tab icon
    muted: ref.warmGray600,        // 5.89:1
    inverse: ref.white,
    brandPrimary: ref.coral500,    // 3.39:1 white / 3.00:1 peach — graphic
    brandAccent: ref.green500,     // 3.44:1 white / 3.05:1 peach — graphic (success icon)
  },

  status: {
    success: ref.greenStrong, successFg: ref.white, // 5.46:1 — codemod target for button/badge
    warning: ref.amber700, warningFg: ref.white,     // 5.09:1 white — separated from primary coral
    danger: ref.red500,                              // 3.91:1 icon/graphic only
    dangerStrong: ref.red700, dangerFg: ref.white,   // 5.55:1 text-bearing
    info: ref.blueInfo, infoFg: ref.white,           // RESERVED — not verifier-tested
  },

  star: {
    decorative: ref.amber500,      // 1.97:1 — pair with numeric value in text.muted
    strong: ref.amber700,          // 5.09:1 white / 4.52:1 peach — standalone informative glyph
  },

  // decorative/native iOS hues — not AA-guaranteed; do not use as text-bearing fills
  system: {
    blue: ref.sysBlue, green: ref.sysGreen, red: ref.sysRed, orange: ref.coral500,
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
    ios: { shadowColor: ref.shadowWarm, shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 3 } },
    android: { elevation: 3 }, default: {},
  }),
  e2: Platform.select({
    ios: { shadowColor: ref.shadowWarm, shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 5 } },
    android: { elevation: 8 }, default: {},
  }),
  e3: Platform.select({
    ios: { shadowColor: ref.shadowWarm, shadowOpacity: 0.14, shadowRadius: 28, shadowOffset: { width: 0, height: 10 } },
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
  regular: 'Mitr_300Light',
  medium: 'Mitr_400Regular',
  semibold: 'Mitr_500Medium',
  bold: 'Mitr_600SemiBold',
  // Mitr has no italic; `boldItalic` is kept as a key (used by the `display`
  // token) but resolves to the upright bold so the family stays consistent.
  boldItalic: 'Mitr_600SemiBold',
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
/*  EXPORT KEY NAMES ARE FROZEN — identical to the green build.                 */
/* -------------------------------------------------------------------------- */

const c = tokens.color;

// ---- Family A: flat `Colors` (constants/theme.ts) -------------------------
const flatScheme = {
  text: c.text.default,
  background: c.bg.canvas,
  tint: c.brand.primary,          // vivid coral (was brand.green)
  icon: c.icon.default,           // warmGray600
  tabIconDefault: c.icon.muted,   // warmGray600
  tabIconSelected: c.brand.primary,
} as const;

export const flatColors = {
  background: c.bg.canvas,
  backgroundAlt: c.surface.base,
  surface: c.surface.base,
  surfaceMuted: c.surface.muted,
  primary: c.brand.primary,             // graphic fill only — 3.39:1 white / 3.00:1 peach (coral500)
  primaryStrong: c.brand.primaryStrong, // text + behind-white-text fills — 5.68:1 (coralStrong)
  primaryDark: c.brand.primaryDark,
  primaryTint: c.brand.primaryTint,
  accent: c.brand.accent,               // graphic fill only — 3.44:1 white / 3.05:1 peach (green500)
  accentStrong: c.brand.accentStrong,   // text + behind-white-text fills — 5.46:1 (greenStrong)
  accentTint: c.brand.accentTint,
  text: c.text.default,
  textMuted: c.text.muted,              // 5.89:1 white / 5.23:1 peach (warmGray600)
  textOnPrimary: c.text.inverse,
  star: c.star.decorative,
  starStrong: c.star.strong,
  border: c.border.default,
  borderStrong: c.border.strong,        // 3.40:1 white / 3.02:1 peach (corrected #948984)
  danger: c.status.danger,              // icon/graphic only — 3.91:1
  dangerStrong: c.status.dangerStrong,  // text + behind-white-text — 5.55:1
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
  primary: c.brand.primaryStrong,       // default Button fill: white label 5.68:1 (coralStrong)
  primaryForeground: c.on.primary,
  secondary: c.brand.primaryTint,       // coralTint
  secondaryForeground: c.text.brandPrimary, // coralStrong on coralTint 4.77:1
  muted: c.surface.muted,
  mutedForeground: c.text.muted,        // 5.89:1 white / 5.23:1 peach
  accent: c.brand.accentTint,           // DEPRECATED alias (unused) — frozen (greenTint)
  accentForeground: c.text.brandAccent, // DEPRECATED alias — frozen (greenStrong on greenTint 4.68:1)
  destructive: c.status.dangerStrong,   // text-bearing fill: white label 5.55:1
  destructiveForeground: c.status.dangerFg,
  border: c.border.default,
  input: c.border.input,                // visible control outline 3.40:1 white / 3.02:1 peach
  ring: c.focus.ring,                   // coralStrong 5.68:1
  text: c.text.default,
  textMuted: c.text.muted,
  tint: c.brand.primary,                // vivid coral brand graphic (tabs) — 3.39:1 white
  icon: c.icon.default,                 // warmGray600 — unified with Family A
  tabIconDefault: c.icon.muted,         // warmGray600
  tabIconSelected: c.brand.primary,
  // codemod targets for button.tsx / badge.tsx (replace system.green/red)
  success: c.status.success,            // greenStrong #017A3A — green stays green
  successForeground: c.status.successFg,
  warning: c.status.warning,            // amber700 #946508 — white-on 5.09:1, separated from coral
  warningForeground: c.status.warningFg,
  dangerStrong: c.status.dangerStrong,
  borderStrong: c.border.strong,
  starStrong: c.star.strong,
  // brand-aligned passthroughs (re-hued): orange→coral500, green→green500, red→red500
  blue: c.system.blue,
  green: c.brand.accent,                // green500 #1E9E5C
  red: c.status.danger,                 // red500 #E5484D
  orange: c.brand.primary,              // coral500 #F15929 — shares flat-`primary`/`tint` SOURCE
  yellow: c.system.yellow,
  pink: c.system.pink,
  purple: c.system.purple,
  teal: c.system.teal,
  indigo: c.system.indigo,
  star: c.star.decorative,              // amber500 #FBA72A
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