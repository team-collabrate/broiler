import { businessDayKey, businessDayStart, type Order } from "@kumbakonam/shared";

export interface OrderDayGroup {
  /** businessDayKey — also used as the React list key. */
  key: string;
  label: string;
  orders: Order[];
}

const TODAY_LABEL = { en: "Today", ta: "இன்று" };
const YESTERDAY_LABEL = { en: "Yesterday", ta: "நேற்று" };

/**
 * Splits an already-ordered order list into day buckets — the "grouped by
 * date, like a UPI app" layout requested 2026-09-03, replacing one long
 * flat list Reports used to show. `orders` must already be newest-first
 * (straight off useOrdersInRange, or ReportsScreen's own voided-floated
 * `displayOrders`) — this only partitions, it never re-sorts, so a day's
 * bucket keeps whatever relative order its orders arrived in (this is how
 * voided orders end up first within their own day: they were already first
 * in the flat list before grouping, see ReportsScreen's own comment on
 * `displayOrders`).
 *
 * Grouped by business day (3am cutover — see businessDayStart), the same
 * boundary every other report/chart on this screen already uses, so a
 * 1am sale lands in the same day here as it does in the chart above it.
 */
export function groupOrdersByDay(orders: Order[], language: "en" | "ta"): OrderDayGroup[] {
  const todayKey = businessDayKey(new Date());
  const yesterdayKey = businessDayKey(new Date(Date.now() - 86_400_000));

  const buckets = new Map<string, Order[]>();
  for (const order of orders) {
    const key = businessDayKey(order.createdAt.toDate());
    const bucket = buckets.get(key);
    if (bucket) bucket.push(order);
    else buckets.set(key, [order]);
  }

  return [...buckets.entries()].map(([key, dayOrders]) => ({
    key,
    label:
      key === todayKey
        ? TODAY_LABEL[language]
        : key === yesterdayKey
          ? YESTERDAY_LABEL[language]
          : formatDayLabel(businessDayStart(dayOrders[0].createdAt.toDate())),
    orders: dayOrders,
  }));
}

/** "Mon, 28 Aug" — always English/en-IN, matching how OrderHistoryRow
 *  already formats the time on each row (locale-fixed, only the static UI
 *  strings around it translate) rather than switching date-formatting
 *  locale with the language toggle too. */
function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
