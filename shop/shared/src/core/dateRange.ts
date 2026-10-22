export type RangePreset = 'today' | 'yesterday' | 'last7';

export interface DateRange {
  /** Inclusive. */
  start: Date;
  /** Exclusive. */
  end: Date;
  label: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as `YYYY-MM-DD`. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Built from calendar fields rather than adding 24h, so DST changes can't shift a boundary.
function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export const RANGE_PRESETS: RangePreset[] = ['today', 'yesterday', 'last7'];

export function rangeFor(preset: RangePreset, now: Date = new Date()): DateRange {
  const today = startOfDay(now);
  switch (preset) {
    case 'today':
      return { start: today, end: addDays(today, 1), label: 'இன்று' };
    case 'yesterday':
      return { start: addDays(today, -1), end: today, label: 'நேற்று' };
    case 'last7':
      return { start: addDays(today, -6), end: addDays(today, 1), label: 'கடந்த 7 நாட்கள்' };
  }
}

// --- Days as keys: the owner's reports --------------------------------------------------------------------------------

/** Full bills are kept for this many days (today and the days before it); older days are kept as daily totals. */
export const KEEP_DAYS = 4;

/** Local midnight at the start of a `YYYY-MM-DD` day. */
export function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The day `days` after (or, negative, before) a `YYYY-MM-DD` day. */
export function addDaysToKey(key: string, days: number): string {
  return dayKey(addDays(keyToDate(key), days));
}

/** Every day from `fromKey` to `toKey`, both included (at most 400, as a guard). */
export function daysInclusive(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  for (let k = fromKey; k <= toKey && out.length < 400; k = addDaysToKey(k, 1)) out.push(k);
  return out;
}

/** The oldest day whose full bills are still kept: today and the 3 days before it. */
export function firstKeptDay(now: Date = new Date()): string {
  return addDaysToKey(dayKey(now), -(KEEP_DAYS - 1));
}

/** The Monday of this week (weeks run Monday to Sunday). */
export function weekStartKey(now: Date = new Date()): string {
  return addDaysToKey(dayKey(now), -((now.getDay() + 6) % 7));
}

/** The 1st of this month. */
export function monthStartKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
}

export type ReportPeriod =
  | { kind: 'today' }
  | { kind: 'yesterday' }
  | { kind: 'last7' }
  | { kind: 'month' }
  | { kind: 'date'; date: string };

export interface DayRange {
  /** Inclusive, `YYYY-MM-DD`. */
  fromKey: string;
  /** Inclusive, `YYYY-MM-DD`. */
  toKey: string;
}

/** The days a report period covers. This month runs from the 1st to today. */
export function periodRange(period: ReportPeriod, now: Date = new Date()): DayRange {
  const today = dayKey(now);
  switch (period.kind) {
    case 'today':
      return { fromKey: today, toKey: today };
    case 'yesterday': {
      const y = addDaysToKey(today, -1);
      return { fromKey: y, toKey: y };
    }
    case 'last7':
      return { fromKey: addDaysToKey(today, -6), toKey: today };
    case 'month':
      return { fromKey: monthStartKey(now), toKey: today };
    case 'date':
      return { fromKey: period.date, toKey: period.date };
  }
}

/**
 * Splits days into the ones whose full bills are still held (read from `orders`) and the older ones (read from the
 * saved daily totals). Either part is null when the range has no day in it.
 */
export function splitByWindow(range: DayRange, now: Date = new Date()): { live: DayRange | null; archived: DayRange | null } {
  const kept = firstKeptDay(now);
  const lastArchived = addDaysToKey(kept, -1);
  const live = range.toKey >= kept ? { fromKey: range.fromKey > kept ? range.fromKey : kept, toKey: range.toKey } : null;
  const archived = range.fromKey <= lastArchived ? { fromKey: range.fromKey, toKey: range.toKey < lastArchived ? range.toKey : lastArchived } : null;
  return { live, archived };
}
