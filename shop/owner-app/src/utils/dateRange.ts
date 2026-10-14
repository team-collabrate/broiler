import { businessDayStart } from "@kumbakonam/shared";

export type RangeMode = "recent" | "daily" | "weekly" | "monthly";

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Fixed periods per TDD §7 ("today / this week / this month"), not a rolling
 * trend window.
 *
 * Every boundary here is a business-day start (3am, see businessDayStart in
 * shared/src/utils/businessDay.ts), not calendar midnight — a sale at 1am
 * is still last night's trading, not the start of a new "day" mid-shift.
 * Requested 2026-09-01 after midnight boundaries were splitting one
 * night's business across two days in Reports.
 *
 * `end` is the START of the *next* day/week/month, not "now" — the Owner
 * dashboard subscribes to this range with `onSnapshot` (TDD §7), and a
 * Firestore range query's bounds are fixed at query time. If `end` were
 * "now", an order created a minute later would have `createdAt > end` and
 * would silently never appear in the live feed. Using the period's true
 * end keeps the query — and the realtime subscription — valid for the
 * rest of the period.
 */
export function getRange(mode: RangeMode, now: Date = new Date()): DateRange {
  // The business day `now` currently falls in — every mode below is built
  // from this one anchor, so "today" never disagrees with itself between
  // the daily/recent/weekly/monthly views (e.g. 1am is still "yesterday"
  // everywhere, not just in some of them).
  const today = businessDayStart(now);

  if (mode === "recent") {
    // Today and yesterday — matches the window archiveAndPruneOldData
    // keeps (see dailySummary.service.ts): anything this range could show
    // still exists as real order detail, and nothing older does (older
    // totals come from dailySummaries instead). Was today/yesterday/day-
    // before (3 days); narrowed to 2 on explicit request 2026-09-03.
    const start = new Date(today);
    start.setDate(start.getDate() - 1);
    const end = new Date(today);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  if (mode === "daily") {
    const end = new Date(today);
    end.setDate(end.getDate() + 1);
    return { start: today, end };
  }

  if (mode === "weekly") {
    const dayIndex = (today.getDay() + 6) % 7; // days since Monday (0 = Monday)
    const start = new Date(today);
    start.setDate(start.getDate() - dayIndex);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }

  // monthly — the 1st of the business month `today` falls in, 3am, through
  // the 1st of the next. Deliberately keyed off `today` (not `now.getMonth()`
  // directly): a sale at 1am on the 1st still belongs to the previous
  // month's business, same as it belongs to the previous day's.
  const start = new Date(today.getFullYear(), today.getMonth(), 1, 3, 0, 0, 0);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 1, 3, 0, 0, 0);
  return { start, end };
}
