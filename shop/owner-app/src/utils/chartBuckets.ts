import { businessDayStart, type Language, type Order } from "@kumbakonam/shared";

export interface ChartBucket {
  label: string;
  total: number;
}

// Business hours run 3am -> 2am the next calendar day (see businessDayStart
// in shared) — this list is the real order they print on the daily chart in,
// starting at 3am, not the raw 0-23 clock order.
const BUSINESS_HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  const h = (3 + i) % 24;
  const period = h < 12 ? "am" : "pm";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${period}`;
});

const DAY_LABELS: Record<Language, string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  ta: ["திங்கள்", "செவ்வாய்", "புதன்", "வியாழன்", "வெள்ளி", "சனி", "ஞாயிறு"],
};

const WEEK_LABEL: Record<Language, string> = { en: "Week", ta: "வாரம்" };

/** A voided order is a mistake the owner cancelled, not a sale — never counted here. */
function excludeVoided(orders: Order[]): Order[] {
  return orders.filter((o) => o.status !== "voided");
}

/** Daily view — bucket by business hour (3am -> 2am next day, see
 *  BUSINESS_HOUR_LABELS), trimmed to the range that actually has activity
 *  (avoids a mostly-empty 24-bar chart). */
export function bucketByHour(allOrders: Order[]): ChartBucket[] {
  const orders = excludeVoided(allOrders);
  const totals = new Array<number>(24).fill(0);
  for (const order of orders) {
    // Offset from 3am, wrapping — e.g. real hour 1am (01:xx) is offset 22
    // (the 23rd business hour), not hour-of-day 1.
    const offset = (order.createdAt.toDate().getHours() - 3 + 24) % 24;
    totals[offset] += order.total;
  }

  const activeOffsets = totals.map((t, i) => (t > 0 ? i : -1)).filter((i) => i >= 0);
  if (activeOffsets.length === 0) return [];

  const first = Math.min(...activeOffsets);
  const last = Math.max(...activeOffsets);
  return Array.from({ length: last - first + 1 }, (_, i) => {
    const offset = first + i;
    return { label: BUSINESS_HOUR_LABELS[offset], total: totals[offset] };
  });
}

/** Weekly view — bucket by day of week, Monday through Sunday, always all 7
 *  shown for context. Bucketed by each order's *business* day, so a 1am
 *  Tuesday sale still counts as Monday night's trading. */
export function bucketByDayOfWeek(allOrders: Order[], language: Language = "en"): ChartBucket[] {
  const orders = excludeVoided(allOrders);
  const totals = new Array<number>(7).fill(0);
  for (const order of orders) {
    const businessDay = businessDayStart(order.createdAt.toDate());
    const dayIndex = (businessDay.getDay() + 6) % 7; // 0 = Monday
    totals[dayIndex] += order.total;
  }
  const labels = DAY_LABELS[language];
  return labels.map((label, i) => ({ label, total: totals[i] }));
}

/** Monthly view — bucket by week-of-month (days 1-7, 8-14, ...) so the chart
 *  stays ~4-5 bars instead of up to 31. Bucketed by business day, same
 *  reasoning as bucketByDayOfWeek. */
export function bucketByWeekOfMonth(allOrders: Order[], monthStart: Date, language: Language = "en"): ChartBucket[] {
  const orders = excludeVoided(allOrders);
  const totals = new Map<number, number>();
  for (const order of orders) {
    const businessDay = businessDayStart(order.createdAt.toDate());
    const weekIndex = Math.floor((businessDay.getDate() - 1) / 7);
    totals.set(weekIndex, (totals.get(weekIndex) ?? 0) + order.total);
  }
  const weekCount = Math.floor((getDaysInMonth(monthStart) - 1) / 7) + 1;
  return Array.from({ length: weekCount }, (_, i) => ({
    label: `${WEEK_LABEL[language]} ${i + 1}`,
    total: totals.get(i) ?? 0,
  }));
}

function getDaysInMonth(monthStart: Date): number {
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
}

const RECENT_LABELS: Record<Language, string[]> = {
  en: ["Yesterday", "Today"],
  ta: ["நேற்று", "இன்று"],
};

/** 2-day view — bucket by business day, oldest to newest, matching the
 *  window archiveAndPruneOldData keeps (see dailySummary.service.ts). Was
 *  3 days (day before/yesterday/today); narrowed 2026-09-03. `rangeStart`
 *  is the range's own start (a business-day start, yesterday), so this
 *  never has to guess "today" independently of what the rest of the
 *  screen is already showing. */
export function bucketByRecentDay(allOrders: Order[], rangeStart: Date, language: Language = "en"): ChartBucket[] {
  const orders = excludeVoided(allOrders);
  const totals = [0, 0];
  for (const order of orders) {
    const orderDay = businessDayStart(order.createdAt.toDate());
    const dayIndex = Math.round((orderDay.getTime() - rangeStart.getTime()) / 86400000);
    if (dayIndex >= 0 && dayIndex < 2) totals[dayIndex] += order.total;
  }
  return RECENT_LABELS[language].map((label, i) => ({ label, total: totals[i] }));
}
