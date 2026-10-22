import {
  categoryLabel as categoryLabelFor,
  describeLine as describeLineFor,
  formatQty as formatQtyFor,
  formatRate as formatRateFor,
  formatTotals as formatTotalsFor,
  formatWeight as formatWeightFor,
  PAYMENT_LABELS_EN,
  unitSuffix as unitSuffixFor,
  type Category,
  type Unit,
} from "@kumbakonam/shared/core";

// The counter screen shows weights, counts, rates and category names in English; the printed bill asks the same
// core functions for Tamil (their default). Product names are not touched here: they stay Tamil (itemName).

export const formatWeight = (grams: number) => formatWeightFor(grams, "en");
export const formatQty = (qty: number) => formatQtyFor(qty, "en");
export const formatRate = (rateMinor: number, unit: Unit) => formatRateFor(rateMinor, unit, "en");
export const formatTotals = (totalGrams: number, totalPieces: number) => formatTotalsFor(totalGrams, totalPieces, "en");
export const unitSuffix = (unit: Unit) => unitSuffixFor(unit, "en");
export const describeLine = (line: Parameters<typeof describeLineFor>[0]) => describeLineFor(line, "en");
export const categoryLabel = (key: string, categories?: Category[]) => categoryLabelFor(key, categories, "en");

/** Cash, UPI, Split, Credit. */
export const PAYMENT_NAMES = PAYMENT_LABELS_EN;
