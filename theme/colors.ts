/**
 * BNA UI color tokens — customized to the "อู้ฟู่" brand (warm peach + coral).
 * Same token shape BNA components expect, so every BNA component is on-brand.
 * Consumed via the useColor() hook. A few brand extras (e.g. `star`) are added.
 */

const lightColors = {
  // Base
  background: '#FBEFE9', // warm peach app background
  foreground: '#1E1E1E',

  // Card / surface
  card: '#FFFFFF',
  cardForeground: '#1E1E1E',

  // Popover
  popover: '#FFFFFF',
  popoverForeground: '#1E1E1E',

  // Primary (อู้ฟู่ coral)
  primary: '#F2683C',
  primaryForeground: '#FFFFFF',

  // Secondary (light coral tint)
  secondary: '#FCE7DE',
  secondaryForeground: '#B4532A',

  // Muted
  muted: '#FCE7DE',
  mutedForeground: '#9B9B9B',

  // Accent
  accent: '#FCE7DE',
  accentForeground: '#B4532A',

  // Destructive
  destructive: '#E5484D',
  destructiveForeground: '#FFFFFF',

  // Border / input
  border: '#F0E6E0',
  input: '#F0E6E0',
  ring: '#F2683C',

  // Text
  text: '#1E1E1E',
  textMuted: '#9B9B9B',

  // Legacy support for existing components
  tint: '#F2683C',
  icon: '#6E6E6E',
  tabIconDefault: '#9B9B9B',
  tabIconSelected: '#F2683C',

  // System accents
  blue: '#007AFF',
  green: '#34C759',
  red: '#E5484D',
  orange: '#FF9500',
  yellow: '#FFCC00',
  pink: '#FF7DA8',
  purple: '#AF52DE',
  teal: '#5AC8FA',
  indigo: '#5856D6',

  // Brand extras
  star: '#FBA72A', // rating stars (gold)
};

const darkColors = {
  // Base
  background: '#17120F',
  foreground: '#FFFFFF',

  // Card / surface
  card: '#221A16',
  cardForeground: '#FFFFFF',

  // Popover
  popover: '#221A16',
  popoverForeground: '#FFFFFF',

  // Primary (อู้ฟู่ coral stays vivid in dark)
  primary: '#F2683C',
  primaryForeground: '#FFFFFF',

  // Secondary
  secondary: '#2A211C',
  secondaryForeground: '#F2A883',

  // Muted
  muted: '#2A211C',
  mutedForeground: '#A89E99',

  // Accent
  accent: '#2A211C',
  accentForeground: '#F2A883',

  // Destructive
  destructive: '#FF5A5F',
  destructiveForeground: '#FFFFFF',

  // Border / input
  border: '#342B24',
  input: '#342B24',
  ring: '#F2683C',

  // Text
  text: '#FFFFFF',
  textMuted: '#A89E99',

  // Legacy support for existing components
  tint: '#F2683C',
  icon: '#A89E99',
  tabIconDefault: '#A89E99',
  tabIconSelected: '#F2683C',

  // System accents
  blue: '#0A84FF',
  green: '#30D158',
  red: '#FF5A5F',
  orange: '#FF9F0A',
  yellow: '#FFD60A',
  pink: '#FF7DA8',
  purple: '#BF5AF2',
  teal: '#64D2FF',
  indigo: '#5E5CE6',

  // Brand extras
  star: '#FBA72A',
};

export const Colors = {
  light: lightColors,
  dark: darkColors,
};

// Export individual color schemes for easier access
export { darkColors, lightColors };

// Utility type for color keys
export type ColorKeys = keyof typeof lightColors;

// Helper function to get color with opacity (useful for React Native)
export const withOpacity = (color: string, opacity: number) => {
  if (color.startsWith('rgba')) {
    return color;
  }
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return color;
};

// Semantic color mappings for common UI patterns
export const semanticColors = {
  light: {
    success: '#22c55e',
    successForeground: '#ffffff',
    warning: '#f59e0b',
    warningForeground: '#ffffff',
    info: '#3b82f6',
    infoForeground: '#ffffff',
    error: '#ef4444',
    errorForeground: '#ffffff',
  },
  dark: {
    success: '#16a34a',
    successForeground: '#ffffff',
    warning: '#d97706',
    warningForeground: '#ffffff',
    info: '#2563eb',
    infoForeground: '#ffffff',
    error: '#dc2626',
    errorForeground: '#ffffff',
  },
};
