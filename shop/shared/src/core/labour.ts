// The labour salary book: daily-wage workers, what each earned a day, what was paid and what was lent as an advance.
// Pure TypeScript (no Firebase) so every rule here is tested under `npm test`. Money is integer paise.

/** What a day was: a day's work, leave, a double day, a vehicle trip, or any other amount. */
export type LabourKind = 'work' | 'leave' | 'double' | 'vehicle' | 'other';

export const LABOUR_KINDS: readonly LabourKind[] = ['work', 'leave', 'double', 'vehicle', 'other'];

export interface Labourer {
  id: string;
  name: string;
  /** The usual pay for a day's work, in paise. */
  dayWageMinor: number;
  /** What was owed (positive) or lent (negative) before this book started, in paise. */
  openingMinor: number;
  /** False for someone who has left: their history stays, they just leave the list. */
  active: boolean;
}

export interface LabourEntry {
  id: string;
  labourerId: string;
  /** The day, `YYYY-MM-DD`. */
  dayKey: string;
  kind: LabourKind;
  /** What the day earned, in paise (0 for leave). */
  earnedMinor: number;
  /** Cash paid out that day, in paise. */
  paidMinor: number;
  /** Money lent that day, in paise: taken off what the worker is owed. */
  advanceMinor: number;
  note: string;
  createdAt: Date;
}

/** What a day earns: the usual wage, nothing for leave, twice the wage for a double day; a trip or other is typed. */
export function earnedFor(kind: LabourKind, dayWageMinor: number, typedMinor = 0): number {
  switch (kind) {
    case 'work':
      return dayWageMinor;
    case 'double':
      return dayWageMinor * 2;
    case 'leave':
      return 0;
    default:
      return typedMinor;
  }
}

/**
 * What the shop owes the worker: the opening amount plus everything earned, less everything paid and lent. Positive
 * means the shop owes the worker; negative means the worker owes the shop (an advance not yet worked off).
 */
export function labourBalance(openingMinor: number, entries: Pick<LabourEntry, 'earnedMinor' | 'paidMinor' | 'advanceMinor'>[]): number {
  return entries.reduce((sum, e) => sum + e.earnedMinor - e.paidMinor - e.advanceMinor, openingMinor);
}

/** Why an entry cannot be saved, or null when it is fine. Every amount is a whole number of paise, never negative. */
export function labourEntryProblem(e: Pick<LabourEntry, 'kind' | 'earnedMinor' | 'paidMinor' | 'advanceMinor'>): 'kind' | 'amount' | 'empty' | null {
  if (!LABOUR_KINDS.includes(e.kind)) return 'kind';
  for (const v of [e.earnedMinor, e.paidMinor, e.advanceMinor]) {
    if (!Number.isInteger(v) || v < 0 || v > 100_000_000) return 'amount';
  }
  // Leave may be recorded with no money; any other day needs something in it.
  if (e.kind !== 'leave' && e.earnedMinor === 0 && e.paidMinor === 0 && e.advanceMinor === 0) return 'empty';
  return null;
}

/** How many days since `fromKey` (inclusive) the worker earned something. */
export function daysWorkedSince(entries: Pick<LabourEntry, 'dayKey' | 'earnedMinor'>[], fromKey: string): number {
  return new Set(entries.filter((e) => e.dayKey >= fromKey && e.earnedMinor > 0).map((e) => e.dayKey)).size;
}

/** The day of a sheet date like `12.10.26` as `2026-10-12`; null when it is not a date. */
export function dayKeyFromSheetDate(text: string): string | null {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), 2000 + Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
