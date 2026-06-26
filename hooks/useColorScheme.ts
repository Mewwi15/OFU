/**
 * The อู้ฟู่ app is light-first (warm peach + coral brand). We pin the scheme to
 * 'light' for now so BNA components and the bespoke shop components stay visually
 * consistent. To enable dark mode later, return RN's `useColorScheme()` here and
 * make the bespoke components theme-aware.
 */
export function useColorScheme(): 'light' | 'dark' {
  return 'light';
}
