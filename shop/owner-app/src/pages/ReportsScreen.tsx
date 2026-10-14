import { useCallback, useMemo, useState } from "react";
import { formatCurrency, useLanguage, useSession } from "@kumbakonam/shared";
import { getRange, type RangeMode } from "../utils/dateRange";
import { useOrdersInRange } from "../hooks/useOrdersInRange";
import { useExpensesInRange } from "../hooks/useExpensesInRange";
import { useDailySummariesInRange } from "../hooks/useDailySummariesInRange";
import { useCustomers } from "../hooks/useCustomers";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { usePeriodicRefresh } from "../hooks/usePeriodicRefresh";
import { groupOrdersByDay } from "../utils/groupOrdersByDay";
import { bucketByDayOfWeek, bucketByHour, bucketByRecentDay, bucketByWeekOfMonth } from "../utils/chartBuckets";
import { computeDashboardStats } from "../utils/dashboardStats";
import { RangeSegmentedControl } from "../components/RangeSegmentedControl";
import { SalesChart } from "../components/SalesChart";
import { OrderHistoryRow } from "../components/OrderHistoryRow";
import { WorkerLegend } from "../components/WorkerLegend";
import { OwedCustomersModal } from "../components/OwedCustomersModal";
import { TodaySpendingModal } from "../components/TodaySpendingModal";
import { RecordExpenseModal } from "../components/RecordExpenseModal";
// Reusing the Dashboard's own compact "stat card that opens a pop-up" look
// (.owed-card, .dashboard-screen__pair) rather than a second copy of the
// same styles — Outstanding Credit and Spending get the identical pattern
// here, by request, so both screens read as one system.
import "./DashboardScreen.css";
import "./ReportsScreen.css";

const NOOP = () => {};

const STRINGS = {
  title: { en: "Reports", ta: "அறிக்கைகள்" },
  refresh: { en: "Refresh", ta: "புதுப்பி" },
  orderHistory: { en: "Order History", ta: "ஆர்டர் வரலாறு" },
  spending: { en: "Spending", ta: "செலவுகள்" },
  spendingCaption: { en: "What on", ta: "எதற்கு" },
  onCredit: { en: "Credit", ta: "நிலுவை கடன்" },
  owedCaption: { en: "Who owes", ta: "யார்" },
  sales: { en: "Sales", ta: "விற்பனை" },
  spent: { en: "Spent", ta: "செலவு" },
  net: { en: "Net", ta: "நிகர" },
  loading: { en: "Loading…", ta: "ஏற்றுகிறது…" },
  empty: { en: "No orders in this period.", ta: "இந்தக் காலத்தில் ஆர்டர்கள் இல்லை." },
};

export function ReportsScreen() {
  const { language } = useLanguage();
  const { sessionUser } = useSession();
  // Defaults to the 2-day window (today/yesterday) — the same window
  // archiveAndPruneOldData keeps, and what the owner asked to see first.
  const [mode, setMode] = useState<RangeMode>("recent");
  const range = useMemo(() => getRange(mode), [mode]);
  const { orders, loading, error, refresh: refreshOrders } = useOrdersInRange(range);
  const spend = useExpensesInRange(range);
  // Only ever nonzero once `range` reaches past the 2-day detail window
  // (weekly/monthly) — see useDailySummariesInRange's own comment on why
  // adding this to the live totals below never double-counts a day.
  const archived = useDailySummariesInRange(range);
  const customers = useCustomers();
  const [addingExpense, setAddingExpense] = useState(false);

  // Same fetch-once-plus-manual-refresh gap as Dashboard (2026-09-09: an
  // owner who leaves this screen open sees no new orders past whenever it
  // last loaded) — see useRefreshOnFocus's own comment.
  const refreshAll = useCallback(() => {
    refreshOrders();
    spend.refresh();
    archived.refresh();
    customers.refresh();
  }, [refreshOrders, spend, archived, customers]);
  useRefreshOnFocus(refreshAll);
  // Only bounded windows (today/yesterday, or a single day) get polled —
  // see usePeriodicRefresh's own comment on why weekly/monthly don't: those
  // ranges can hold hundreds of orders, so refetching them every 5 minutes
  // would reproduce the same read-quota problem the live-listener removal
  // was fixing. A no-op refresh (interval fires, callback does nothing) is
  // simpler here than conditionally mounting the hook itself.
  const isBoundedRange = mode === "recent" || mode === "daily";
  usePeriodicRefresh(isBoundedRange ? refreshAll : NOOP, 5 * 60_000);

  // Both now pop-ups (OwedCustomersModal, TodaySpendingModal) instead of
  // inline sections the owner had to scroll past all of order history to
  // reach — the actual complaint this reorganization was for. Both own
  // their own Collect/Delete flows internally; ReportsScreen just opens
  // and closes them.
  const [owedOpen, setOwedOpen] = useState(false);
  const [spendingOpen, setSpendingOpen] = useState(false);

  // Reuses computeDashboardStats purely for its voided-order exclusion —
  // this screen only needs the one number, not the rest of the shape.
  // Plus `archived`, for whatever portion of the range has already aged
  // out of live order/expense detail (see useDailySummariesInRange).
  const totalSales = useMemo(
    () => computeDashboardStats(orders).totalSales + archived.totalSales,
    [orders, archived.totalSales],
  );
  const totalSpent = spend.totalSpent + archived.totalSpent;
  const net = totalSales - totalSpent;

  // `orders` itself stays chronological (createdAt desc, straight off the
  // query) for the chart bucketing and totals above, which need real time
  // order, not this. Voided bills float to the top of each *day's own
  // group* below (see groupOrdersByDay's comment on why that still works
  // after grouping) so a just-voided bill doesn't get lost among a busy
  // day's other orders — most-recently-voided first, then the rest in
  // their usual newest-first order (both groups are already sorted desc
  // going in, so a filter+concat keeps each group's own recency intact).
  const displayOrders = useMemo(() => {
    const voided = orders.filter((o) => o.status === "voided");
    const active = orders.filter((o) => o.status !== "voided");
    return [...voided, ...active];
  }, [orders]);

  const dayGroups = useMemo(() => groupOrdersByDay(displayOrders, language), [displayOrders, language]);

  // Either subscription failing means the figures below would be wrong
  // rather than merely incomplete, so one error hides the whole report.
  const failure = error ?? spend.error ?? customers.error ?? archived.error;

  const chartData = useMemo(() => {
    if (mode === "recent") return bucketByRecentDay(orders, range.start, language);
    if (mode === "daily") return bucketByHour(orders);
    if (mode === "weekly") return bucketByDayOfWeek(orders, language);
    return bucketByWeekOfMonth(orders, range.start, language);
  }, [mode, orders, range.start, language]);

  return (
    <div className="reports-screen">
      <div className="dashboard-screen__header">
        <h1 className="reports-screen__title">{STRINGS.title[language]}</h1>
        <button type="button" className="dashboard-screen__refresh" onClick={refreshAll}>
          {STRINGS.refresh[language]}
        </button>
      </div>
      <RangeSegmentedControl value={mode} onChange={setMode} />

      {failure ? (
        <p className="reports-screen__error">{failure}</p>
      ) : (
        <>
          {/* Sales as the hero figure, Spent/Net a secondary split below it
              — the same .today-card treatment Dashboard already uses for
              exactly this shape of data (one number that matters most,
              two that explain it), reused here rather than the flat
              three-equal-columns grid this used to be. Three numbers of
              identical size and weight made Sales fight its own context
              for attention instead of leading it. */}
          <section className="today-card">
            <p className="today-card__label">{STRINGS.sales[language]}</p>
            <p className="today-card__value">{formatCurrency(totalSales)}</p>
            <dl className="today-card__split">
              <div>
                <dt>{STRINGS.spent[language]}</dt>
                <dd className="is-spend">−{formatCurrency(totalSpent)}</dd>
              </div>
              <div>
                <dt>{STRINGS.net[language]}</dt>
                <dd className={net < 0 ? "is-negative" : "is-positive"}>{formatCurrency(net)}</dd>
              </div>
            </dl>
          </section>

          {/* Quick access — both used to be full inline lists at the very
              bottom of this screen, past all of order history. Compact
              cards up here instead, each opening the same detail as a
              pop-up (Dashboard already established this pattern for
              Outstanding Credit; Spending now matches it here too). */}
          <div className="dashboard-screen__pair reports-screen__quick-access">
            <button type="button" className="owed-card" onClick={() => setOwedOpen(true)}>
              <div className="owed-card__text">
                <p className="owed-card__label">{STRINGS.onCredit[language]}</p>
                <p className="owed-card__caption">{STRINGS.owedCaption[language]}</p>
              </div>
              <p className={`owed-card__value ${customers.totalOutstanding > 0 ? "is-spend" : ""}`}>
                {formatCurrency(customers.totalOutstanding)}
              </p>
            </button>

            <button type="button" className="owed-card" onClick={() => setSpendingOpen(true)}>
              <div className="owed-card__text">
                <p className="owed-card__label">{STRINGS.spending[language]}</p>
                <p className="owed-card__caption">{STRINGS.spendingCaption[language]}</p>
              </div>
              <p className={`owed-card__value ${totalSpent > 0 ? "is-spend" : ""}`}>−{formatCurrency(totalSpent)}</p>
            </button>
          </div>

          <section className="reports-screen__chart">
            <SalesChart data={chartData} />
          </section>

          <section className="reports-screen__history">
            <h2 className="reports-screen__history-title">{STRINGS.orderHistory[language]}</h2>
            {orders.length > 0 && <WorkerLegend />}
            {loading ? (
              <p className="reports-screen__status">{STRINGS.loading[language]}</p>
            ) : orders.length === 0 ? (
              <p className="reports-screen__status">{STRINGS.empty[language]}</p>
            ) : (
              // Grouped by day — like a UPI app's transaction history,
              // replacing one long undifferentiated list. Each group's own
              // date header is the only thing separating "yesterday" from
              // "today" now; there used to be nothing marking that line at
              // all.
              dayGroups.map((group) => (
                <div key={group.key} className="reports-screen__day-group">
                  <h3 className="reports-screen__day-label">{group.label}</h3>
                  {group.orders.map((order) => (
                    <OrderHistoryRow key={order.orderId} order={order} onVoided={refreshOrders} />
                  ))}
                </div>
              ))
            )}
          </section>
        </>
      )}

      {owedOpen && (
        <OwedCustomersModal
          customers={customers.outstanding}
          totalOutstanding={customers.totalOutstanding}
          onClose={() => setOwedOpen(false)}
          onChanged={customers.refresh}
        />
      )}

      {spendingOpen && (
        <TodaySpendingModal
          title={STRINGS.spending[language]}
          expenses={spend.expenses}
          totalSpent={spend.totalSpent}
          onClose={() => setSpendingOpen(false)}
          onAdd={sessionUser ? () => setAddingExpense(true) : undefined}
          onChanged={spend.refresh}
        />
      )}

      {addingExpense && sessionUser && (
        <RecordExpenseModal
          ownerId={sessionUser.userId}
          onClose={() => setAddingExpense(false)}
          onSaved={spend.refresh}
        />
      )}
    </div>
  );
}
