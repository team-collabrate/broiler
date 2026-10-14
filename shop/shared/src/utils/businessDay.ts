/**
 * The hour the shop's "day" turns over for every report/chart/prune window
 * in the owner app — a sale at 1am is still last night's business, not a
 * fresh day starting at midnight mid-shift. Requested 2026-09-01 after the
 * midnight boundary was splitting one night's trading across two "days" in
 * Reports.
 */
export const BUSINESS_DAY_START_HOUR = 3;

/** The 3am timestamp that begins the business day containing `date`. */
export function businessDayStart(date: Date): Date {
  const d = new Date(date);
  if (d.getHours() < BUSINESS_DAY_START_HOUR) d.setDate(d.getDate() - 1);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), BUSINESS_DAY_START_HOUR, 0, 0, 0);
}

/** YYYY-MM-DD key for the business day containing `date` — lexicographically
 *  sortable, so a Firestore range query on this string works like a date
 *  range query would. Used as the `dailySummaries` document id. */
export function businessDayKey(date: Date): string {
  const start = businessDayStart(date);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
