// Pure sale maths: money, weight and cart lines. Money is integer paise and weight is
// integer grams everywhere, so totals never pick up floating-point drift. Format only at
// the edge, when showing a value. Keep this file free of runtime imports from sibling
// files so the unit tests can load it directly under Node.
import type { Method, OrderLineInput, Unit } from './types';

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

// --- Billing methods ---------------------------------------------------------------------

const ALLOWED_METHODS: Record<Unit, Method[]> = { kg: ['weight', 'amount'], piece: ['qty', 'amount'] };

/**
 * The billing methods for an item from stored data: only ones that make sense for its unit, in the
 * order given, no repeats. An item with none usable gets the usual ones (weight and amount for kg,
 * count for piece), so the sheet always has something to offer.
 */
export function normalizeMethods(unit: Unit, raw: unknown): Method[] {
  const allowed = ALLOWED_METHODS[unit];
  const picked = Array.isArray(raw) ? raw.filter((m, i, all): m is Method => allowed.includes(m) && all.indexOf(m) === i) : [];
  if (picked.length > 0) return picked;
  return unit === 'kg' ? ['weight', 'amount'] : ['qty'];
}

// --- Scroll wheels (the weight and count pickers) --------------------------------------------
// The pickers work like the iOS alarm: rows scroll under a fixed highlight, and the row in the
// highlight is the value. The maths is here so it can be tested; the gestures live in the app.

/** The wheel row nearest to a scroll offset, kept inside the list. */
export function wheelIndexFromOffset(offset: number, rowHeight: number, rowCount: number): number {
  'worklet';
  const index = Math.round(offset / rowHeight);
  return Math.min(Math.max(index, 0), Math.max(rowCount - 1, 0));
}

/** How far a drag is allowed to scroll the wheel: 0 up to the last row's offset. */
export function wheelMaxOffset(rowHeight: number, rowCount: number): number {
  'worklet';
  return Math.max(rowCount - 1, 0) * rowHeight;
}

/** Whole kilos and the grams part (a multiple of the step) that make up a weight, or null above the wheel's range. */
export function splitGrams(grams: number, maxKg: number): { kg: number; gramsPart: number } | null {
  const snapped = Math.round(grams / WEIGHT_STEP_GRAMS) * WEIGHT_STEP_GRAMS;
  const kg = Math.floor(snapped / 1000);
  return kg > maxKg ? null : { kg, gramsPart: snapped - kg * 1000 };
}

// --- Quantity (items sold by count) -----------------------------------------------------

/** The most of one piece item a single line can hold. */
export const MAX_QTY = 999;

/** What the quantity panel starts at for an item with no valid default count. */
export const DEFAULT_QTY = 1;

/** An item's default count from stored data: kept if it is a whole number from 1 to the maximum, else 1. */
export function normalizeDefaultQty(value: unknown): number {
  const ok = typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_QTY;
  return ok ? value : DEFAULT_QTY;
}

export function stepUpQty(qty: number): number {
  return Math.min(qty + 1, MAX_QTY);
}

export function stepDownQty(qty: number): number {
  return Math.max(qty - 1, 1);
}

// --- Pricing --------------------------------------------------------------------------

/** Price of `grams` of an item that costs `rateMinor` per kg, rounded to the nearest paisa. */
export function lineTotalMinor(rateMinor: number, grams: number): number {
  return Math.round((rateMinor * grams) / 1000);
}

/** Price of `qty` pieces at `rateMinor` each. */
export function pieceTotalMinor(rateMinor: number, qty: number): number {
  return rateMinor * qty;
}

/** Grams that `amountMinor` buys at `rateMinor` per kg, to the nearest gram. 0 if the item has no price. */
export function gramsForAmount(amountMinor: number, rateMinor: number): number {
  if (rateMinor <= 0) return 0;
  return Math.round((amountMinor * 1000) / rateMinor);
}

interface PricedLine {
  unit: Unit;
  rateMinor: number;
  grams: number;
  qty: number;
  /** Set when the line was sold for a fixed amount rather than by weight. */
  amountMinor?: number;
}

/**
 * What a line costs. A line sold for a fixed amount (₹100 of chicken) charges exactly that
 * amount; its grams are only the weight to weigh out. A piece line is rate × count; any other
 * line is priced from its weight.
 */
export function orderLineTotalMinor(line: PricedLine): number {
  // A line billed by amount charges exactly that, whatever the unit.
  if (line.amountMinor !== undefined) return line.amountMinor;
  return line.unit === 'piece' ? pieceTotalMinor(line.rateMinor, line.qty) : lineTotalMinor(line.rateMinor, line.grams);
}

// --- Price adjustment -------------------------------------------------------------------

/** The counter raises or lowers a sale's rate in steps of this many paise (₹5). */
export const ADJUST_STEP_MINOR = 500;

/** How far the counter may move a rate from the list rate unless the owner sets another limit (₹20). */
export const DEFAULT_MAX_ADJUST_MINOR = 2000;

/** The counter's adjustment limit from stored data: a whole number of steps, never negative; the default if unusable. */
export function normalizeMaxAdjust(value: unknown): number {
  const ok = typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100_000;
  return ok ? Math.floor(value / ADJUST_STEP_MINOR) * ADJUST_STEP_MINOR : DEFAULT_MAX_ADJUST_MINOR;
}

/** How far a line's rate sits from its list rate: negative is a reduction. */
export function adjustmentMinor(line: { rateMinor: number; listRateMinor: number }): number {
  return line.rateMinor - line.listRateMinor;
}

/** `rateMinor` held within `maxAdjustMinor` of the list rate, and above zero. */
export function clampRate(rateMinor: number, listRateMinor: number, maxAdjustMinor: number): number {
  const lowest = Math.max(listRateMinor - maxAdjustMinor, 1);
  const highest = listRateMinor + maxAdjustMinor;
  return Math.min(Math.max(rateMinor, lowest), highest);
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

/** `850 கிராம்` below one kilo, otherwise `1.25 கிலோ` (up to three decimals, trailing zeros trimmed). */
export function formatWeight(grams: number): string {
  if (grams < 1000) return `${grams} கிராம்`;
  const kg = (grams / 1000).toFixed(3).replace(/\.?0+$/, '');
  return `${kg} கிலோ`;
}

/** `3 எண்`: a count of pieces or packets. */
export function formatQty(qty: number): string {
  return `${qty} எண்`;
}

/** The per-unit suffix of a rate: `/கிலோ` or `/எண்`. */
export function unitSuffix(unit: Unit): string {
  return unit === 'piece' ? '/எண்' : '/கிலோ';
}

/** A rate with its unit: `₹240.00/கிலோ`. */
export function formatRate(rateMinor: number, unit: Unit): string {
  return `${formatMoney(rateMinor)}${unitSuffix(unit)}`;
}

/** A weight and/or a count together, e.g. `1.5 கிலோ · 3 எண்`; empty when there is neither. */
export function formatTotals(totalGrams: number, totalPieces: number): string {
  return [totalGrams > 0 ? formatWeight(totalGrams) : '', totalPieces > 0 ? formatQty(totalPieces) : ''].filter(Boolean).join(' · ');
}

/** How much of a line was sold: its weight (`≈` for a fixed-amount line) or its count. */
export function formatLineQuantity(line: PricedLine): string {
  if (line.unit === 'piece') return formatQty(line.qty);
  return line.amountMinor !== undefined ? `≈ ${formatWeight(line.grams)}` : formatWeight(line.grams);
}

/** The small print under a line: `1.25 கிலோ × ₹240.00/கிலோ`, `3 எண் × ₹10.00/எண்`, or `≈ 417 கிராம் (தொகைப்படி)`. */
export function describeLine(line: PricedLine): string {
  if (line.unit === 'piece') {
    return line.amountMinor !== undefined
      ? `${formatQty(line.qty)} (தொகைப்படி)`
      : `${formatQty(line.qty)} × ${formatRate(line.rateMinor, 'piece')}`;
  }
  if (line.amountMinor !== undefined) return `≈ ${formatWeight(line.grams)} (தொகைப்படி)`;
  return `${formatWeight(line.grams)} × ${formatRate(line.rateMinor, 'kg')}`;
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

const QTY_INPUT = /^\d{0,3}$/;

/** Parses a typed count like `12` (1 to 999). Returns null if empty, zero or malformed. */
export function parseQtyInput(text: string): number | null {
  if (!QTY_INPUT.test(text) || text === '') return null;
  const qty = parseInt(text, 10);
  return qty >= 1 && qty <= MAX_QTY ? qty : null;
}

/** Applies one keypad press to a count entry (up to 3 digits, no leading zero). Invalid presses are ignored. */
export function applyQtyKey(prev: string, key: string): string {
  if (key === BACKSPACE_KEY) return prev.slice(0, -1);
  if (!/^\d$/.test(key)) return prev;
  if (prev === '' && key === '0') return prev;
  const next = prev + key;
  return QTY_INPUT.test(next) ? next : prev;
}

/** Applies one keypad press to a whole-rupee entry. Presses that would make it invalid are ignored. */
export function applyRupeesKey(prev: string, key: string): string {
  if (key === BACKSPACE_KEY) return prev.slice(0, -1);
  if (!/^\d$/.test(key)) return prev;
  if (prev === '' && key === '0') return prev; // no leading zero
  const next = prev + key;
  return isValidRupeesInput(next) ? next : prev;
}

// --- Split payment and credit ---------------------------------------------------------------

/**
 * Divides a bill between GPay and cash. Only the GPay figure is ever stored; cash is whatever is left,
 * so the two can never drift out of step with the bill. A GPay amount outside 0..total is held inside it.
 */
export function splitPayment(totalMinor: number, upiMinor: number): { upiMinor: number; cashMinor: number } {
  const upi = Math.min(Math.max(Number.isFinite(upiMinor) ? Math.round(upiMinor) : 0, 0), Math.max(totalMinor, 0));
  return { upiMinor: upi, cashMinor: Math.max(totalMinor, 0) - upi };
}

/** True when both halves are real: a "split" with nothing on one side is just cash or UPI. */
export function isRealSplit(totalMinor: number, upiMinor: number): boolean {
  const { upiMinor: upi, cashMinor } = splitPayment(totalMinor, upiMinor);
  return upi > 0 && cashMinor > 0;
}

/** The two boxes of the split sheet. */
export type SplitSide = 'upi' | 'cash';

/**
 * The GPay half that follows from an amount typed into one box of the split sheet: typing in the GPay box is the GPay
 * half itself, typing in the cash box leaves GPay as what is left of the bill. The result is always held inside the bill.
 */
export function upiFromTyped(totalMinor: number, side: SplitSide, typedMinor: number): number {
  return splitPayment(totalMinor, side === 'upi' ? typedMinor : totalMinor - typedMinor).upiMinor;
}

/** Customers whose name contains what was typed (ignoring case and extra spaces), in the order given. Nothing typed keeps everyone. */
export function filterCustomersByName<T extends { nameKey: string }>(customers: T[], typed: string): T[] {
  const key = customerNameKey(typed);
  return key === '' ? customers : customers.filter((c) => c.nameKey.includes(key));
}

/** Match key for a returning customer: trimmed, collapsed spaces, lower-cased. "Ravi Stores" and "ravi  stores" are one person. */
export function customerNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The customer's tidy display name: trimmed, with runs of spaces collapsed. */
export function tidyCustomerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** A document id for a customer, derived from the name so the same name always finds the same record. */
export function customerIdFromName(name: string): string {
  return encodeURIComponent(customerNameKey(name)).replace(/\./g, '%2E').slice(0, 300);
}

/** Longest customer name accepted. */
export const MAX_CUSTOMER_NAME = 120;

/** Why a payment against a balance is refused, or null when it is fine. Overpaying would push the balance below zero and drop the customer off the list with debt still owed. */
export function paymentProblem(amountMinor: number, balanceMinor: number): 'none' | 'zero' | 'tooMuch' | null {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) return 'zero';
  if (amountMinor > balanceMinor) return 'tooMuch';
  return null;
}

// --- Cart -----------------------------------------------------------------------------

/**
 * The most lines one order can hold: five is plenty for a chicken and mutton counter, and a customer with more is billed
 * as two bills. The Firestore rules check every line at a fixed position and each request may evaluate at most 1000
 * expressions; five lines is what lets the rules check each line fully (see firestore.rules). The rules and this number
 * must change together.
 */
export const MAX_ORDER_LINES = 5;

/** A line in the cart. `key` tells apart two lines of the same item sold at different rates. */
export type CartLine = OrderLineInput & { key: string };

/** Lines merge only when they are the same item at the same rate; a different rate is its own line. */
function canMerge(existing: CartLine, added: OrderLineInput): boolean {
  return existing.itemId === added.itemId && existing.rateMinor === added.rateMinor && existing.listRateMinor === added.listRateMinor;
}

function mergeLines(existing: CartLine, added: OrderLineInput): CartLine {
  const grams = Math.min(existing.grams + added.grams, MAX_LINE_GRAMS);
  const qty = Math.min(existing.qty + added.qty, MAX_QTY);
  if (existing.amountMinor === undefined && added.amountMinor === undefined) return { ...existing, grams, qty };
  // At least one portion was sold for a fixed amount, so the merged line keeps the exact
  // sum of what each portion cost rather than re-pricing the combined weight.
  return { ...existing, grams, qty, amountMinor: orderLineTotalMinor(existing) + orderLineTotalMinor(added) };
}

function nextKey(lines: CartLine[], itemId: string): string {
  const used = lines.filter((l) => l.itemId === itemId).map((l) => Number(l.key.slice(l.key.lastIndexOf('#') + 1)) || 0);
  return `${itemId}#${Math.max(0, ...used) + 1}`;
}

/** False when adding `line` would start a 21st line. Adding to an existing line is always allowed. */
export function canAddLine(lines: CartLine[], line: OrderLineInput): boolean {
  return lines.length < MAX_ORDER_LINES || lines.some((l) => canMerge(l, line));
}

/** Adds a line. Selling the same item again at the same rate adds to its existing line. */
export function addLine(lines: CartLine[], line: OrderLineInput): CartLine[] {
  if (lines.some((l) => canMerge(l, line))) {
    return lines.map((l) => (canMerge(l, line) ? mergeLines(l, line) : l));
  }
  const capped = { ...line, grams: Math.min(line.grams, MAX_LINE_GRAMS), qty: Math.min(line.qty, MAX_QTY) };
  return [...lines, { ...capped, key: nextKey(lines, line.itemId) }];
}

/** Replaces the line with `key` by an edited one, keeping its place and key. No merging: an edit is exactly what was entered. */
export function replaceLine(lines: CartLine[], key: string, line: OrderLineInput): CartLine[] {
  return lines.map((l) => (l.key === key ? { ...line, grams: Math.min(line.grams, MAX_LINE_GRAMS), qty: Math.min(line.qty, MAX_QTY), key } : l));
}

export function removeLine(lines: CartLine[], key: string): CartLine[] {
  return lines.filter((l) => l.key !== key);
}

/**
 * Moves one line's rate by `deltaMinor`, held within `maxAdjustMinor` of its list rate. A line
 * sold for a fixed amount keeps charging that amount; the weight to weigh out follows the new rate.
 */
export function adjustLine(lines: CartLine[], key: string, deltaMinor: number, maxAdjustMinor: number): CartLine[] {
  return lines.map((l) => {
    if (l.key !== key) return l;
    const rateMinor = clampRate(l.rateMinor + deltaMinor, l.listRateMinor, maxAdjustMinor);
    if (l.amountMinor === undefined) return { ...l, rateMinor };
    const grams = Math.min(Math.max(gramsForAmount(l.amountMinor, rateMinor), 1), MAX_LINE_GRAMS);
    return { ...l, rateMinor, grams };
  });
}

export function cartTotals(lines: CartLine[]): { totalMinor: number; totalGrams: number; totalPieces: number } {
  return {
    totalMinor: lines.reduce((sum, l) => sum + orderLineTotalMinor(l), 0),
    totalGrams: lines.reduce((sum, l) => sum + l.grams, 0),
    totalPieces: lines.reduce((sum, l) => sum + l.qty, 0),
  };
}
