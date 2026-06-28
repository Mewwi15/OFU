# 08 — อู้ฟู่ Design System (v1, light-only)

> Single source of truth for color, type, space, radius, elevation, motion and a11y.
> **The contrast verifier is authoritative for every color value.** Where the four proposals disagreed on a hex, the verifier's corrected value wins, and the computed WCAG ratio is cited next to every text/graphic token. Nothing here ships a color a user cannot read.

Canonical token module: `theme/tokens.ts` (the only file containing hex). Both legacy palettes — `constants/theme.ts` (`Colors`, flat) and `theme/colors.ts` (`lightColors`/`darkColors`, BNA) — become thin adapters that project `tokens.color.*`, so a value is declared exactly once.

---

## 0. Canonical reconciliation (read first)

The four proposals shipped **two disagreeing token enumerations**. The consolidation check flagged six live disagreements + one orphan. They are resolved by overriding with the contrast verifier's corrected hex:

| Role | Draft A | Draft B | **Canonical (verifier)** | Why |
|---|---|---|---|---|
| accessible green text/fill | `#007A38` | `#017A3A` | **`#017A3A`** | verifier #1/#3 = 5.46:1 |
| accessible orange text/fill | `#C2410C` | `#B23E0A` | **`#B23E0A`** | verifier #8/#10 = 5.86:1 (safer than 5.18) |
| muted text/icon | `#6E6E6E` | `#6A6A6A` | **`#6A6A6A`** | `#6E6E6E` only 4.59:1 on canvas (+0.09); `#6A6A6A` = 4.87:1 |
| brand-fill orange | `#F5821F` | `#E06C0A` | **`#E06C0A`** | `#F5821F` = 2.59:1 fails even the 3:1 graphic bar |
| accessible danger fill | `#C8252A` | `#C9252B` | **`#C9252B`** | verifier #22/#23 = 5.55:1 |
| scrim | `rgba(30,30,30,0.4)` | `rgba(30,30,30,0.55)` | **`rgba(30,30,30,0.55)`** | 0.40 too shallow over bright photos |
| strong border (orphan) | — | `#929292` | **`#929292`** | verifier #19 = 3.11:1, the only visible-outline token |

`#F5821F` (old brand orange) and `#9B9B9B` (old muted) are **retired** — they cannot legally carry text or act as a 3:1 graphic.

---

## 1. Principles

1. **Brand first, accessible always.** อู้ฟู่ is a "7-Eleven style" Thai grocer; vivid green `#00A94F` and warm orange are non-negotiable brand signals — but no token is allowed to fail WCAG AA in the role it is used.
2. **Split brand-fill from accessible-on-light.** Every chromatic hue ships **two** tokens: a vivid *brand-fill* (graphics/borders/icon-tiles, ≥3:1) and a darker *strong* variant (colored text on light, and fills sitting behind white text, ≥4.5:1). White-on-X and X-on-white are symmetric, so one *strong* token serves both "green text on white" and "green button behind white label".
3. **Declare once.** One semantic token layer feeds both consumer families. `accent`/`icon`/`textMuted` can never silently drift again because there is no second hex to drift from.
4. **Thai-first type.** Poppins ships no Thai glyphs; Thai renders via the OS fallback whose line box is taller. Every text variant pins an explicit `lineHeight` ≈1.45× so stacked tone marks (◌ี ◌้ ◌๊) and descenders (ฤ ญ ฐ) never clip.
5. **Non-breaking by construction.** Live API names keep their exact `fontSize`/`fontFamily`; new tokens are additive; the two palettes keep every currently-consumed key. The only intended visual deltas are the a11y hex bumps and three required codemod sites (§6).
6. **WCAG AA is the floor.** Normal text ≥4.5:1, large text (≥24px or ≥19px bold) ≥3:1, UI components/graphics ≥3:1, decorative = no requirement (but documented).
7. **Geometry serves a11y.** Touch targets ≥44pt via `hitSlop`; text-bearing controls use `minHeight` not `height`; motion respects Reduce Motion.

---

## 2. Color tokens

### 2.1 The brand-fill vs accessible-text split

| Hue | Brand-fill (graphics only, ≥3:1) | Strong / accessible (text + behind-white-text, ≥4.5:1) | Tint (decorative) |
|---|---|---|---|
| Green | `brand.green #00A94F` | `brand.greenStrong #017A3A` | `brand.greenTint #E2F5E9` |
| Orange | `brand.orange #E06C0A` | `brand.orangeStrong #B23E0A` | `brand.orangeTint #FDECD9` |
| Red | `status.danger #E5484D` | `status.dangerStrong #C9252B` | — |
| Amber | `star.decorative #FBA72A` | `star.strong #9C6B08` | — |

`brand.greenDark #018A3F` is a non-text decorative gradient end (header), kept for visual continuity, no AA requirement.

### 2.2 Text color tokens — each with its verified ratio + AA result

All are **normal text (4.5:1 bar)** unless marked large. Ratios from the authoritative contrast pass.

| Token | Hex | On white | On canvas `#F2F3F5` | On other | AA |
|---|---|---|---|---|---|
| `text.default` | `#1E1E1E` | 16.67:1 (#17) | 15.02:1 (#18) | — | **PASS** |
| `text.muted` | `#6A6A6A` | 5.41:1 (#14) | 4.87:1 (#15) | — | **PASS** (canvas margin +0.37) |
| `text.brandGreen` (= greenStrong) | `#017A3A` | 5.46:1 (#1) | 4.92:1 (#2) | 4.80:1 on greenTint (#4) | **PASS** |
| `text.brandOrange` (= orangeStrong) | `#B23E0A` | 5.86:1 (#8) | 5.27:1 (#9) | — | **PASS** |
| `text.danger` (= dangerStrong) | `#C9252B` | 5.55:1 (#23) | — | — | **PASS** |
| `text.link` (= greenStrong) | `#017A3A` | 5.46:1 (#1) | — | — | **PASS** |
| `text.inverse` on `greenStrong` fill | `#FFFFFF` | — | — | 5.46:1 on `#017A3A` (#3) | **PASS** |
| `text.inverse` on `orangeStrong` fill | `#FFFFFF` | — | — | 5.86:1 on `#B23E0A` (#10) | **PASS** |
| `text.inverse` on `dangerStrong` fill | `#FFFFFF` | — | — | 5.55:1 on `#C9252B` (#22) | **PASS** |

**Large-text (3:1 bar) text-on-graphic:**

| Token | Hex | Context | Ratio | AA |
|---|---|---|---|---|
| `text.inverse` on `brand.orange` | `#FFFFFF` | white **icon / ≥19px-bold** label on `#E06C0A` only | 3.32:1 (#13) | **PASS (large/icon only — NOT normal text)** |
| `text.inverse` on `brand.green` | `#FFFFFF` | white **icon** on `#00A94F` only | 3.09:1 (#6) | **PASS (icon only — NOT normal text)** |
| `text.inverse` over `scrim` | `#FFFFFF` | 22px-bold banner title on `scrim 0.55` | 16.67:1 vs solid scrim base (#29) | **PASS (photo-dependent, see §8)** |

### 2.3 Graphic / UI-component tokens (3:1 bar)

| Token | Hex | Role | Ratio | AA |
|---|---|---|---|---|
| `brand.green` | `#00A94F` | tab indicator, badge/icon-tile fill, selection ring, wishlist heart | 3.09:1 on white (#5/#47) | **PASS** |
| `brand.orange` | `#E06C0A` | online selection ring/border, decorative orange fill, icon badge | 3.32:1 on white (#12) | **PASS** |
| `icon.default` / `icon.muted` | `#6A6A6A` | default glyph, inactive tab icon | 5.41:1 on white (#16) | **PASS** |
| `border.strong` / `border.input` | `#929292` | input/control/swatch visible outline | 3.11:1 on white (#19) | **PASS (thin +0.11)** |
| `status.danger` | `#E5484D` | trash/destructive **icon** on white (never label) | 3.91:1 (#24) | **PASS (graphic only)** |
| `focus.ring` | `#017A3A` | focus ring on white | 5.46:1 (#7) | **PASS** |
| `star.strong` | `#9C6B08` | standalone **informative** rating glyph | 4.65:1 white (#27), 4.18:1 canvas (#28) | **PASS** |
| `brand.orangeStrong` icon on tint | `#B23E0A` | online icon on `orangeTint` badge | 5.07:1 on `#FDECD9` (#11) | **PASS** |

### 2.4 Neutrals, decorative, overlay (no contrast requirement, documented)

| Token | Hex | Role | Measured |
|---|---|---|---|
| `bg.canvas` | `#F2F3F5` | app screen background | — |
| `surface.base` | `#FFFFFF` | cards, pills, inputs, tab bar | — |
| `surface.muted` | `#EEF1F3` | section fill distinct from a white card | — |
| `border.default` | `#ECEFF1` | hairline dividers/decorative | 1.15:1 (#20) decorative |
| `border.swatch` | `#E5E5E5` | color-swatch outline | decorative |
| `brand.greenTint` | `#E2F5E9` | green tint fill / image placeholder | 1.14:1 (#30) decorative |
| `brand.orangeTint` | `#FDECD9` | orange tint badge bg | 1.16:1 (#31) decorative |
| `star.decorative` | `#FBA72A` | rating glyph **paired with numeric value** | 1.97:1 (#25) decorative — must pair |
| `overlay.scrim` | `rgba(30,30,30,0.55)` | image-darkening overlay behind white text | see §8 |
| `overlay.whiteAlpha` | `rgba(255,255,255,0.5)` | inactive banner dot | decorative |

### 2.5 Usage rules (verifier-relevant)

1. **Normal text** (incl. 15px Bold price, 18px SemiBold subtitle, 13px caption) needs 4.5:1 → only `text.default`, `text.muted`, `*Strong` greens/oranges/danger may be text **or** a fill behind white text.
2. **`brand.green` / `brand.orange` / `status.danger` / `star.decorative` are graphics only** (3:1) — never normal-weight text on/in them. White on `brand.green`/`brand.orange` is valid **only** for icons or ≥19px-bold labels.
3. **Icons on a tint** (`greenTint`/`orangeTint`) use the matching `*Strong` token, never the brand fill.
4. **`star.decorative` must be accompanied by the numeric rating** in `text.muted`; a star that stands alone as information uses `star.strong`.
5. The cross-family `accent` name is **frozen + deprecated** (flat family: orange; BNA family: green tint). New code uses `tokens.color.brand.*` / `tokens.color.text.*` only.

---

## 3. Typography

### 3.1 Problem

Two hand-synced, drifting type systems: `constants/theme.ts → Typography` (8 variants, the only place with `lineHeight`, but ratios 1.2–1.33× — too tight for Thai — and effectively dead: only `Typography.body` is live, in the cart promo input) and `components/ui/text.tsx → TextVariant` (the live API, 6 variants, **none set `lineHeight`** → Thai diacritics clip). Three real roles (price, emphasis body, button/badge label) live as inline `fontFamily` overrides; `badge.tsx` further drifts using `fontWeight:'500'` instead of the Poppins family.

### 3.2 Strategy

Keep the **live** 6 variant *names* at their exact `fontSize`/`fontFamily` (zero horizontal reflow, zero call-site change), **add** explicit Thai-safe `lineHeight` + per-variant `maxFontSizeMultiplier`, and **add** the three missing roles (`price`, `bodyStrong`, `button`) so the inline overrides can be deleted over time. `constants/theme.ts Typography` collapses into aliases of the canonical scale.

### 3.3 Canonical type scale (one source of truth)

| Variant | Family (weight) | Size | LH | ratio | maxФ | WCAG class | Replaces / used by |
|---|---|---|---|---|---|---|---|
| `display` | Poppins_700Bold_Italic | 26 | 38 | 1.46 | 1.3 | large (3:1) | A-`display`; splash/wordmark |
| `heading` | Poppins_700Bold | 28 | 40 | 1.43 | 1.3 | large (3:1) | B-`heading`; admin/rider hero |
| `title` | Poppins_700Bold | 22 | 32 | 1.45 | 1.3 | large (3:1) | B-`title` + A-`banner`: ScreenHeader, product name, banner title, empty-state, account name |
| `subtitle` | Poppins_600SemiBold | 18 | 26 | 1.44 | 1.4 | **normal (4.5:1)** | B-`subtitle` + A-`h1`: section labels, list-item names, ModeSwitch labels, "รวมทั้งหมด" |
| `body` | Poppins_400Regular | 15 | 22 | 1.47 | 1.7 | normal | B-`body` + A-`body`: default copy (promo input normalizes 14→15) |
| `bodyStrong` *(new)* | Poppins_600SemiBold | 15 | 22 | 1.47 | 1.7 | normal | A-`h2`; replaces `body`+inline SemiBold (Chip, size pills) |
| `price` *(new)* | Poppins_700Bold | 15 | 22 | 1.47 | 1.3 | **normal** (15<19) | A-`price`; all price/total amounts. Color set by caller |
| `button` *(new)* | Poppins_600SemiBold | 15 | 22 | 1.47 | 1.3 | normal | A-`button`; canonical label for `button.tsx` + `badge.tsx` (fixes `fontWeight:'500'`) |
| `caption` | Poppins_400Regular | 13 | 19 | 1.46 | 1.8 | normal | B-`caption` + A-`caption`; default color `text.muted` |
| `link` | Poppins_500Medium | 15 | 22 | 1.47 | 1.7 | normal | B-`link`; underlined |
| `label` *(optional)* | Poppins_500Medium | 13 | 19 | 1.46 | 1.8 | normal | form field/helper/error text |

All ratios fall in **1.43–1.47×** (inside the 1.40–1.50× Thai target). `baseSize = 15` stays (read by searchbar/input/avatar/spinner); `body` stays 15 so everything aligns.

### 3.4 Why these lineHeights (Thai)

Poppins has no Thai glyphs → Thai runs render via the OS fallback (iOS SF Thai/Thonburi, Android Noto Sans Thai), whose box is taller. With `lineHeight` unset, RN sizes the line from Poppins' shorter Latin metrics → top tone marks and (Android) descender tails clip. Pinning `lineHeight ≥ ~1.45×` guarantees the box fits the fallback on both platforms. Guardrails: do **not** exceed ~1.5× for multi-line Thai (over-spaces paragraphs); leave Android `includeFontPadding` at default `true` (it protects diacritics) — if disabled for centering, the explicit `lineHeight` here compensates; numerals-only `price` keeps 22 to baseline-align with `body` in the same row.

### 3.5 WCAG threshold map (how type feeds color)

WCAG "large" = **≥24px OR ≥19px bold**. Therefore:
- **Large (3:1):** `heading` 28, `title` 22 Bold, `display` 26 → e.g. banner title white-on-scrim passes at 3:1.
- **Normal (4.5:1):** `subtitle` 18 SemiBold (18<19), `price` 15 Bold (15<19, bold does **not** promote it), `body/bodyStrong/button/caption/link/label`.

Consequences the color layer honors: green price and orange total are `price` = **normal** → 4.5:1 → must use `greenStrong #017A3A` / `orangeStrong #B23E0A` (verifier #32/#33). The ModeSwitch active pill label is `subtitle` 18 = **normal** → white-on-fill needs 4.5:1 → fill must be `greenStrong`/`orangeStrong` (verifier #34), OR promote the label to `title` (22 Bold) to drop to the 3:1 large bar (a typographic lever).

### 3.6 Dynamic Type

- **Keep `allowFontScaling` ON everywhere** (never set `false`).
- **Default `maxFontSizeMultiplier ≈ 1.6` on `<Text>`** + per-variant caps: small reading sizes grow most (1.7–1.8), big/decorative/control sizes capped (1.3) so heroes, price rows and fixed-height pills don't blow out.
- **Replace fixed `height` with `minHeight`** on text-bearing controls: `button.tsx`, `Chip`, `promoInputWrap` (40), searchbar/input (48), `QuantityStepper` value box; banner `height:180` → `minHeight` or truncate the title (at maxФ 1.3 a 2-line title is tight in 180).

---

## 4. Spacing / Radius / Elevation / Motion

### 4.1 Spacing (4-based, kept; two additions)

`none 0` · `xxs 2` · `xs 4` · `sm 8` · `md 12` · `lg 16` · `xl 20` · `x2 24` · `x3 32`. `none` tokenizes `padding:0` (cart input); `xxs` tokenizes the live `marginTop:2` (ProductCard) + pager-dot gaps. `Layout.tabBarClearance 110` promotes the constant duplicated in `index.tsx:28` and `cart.tsx:41`.

### 4.2 Radius (kept; dedup globals)

`sm 12` · `md 16` · `lg 20` · `xl 24` · `pill 999`. `theme/globals.ts` `BORDER_RADIUS(20)` → alias `Radius.lg`; `CORNERS(999)` → alias `Radius.pill` (BNA primitives and bespoke components read one source).

### 4.3 Elevation (promote 1 shadow → 4-step scale)

Today one `Shadow.card` is reused for flat cards **and** the floating tab bar. New cross-platform scale; `Shadow.card` stays exported as an alias of `e1`:

| Token | iOS | Android | Use |
|---|---|---|---|
| `e0` | none | `elevation:0` | flat / pressed / inset |
| `e1` (= `Shadow.card`) | opacity .06, r12, (0,4) | `elevation:3` | resting cards, mode card, promo input |
| `e2` | opacity .10, r16, (0,8) | `elevation:8` | **floating**: TabBar, primary IconButton, banner |
| `e3` | opacity .14, r24, (0,12) | `elevation:16` | overlays: sheets, popovers, dialogs |

Shadow color stays `#000000` (brand hues too low-contrast to tint usefully).

### 4.4 Motion (new layer)

- **Duration (ms):** `instant 0` · `fast 150` (press, searchbar debounce) · `base 250` (image fade, default) · `slow 350` (sheets) · `slower 500`.
- **Easing (bezier):** `standard 0.2,0,0,1` · `decelerate 0,0,0,1` · `accelerate 0.3,0,1,1` · `linear`.
- **Springs (reanimated):** `press {15,400,0.5}` · `settle {20,400,0.8}` · `slide {15,180,0.6}` (tab indicator) · `gentle {20,120,1}`.
- **Banner:** `bannerInterval 5000` (raised from 2000 — 2s is below comfortable Thai reading time), `bannerTransition 250`, `autoRotate true`, `respectReduceMotion true`.

---

## 5. Accessibility rules

### 5.1 Touch targets (WCAG 2.5.5 ≥44pt)

`A11y.minTouchTarget 44`, `controlMinHeight 48`, `hitSlop.sm 6`, `hitSlop.xs 2`. Helper: `hitSlop = max(0, ceil((44 - visualSize) / 2))` — keep the small *visual* size, expand the touch area. Fixes: wishlist heart (32 → `hitSlop.sm`), QuantityStepper ± (32 → `hitSlop.sm`), Chip (40 → `hitSlop.xs` + `minHeight`), promo row (40 → `minHeight 44`). IconButton (44) and Button default/sm (48/44) already pass.

### 5.2 Dynamic type

`allowFontScaling` ON; per-variant `maxFontSizeMultiplier` (§3.6); `minHeight` not `height` on text controls so scaled/tall-Thai lines grow instead of clipping.

### 5.3 Reduced motion (WCAG 2.2.2 / 2.3.3)

The hero banner auto-advances with no stop control → violates Pause/Stop/Hide. Add a JS hook + reanimated `ReduceMotion.System`:

```ts
// hooks/useReducedMotion.ts
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let on = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => on && setReduced(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { on = false; sub.remove(); };
  }, []);
  return reduced;
}
```

Banner: gate the `setInterval` on `!reduceMotion && Motion.autoRotate`, use `Motion.bannerInterval` (5000). For worklet animations (`button.tsx`, `TabBar.tsx`, `spinner.tsx`) pass `reduceMotion: ReduceMotion.System` to each `withSpring`/`withTiming`.

### 5.4 Thai line-height

Every text variant pins `lineHeight ≈1.45×` (§3.4). Default Android `includeFontPadding:true`. Numerals-only `price` keeps the body line box for baseline alignment.

---

## 6. Token architecture + migration

### 6.1 Three-tier architecture

```
theme/tokens.ts   (NEW — the ONLY file with hex)
  ├─ ref.*          Tier 1  primitives (green700, gray600 …)
  └─ tokens.color.* Tier 2  semantic roles → ref (text.muted, brand.green …)
                    + tokens.{spacing,radius,elevation,motion,a11y,type}

constants/theme.ts  Colors/palette ─┐ Tier 3 ADAPTERS: pure projections,
theme/colors.ts     lightColors    ─┘ no hex, no hand-sync. Each key declared once.
```

New code consumes `tokens.color.*` directly. The two legacy maps survive only as thin adapters so nothing in `app/**` or `components/**` changes on day one. Both adapters import the same tokens → `Colors.accent` and `lightColors.orange` finally resolve to the **same** `ref.orange500`; `accent`/`icon`/`textMuted` drift becomes structurally impossible.

Adapter A (`constants/theme.ts`):
```ts
import { tokens } from '@/theme/tokens';
const c = tokens.color;
const palette = { background: c.bg.canvas, surface: c.surface.base,
  primary: c.brand.green, primaryStrong: c.brand.greenStrong, primaryTint: c.brand.greenTint,
  accent: c.brand.orange, accentStrong: c.brand.orangeStrong, accentTint: c.brand.orangeTint,
  text: c.text.default, textMuted: c.text.muted, textOnPrimary: c.text.inverse,
  star: c.star.decorative, starStrong: c.star.strong, border: c.border.default,
  borderStrong: c.border.strong, danger: c.status.danger, dangerStrong: c.status.dangerStrong,
  swatchBorder: c.border.swatch, scrim: c.overlay.scrim, whiteAlpha: c.overlay.whiteAlpha };
export const Colors = { ...palette, light: scheme, dark: scheme }; // key-complete light/dark
```

Adapter B (`theme/colors.ts`) projects the same `c.*` into the BNA shape (see `tokenFileTs` `bnaLightColors`). **Critical:** `darkColors` stays **key-identical** to `lightColors` (light projection for v1) or `useColor`'s `keyof light & keyof dark` intersection collapses and `theme-provider.tsx` `Colors.dark.{primary,background,card,text,border,red}` go `undefined`.

### 6.2 Migration steps

0. **Reconcile the two enumerations into ONE canonical hex set first** (done — §0, verifier-authoritative). Otherwise "declared once" ships pre-drifted.
1. **Add `theme/tokens.ts`** (ref + tokens.color + non-color tokens). No consumer change; typecheck passes.
2. **Convert `constants/theme.ts` → Adapter A.** Keep `Colors.dark` **key-complete** (fill `dark.icon` etc. with the light projection — do not leave `{}`, or `collapsible.tsx` `Colors.dark.icon` breaks). Verify: `grep -rE 'Colors\.(light|dark)\.' app components`.
3. **Convert `theme/colors.ts` → Adapter B.** Keep a key-complete `darkColors` **and** the `Colors = { light, dark }` wrapper. The a11y hex changes (`textMuted→#6A6A6A`, `secondaryForeground→#017A3A`, `icon→#6A6A6A`, `input→#929292`, `mutedForeground→#6A6A6A`) ride along automatically.
4. **Typecheck + build now** — zero consumer files changed; this is the safety gate proving the adapters are behavior-preserving (except intended a11y bumps).
5. **Codemod the dangerous reads, one category per passing build:**
   - (a) `Colors.accent`→`brand.orange` / `Colors.accentTint`→`brand.orangeTint`.
   - (b) **green/orange used as TEXT or behind-white-text fills** → `*Strong`: `ProductCard` price (`Colors.primary`→`primaryStrong`), `cart.tsx:186` total (`Colors.accent`→`accentStrong`), `ModeSwitch` active delivery pill fill→`primaryStrong` and active online pill fill→`accentStrong`. **This is required, not optional — until it lands these specific sites stay at 3.09/2.59.**
   - (c) **`button.tsx`/`badge.tsx`**: repoint `useColor('red')`→`useColor('destructive')` (now `#C9252B`) and `useColor('green')`→`useColor('success')` (`#017A3A`). The status fix does **not** ride along automatically — these read the iOS `system.green #34C759` / `system.red #E5484D` passthroughs, which fail behind white labels.
6. **Delete deprecated `accent`/`accentForeground` (BNA) and the `accent` alias** only after a clean grep shows zero references.
7. **Delete the dead Expo-template cluster** (`collapsible.tsx`, `components/themed-*`, `hooks/use-theme-color.ts`, the duplicate `hooks/useThemeColor.ts`, stray `semanticColors`) once unreferenced — removes the last `Colors.dark.icon` reader and the "third green/red set".
8. **ESLint `no-restricted-syntax`** banning hex literals outside `theme/tokens.ts` locks the single-source invariant.
9. **Dark mode later:** add a `tokens.color` dark variant; `darkColors` becomes its real projection. v1 stays light-only with the placeholder dark projection keeping the build green.

---

## 7. Mapping table: old tokens → new

### 7.1 Family A — `constants/theme.ts` flat `Colors`

| Old key (old hex) | New semantic token | New hex | Note |
|---|---|---|---|
| `background` | `bg.canvas` | `#F2F3F5` | — |
| `backgroundAlt`, `surface` | `surface.base` | `#FFFFFF` | — |
| — (new) | `surface.muted` | `#EEF1F3` | parity with BNA `muted` |
| `primary` | `brand.green` | `#00A94F` | graphic only now |
| — (new) | `brand.greenStrong` | `#017A3A` | **price/pill text sites move here** |
| `primaryDark` | `brand.greenDark` | `#018A3F` | decorative gradient |
| `primaryTint` | `brand.greenTint` | `#E2F5E9` | — |
| `accent` (`#F5821F`) | `brand.orange` | `#E06C0A` | retired `#F5821F`; graphic only |
| — (new) | `brand.orangeStrong` | `#B23E0A` | **cart total / online pill text move here** |
| `accentTint` | `brand.orangeTint` | `#FDECD9` | — |
| `text` | `text.default` | `#1E1E1E` | — |
| `textMuted` (`#9B9B9B`) | `text.muted` | `#6A6A6A` | a11y fix |
| `textOnPrimary` | `text.inverse` / `on.primary` | `#FFFFFF` | — |
| `star` | `star.decorative` | `#FBA72A` | decorative; pair w/ value |
| — (new) | `star.strong` | `#9C6B08` | informative standalone star |
| `border` | `border.default` | `#ECEFF1` | decorative hairline |
| — (new) | `border.strong` | `#929292` | visible control outline |
| `danger` | `status.danger` | `#E5484D` | icon only |
| — (new) | `status.dangerStrong` | `#C9252B` | destructive label/text |
| `swatchBorder` | `border.swatch` | `#E5E5E5` | — |
| `scrim` (`0.4`) | `overlay.scrim` | `rgba(30,30,30,0.55)` | deepened |
| `whiteAlpha` | `overlay.whiteAlpha` | `rgba(255,255,255,0.5)` | — |
| `light/dark.icon` (`#9B9B9B`) | `icon.default` | `#6A6A6A` | a11y fix |
| `light/dark.tabIconDefault` | `icon.muted` | `#6A6A6A` | a11y fix |
| `light/dark.tint`, `tabIconSelected` | `brand.green` | `#00A94F` | — |

### 7.2 Family B — `theme/colors.ts` `lightColors`

| Old key (old hex) | New semantic token | New hex | Note |
|---|---|---|---|
| `background` | `bg.canvas` | `#F2F3F5` | — |
| `foreground`, `cardForeground`, `popoverForeground`, `text` | `text.default` | `#1E1E1E` | — |
| `card`, `popover` | `surface.base` | `#FFFFFF` | — |
| `primary` (`#00A94F`) | `brand.greenStrong` | `#017A3A` | **default Button fill — fixes white-on-green 3.09→5.46** |
| `primaryForeground` | `on.primary` | `#FFFFFF` | — |
| `secondary`, `accent` (`#E2F5E9`) | `brand.greenTint` | `#E2F5E9` | `accent` = deprecated alias |
| `secondaryForeground`, `accentForeground` (`#018A3F`) | `text.brandGreen` | `#017A3A` | on tint 4.80:1 (fixes BDG-secondary) |
| `muted` | `surface.muted` | `#EEF1F3` | — |
| `mutedForeground` (`#9B9B9B`) | `text.muted` | `#6A6A6A` | a11y fix |
| `destructive` (`#E5484D`) | `status.dangerStrong` | `#C9252B` | **fixes white-on-red 3.91→5.55** |
| `destructiveForeground` | `status.dangerFg` | `#FFFFFF` | — |
| `border` | `border.default` | `#ECEFF1` | decorative hairline |
| `input` (`#ECEFF1`) | `border.input` | `#929292` | **visible control outline (3.11:1)** |
| `ring` (`#00A94F`) | `focus.ring` | `#017A3A` | stronger ring (5.46) |
| `textMuted` (`#9B9B9B`) | `text.muted` | `#6A6A6A` | a11y fix |
| `tint`, `tabIconSelected` | `brand.green` | `#00A94F` | vivid graphic |
| `icon` (`#6E6E6E`) | `icon.default` | `#6A6A6A` | unify w/ Family A |
| `tabIconDefault` (`#9B9B9B`) | `icon.muted` | `#6A6A6A` | a11y fix |
| `green`/`red` (read by button/badge) | `status.success`/`status.dangerStrong` | `#017A3A`/`#C9252B` | **needs codemod (5c)** |
| `blue…indigo` | `system.*` | iOS hues | decorative, NOT AA-guaranteed |
| `orange` (`#F5821F`) | `brand.orange` | `#E06C0A` | shares flat `accent` source |
| `star` | `star.decorative` | `#FBA72A` | — |
| (dead) `semanticColors` | `status.success/warning/info/danger` | — | replaced |

### 7.3 Typography variant mapping

| Old (Family A `Typography`) | Old (Family B `TextVariant`) | Canonical |
|---|---|---|
| `display` | — | `display` |
| — | `heading` | `heading` |
| `banner` | `title` | `title` |
| `h1` | `subtitle` | `subtitle` |
| `body` | `body` | `body` (promo input 14→15) |
| `h2` | — (inline SemiBold) | `bodyStrong` |
| `price` | — (inline Bold) | `price` |
| `button` | — (hardcoded button/badge) | `button` |
| `caption` | `caption` | `caption` |
| — | `link` | `link` |
| — | — | `label` (optional, new) |

---

## 8. Notes carried into Residual Open Items
The banner scrim (`#FFFFFF` over `rgba(30,30,30,0.55)`) is verified against the *solid scrim base* only (16.67:1); real-photo worst-case luminance still needs a runtime/gradient guarantee. `status.info` is reserved and **not** in the verifier's tested set. See the residual list.


---

## WARM rebrand — coral primary / green accent on peach (2026-06)

อู้ฟู่ reverted from the 7-Eleven-green direction back to its iconic **coral** identity,
re-hued to match the liked "Oroshi" delivery reference: **coral/orange PRIMARY on a warm
peach canvas**, with **GREEN reserved exclusively for success / discount** signals.

The 3-tier architecture is untouched. Only Tier-1 `ref.*` hex changed and the Tier-2
semantic tokens were renamed to **role-based** names (`brand.primary*` = coral,
`brand.accent*` = green, `text.brandPrimary` / `text.brandAccent`). Every Tier-3 adapter
export key (`flatColors.*`, `bnaLightColors.*`) is byte-identical to the green build, so
no component import changed — the rebrand is a pure token re-projection.

### Role map (key names frozen)
| Adapter key | Was (green build) | Now (warm) | Role |
| --- | --- | --- | --- |
| `primary` (flat) | green500 | **coral500 #F15929** | vivid brand graphic / tab tint (3:1) |
| `primaryStrong` | green700 | **coralStrong #B83C18** | text + behind-white CTA fill (4.5:1) |
| `accent` (flat) | orange500 | **green500 #1E9E5C** | success/discount graphic (3:1) |
| `accentStrong` | orange700 | **greenStrong #017A3A** | success/discount text + fill (4.5:1) |
| `primary` (bna Button) | greenStrong | **coralStrong #B83C18** | default Button fill |
| `ring` / focus | greenStrong | **coralStrong #B83C18** | focus ring |
| `success` | green700 | **greenStrong #017A3A** | unchanged role, green stays green |
| `warning` | orange700 | **amber700 #946508** | separated from coral so it reads distinct |

### Tier-1 hex (warm)
`white #FFFFFF` · `ink #1E1E1E` · `peach50 #FBEFE9` (canvas) · `warmMuted100 #F3EDE9` ·
`borderHair #EFE4DD` · `swatch300 #E7DAD2` · `borderStrong #948984` · `warmGray600 #6E625C` ·
`coral500 #F15929` · `coral600 #DA5226` · `coralStrong #B83C18` · `coralTint #FCE7DE` ·
`green500 #1E9E5C` · `green600 #178A4E` · `greenStrong #017A3A` · `greenTint #DCF3E5` ·
`red500 #E5484D` · `red700 #C9252B` · `amber500 #FBA72A` · `amber700 #946508` ·
`blueInfo #2563EB` (reserved).

### Verified WCAG 2.1 AA ratios (sRGB relative luminance; `white / peach #FBEFE9`)
Brand TEXT + white-on-fill (15px normal labels, require ≥ 4.5:1):
- `coralStrong #B83C18` text: **5.68 / 5.04**; on coralTint **4.77**; white-on-coralStrong **5.68** — PASS
- `greenStrong #017A3A` text: **5.46 / 4.84**; on greenTint **4.68**; white-on-greenStrong **5.46** — PASS
- `red700 #C9252B` text / white-on: **5.55** — PASS
- `amber700 #946508` text / white-on: **5.09 / 4.52** — PASS
- `ink #1E1E1E`: **16.67 / 14.79** (14.37 on warmMuted) — PASS
- `warmGray600 #6E625C` muted: **5.89 / 5.23** (5.08 on warmMuted) — PASS both surfaces

Graphic / UI / large-text only (require ≥ 3:1, NEVER 15px label text):
- `coral500 #F15929`: **3.39 / 3.00**; white-on-coral500 **3.39** — PASS (use coralStrong for any coral-on-peach text)
- `green500 #1E9E5C`: **3.44 / 3.05** — PASS
- `red500 #E5484D`: **3.91** white — PASS
- `borderStrong #948984` input/control outline: **3.40 / 3.02** — PASS
- `amber500 #FBA72A` decorative star: **1.97** — decorative-exempt, MUST pair with a numeric value

### Verifier corrections applied (hue-preserving darken)
Three refs failed a threshold on the peach canvas and were minimally darkened (HLS hue+sat
held, lightness lowered) so the entire palette passes at every required threshold:
- `coral500` #F2683C → **#F15929** (peach UI 2.73 → **3.00**)
- `borderStrong` #948A85 → **#948984** (peach UI 2.99 → **3.02**)
- `amber700` #9C6B08 → **#946508** (peach AA 4.12 → **4.52**)

The critical brand text/fill checks (`coralStrong`, `greenStrong`, `red700`) held with no
change. Vivid `coral500`/`green500` and white-on-`coral500` are valid for large text /
graphics at 3:1 only — use the `*Strong` variants for normal-size labels.

### Cart total
The grand total previously read `Colors.accentStrong`, which after the rebrand is GREEN —
now reserved for success/discount, so it would mis-signal. Repointed to `Colors.text`
(ink `#1E1E1E`, 14.79:1 on peach) to match the reference's near-black totals, give the
highest contrast, and keep coral reserved for interactive CTAs/prices so the total reads as
a definitive figure, not a tappable element. Branded fallback (if owner prefers): `Colors.primaryStrong` (coral #B83C18, 5.04:1 on peach).
