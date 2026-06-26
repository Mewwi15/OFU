/**
 * Shared formatting helpers.
 *
 * Hermes-safe Thai Baht formatter. Avoids Intl/toLocaleString (unreliable on
 * Hermes) and manually inserts thousands separators.
 *
 * money(165)   -> "฿165"
 * money(1250)  -> "฿1,250"
 * money(14.5)  -> "฿14.50"
 */
export function money(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const isWhole = rounded % 1 === 0;
  const [intPart, decPart] = rounded.toFixed(isWhole ? 0 : 2).split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '฿' + withCommas + (decPart ? '.' + decPart : '');
}
