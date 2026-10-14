import { businessDayKey, type Language } from "@kumbakonam/shared";

export interface DayLabels {
  /** The real calendar date, e.g. "03 Sep" — always present, the main heading. */
  dateLabel: string;
  /** "Today" / "Yesterday", only for those two days — a subheading under
   *  dateLabel, not folded into it. Undefined for any older day. */
  relativeLabel: string | undefined;
}

/** Shared by every day-grouped report on this page (item sales, spending) —
 *  pulled out of itemSalesReport.ts on 2026-09-04 when spending needed the
 *  exact same date/Today/Yesterday logic rather than a second copy of it. */
export function dayLabels(key: string, language: Language): DayLabels {
  const [y, m, d] = key.split("-").map(Number);
  // Reconstruct a real Date at the business day's own 3am start so
  // weekday/month come out right regardless of the viewer's timezone quirks.
  const date = new Date(y, m - 1, d, 3, 0, 0);
  const dateLabel = date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  const todayKey = businessDayKey(new Date());
  const yesterdayKey = businessDayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  if (key === todayKey) return { dateLabel, relativeLabel: language === "ta" ? "இன்று" : "Today" };
  if (key === yesterdayKey) return { dateLabel, relativeLabel: language === "ta" ? "நேற்று" : "Yesterday" };
  return { dateLabel, relativeLabel: undefined };
}
