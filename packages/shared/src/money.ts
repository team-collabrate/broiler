// Money is integer paise and weight is integer grams everywhere, so totals never
// pick up floating-point drift. Format only at the edge, when showing a value.

export const CURRENCY_SYMBOL = '₹';

/** Price of `grams` of an item that costs `pricePerKgMinor` per kg, rounded to the nearest paisa. */
export function lineTotalMinor(pricePerKgMinor: number, grams: number): number {
  return Math.round((pricePerKgMinor * grams) / 1000);
}

export function formatMoney(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const amount = (Math.abs(minor) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${CURRENCY_SYMBOL}${amount}`;
}

/** `850 g` below one kilo, otherwise `1.25 kg` (up to three decimals, trailing zeros trimmed). */
export function formatWeight(grams: number): string {
  if (grams < 1000) return `${grams} g`;
  const kg = (grams / 1000).toFixed(3).replace(/\.?0+$/, '');
  return `${kg} kg`;
}

const KG_INPUT = /^\d{0,3}(\.\d{0,3})?$/;

/** True while `text` is a valid partial kg entry: up to 3 integer and 3 decimal digits. */
export function isValidKgInput(text: string): boolean {
  return KG_INPUT.test(text);
}

/** Parses a kg entry like `1.25` into whole grams (1250). Returns null if empty, malformed, or zero. */
export function parseKgInput(text: string): number | null {
  if (!KG_INPUT.test(text)) return null;
  const [whole = '', fraction = ''] = text.split('.');
  const grams = (whole === '' ? 0 : parseInt(whole, 10)) * 1000 + parseInt(fraction.padEnd(3, '0') || '0', 10);
  return grams > 0 ? grams : null;
}
