// Pure sale maths: money, weight and cart lines. Money is integer paise and weight is
// integer grams everywhere, so totals never pick up floating-point drift. Format only at
// the edge, when showing a value. Keep this file free of runtime imports from sibling
// files so the unit tests can load it directly under Node.
import type { OrderLineInput } from './types';

export const CURRENCY_SYMBOL = '₹';

// --- Weight limits and stepping -------------------------------------------------------

/** The weight meter moves in steps of this many grams. */
export const WEIGHT_STEP_GRAMS = 50;

/** Smallest weight the meter allows. */
export const MIN_GRAMS = WEIGHT_STEP_GRAMS;

/** 999.999 kg: the most the keypad can enter, kept as a ceiling when weights are merged. */
export const MAX_LINE_GRAMS = 999_999;

/** What the sale panel starts at for an item that has no valid default weight of its own. */
export const DEFAULT_GRAMS = 1000;

/** An item's default weight from stored data: kept if it is a sensible whole number of grams, else the fallback. */
export function normalizeDefaultGrams(value: unknown): number {
  const ok = typeof value === 'number' && Number.isInteger(value) && value >= MIN_GRAMS && value <= MAX_LINE_GRAMS;
  return ok ? value : DEFAULT_GRAMS;
}

/** Next multiple of the step above `grams` (so 1235 g steps up to 1250 g), capped at the maximum. */
export function stepUpGrams(grams: number): number {
  return Math.min((Math.floor(grams / WEIGHT_STEP_GRAMS) + 1) * WEIGHT_STEP_GRAMS, MAX_LINE_GRAMS);
}

/** Previous multiple of the step below `grams` (so 1235 g steps down to 1200 g), never under the minimum. */
export function stepDownGrams(grams: number): number {
  const down = grams % WEIGHT_STEP_GRAMS === 0 ? grams - WEIGHT_STEP_GRAMS : Math.floor(grams / WEIGHT_STEP_GRAMS) * WEIGHT_STEP_GRAMS;
  return Math.max(down, MIN_GRAMS);
}

// --- Weight meter geometry ------------------------------------------------------------
// These two run inside gesture worklets on the UI thread while a finger drags the meter, so
// they are marked 'worklet' and must stay self-contained (no calls to other non-worklet code).
// MIN_GRAMS and WEIGHT_STEP_GRAMS are plain constants, which worklets capture.

/**
 * Weight under a finger at horizontal position `x` (from the left edge of the meter strip) on
 * a meter `width` wide with a handle `thumb` wide. The handle's centre travels from thumb/2
 * to width - thumb/2, so the ends of the scale line up with the ends of that travel. The result
 * snaps to the step and stays between the minimum weight and `maxGrams`.
 */
export function meterGramsFromX(x: number, width: number, thumb: number, maxGrams: number): number {
  'worklet';
  const travel = width - thumb;
  if (travel <= 0) return MIN_GRAMS;
  const fraction = Math.min(Math.max((x - thumb / 2) / travel, 0), 1);
  const snapped = Math.round((fraction * maxGrams) / WEIGHT_STEP_GRAMS) * WEIGHT_STEP_GRAMS;
  return Math.max(snapped, MIN_GRAMS);
}

/** Horizontal position of the handle's centre for `grams`; weights past `maxGrams` pin to the far end. */
export function meterXFromGrams(grams: number, width: number, thumb: number, maxGrams: number): number {
  'worklet';
  const travel = Math.max(width - thumb, 0);
  const fraction = Math.min(Math.max(grams / maxGrams, 0), 1);
  return thumb / 2 + fraction * travel;
}

// --- Pricing --------------------------------------------------------------------------

/** Price of `grams` of an item that costs `pricePerKgMinor` per kg, rounded to the nearest paisa. */
export function lineTotalMinor(pricePerKgMinor: number, grams: number): number {
  return Math.round((pricePerKgMinor * grams) / 1000);
}

/** Grams that `amountMinor` buys at `pricePerKgMinor` per kg, to the nearest gram. 0 if the item has no price. */
export function gramsForAmount(amountMinor: number, pricePerKgMinor: number): number {
  if (pricePerKgMinor <= 0) return 0;
  return Math.round((amountMinor * 1000) / pricePerKgMinor);
}

interface PricedLine {
  pricePerKgMinor: number;
  grams: number;
  /** Set when the line was sold for a fixed amount rather than by weight. */
  amountMinor?: number;
}

/**
 * What a line costs. A line sold for a fixed amount (₹100 of chicken) charges exactly that
 * amount; its grams are only the weight to weigh out. Otherwise it is priced from the weight.
 */
export function orderLineTotalMinor(line: PricedLine): number {
  return line.amountMinor ?? lineTotalMinor(line.pricePerKgMinor, line.grams);
}

// --- Formatting -----------------------------------------------------------------------

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

/** The small print under a line: `1.25 kg × ₹240.00/kg`, or `≈ 417 g (by amount)` for a fixed-amount line. */
export function describeLine(line: PricedLine): string {
  if (line.amountMinor !== undefined) return `≈ ${formatWeight(line.grams)} (by amount)`;
  return `${formatWeight(line.grams)} × ${formatMoney(line.pricePerKgMinor)}/kg`;
}

// --- Keypad entry ---------------------------------------------------------------------

const RUPEES_INPUT = /^\d{0,5}$/;

/** True while `text` is a valid partial rupee entry: whole rupees, up to 5 digits. */
export function isValidRupeesInput(text: string): boolean {
  return RUPEES_INPUT.test(text);
}

/** Parses a whole-rupee entry like `350` into paise (35000). Returns null if empty or zero. */
export function parseRupeesInput(text: string): number | null {
  if (!RUPEES_INPUT.test(text) || text === '') return null;
  const rupees = parseInt(text, 10);
  return rupees > 0 ? rupees * 100 : null;
}

const RATE_INPUT = /^\d{0,4}(\.\d{0,2})?$/;

/** Parses a per-kg rate entry like `240` or `240.50` into paise (24050). Returns null if empty, malformed, or zero. */
export function parseRateInput(text: string): number | null {
  if (!RATE_INPUT.test(text)) return null;
  const [whole = '', fraction = ''] = text.split('.');
  const minor = (whole === '' ? 0 : parseInt(whole, 10)) * 100 + parseInt(fraction.padEnd(2, '0') || '0', 10);
  return minor > 0 ? minor : null;
}

/** A rate in paise as editable text: `240` for ₹240.00, `240.50` for ₹240.50. */
export function formatRateInput(minor: number): string {
  return (minor / 100).toFixed(2).replace(/\.00$/, '');
}

/** Keypad key for deleting the last character. */
export const BACKSPACE_KEY = '⌫';

/** Keypad key for clearing the whole entry. */
export const CLEAR_KEY = 'C';

/** Applies one keypad press to a per-kg rate entry (up to 4 digits and 2 decimals). Invalid presses are ignored. */
export function applyRateKey(prev: string, key: string): string {
  if (key === BACKSPACE_KEY) return prev.slice(0, -1);
  if (key === '.') {
    if (prev.includes('.')) return prev;
    return prev === '' ? '0.' : `${prev}.`;
  }
  if (!/^\d$/.test(key)) return prev;
  if (prev === '0') return key === '0' ? prev : key; // no stacked leading zeros
  const next = prev + key;
  return RATE_INPUT.test(next) ? next : prev;
}

/** Applies one keypad press to a whole-rupee entry. Presses that would make it invalid are ignored. */
export function applyRupeesKey(prev: string, key: string): string {
  if (key === BACKSPACE_KEY) return prev.slice(0, -1);
  if (!/^\d$/.test(key)) return prev;
  if (prev === '' && key === '0') return prev; // no leading zero
  const next = prev + key;
  return isValidRupeesInput(next) ? next : prev;
}

// --- Cart -----------------------------------------------------------------------------

export type CartLine = OrderLineInput;

function mergeLines(existing: CartLine, added: CartLine): CartLine {
  const grams = Math.min(existing.grams + added.grams, MAX_LINE_GRAMS);
  if (existing.amountMinor === undefined && added.amountMinor === undefined) return { ...existing, grams };
  // At least one portion was sold for a fixed amount, so the merged line keeps the exact
  // sum of what each portion cost rather than re-pricing the combined weight.
  return { ...existing, grams, amountMinor: orderLineTotalMinor(existing) + orderLineTotalMinor(added) };
}

/** Adds a line. Selling the same item again adds to its existing line rather than starting a second one. */
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  if (!lines.some((l) => l.itemId === line.itemId)) {
    return [...lines, { ...line, grams: Math.min(line.grams, MAX_LINE_GRAMS) }];
  }
  return lines.map((l) => (l.itemId === line.itemId ? mergeLines(l, line) : l));
}

export function removeLine(lines: CartLine[], itemId: string): CartLine[] {
  return lines.filter((l) => l.itemId !== itemId);
}

export function cartTotals(lines: CartLine[]): { totalMinor: number; totalGrams: number } {
  return {
    totalMinor: lines.reduce((sum, l) => sum + orderLineTotalMinor(l), 0),
    totalGrams: lines.reduce((sum, l) => sum + l.grams, 0),
  };
}
