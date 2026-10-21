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
