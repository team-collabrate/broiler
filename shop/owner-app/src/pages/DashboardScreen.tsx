import { useCallback, useMemo, useState } from "react";
import { formatCurrency, useLanguage } from "@kumbakonam/shared";
import { getRange } from "../utils/dateRange";
import { useOrdersInRange } from "../hooks/useOrdersInRange";
import { useExpensesInRange } from "../hooks/useExpensesInRange";
import { useDailySummariesInRange } from "../hooks/useDailySummariesInRange";
import { useCustomers } from "../hooks/useCustomers";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { usePeriodicRefresh } from "../hooks/usePeriodicRefresh";
import { computeDashboardStats } from "../utils/dashboardStats";
import { bucketByDayOfWeek, bucketByWeekOfMonth } from "../utils/chartBuckets";
import { StatCard } from "../components/StatCard";
import { TopItemsList } from "../components/TopItemsList";
import { ValueGraphCard, type GraphMode } from "../components/ValueGraphCard";
import { OwedCustomersModal } from "../components/OwedCustomersModal";
import { TodaySpendingModal } from "../components/TodaySpendingModal";
import "./DashboardScreen.css";

const STRINGS = {
  title: { en: "Dashboard", ta: "டாஷ்போர்டு" },
  refresh: { en: "Refresh", ta: "புதுப்பி" },
  today: { en: "Today", ta: "இன்று" },
  todaySales: { en: "Today's Sales", ta: "இன்றைய விற்பனை" },
  spent: { en: "Spent", ta: "செலவு" },
  net: { en: "Net", ta: "நிகர" },
  thisPeriod: { en: "This week & month", ta: "இந்த வாரம் & மாதம்" },
  weeklySales: { en: "Week", ta: "வாரம்" },
  monthlySales: { en: "Month", ta: "மாதம்" },
  ordersToday: { en: "Orders", ta: "ஆர்டர்கள்" },
  gpayToday: { en: "GPay", ta: "GPay" },
  owed: { en: "Owed to you", ta: "வர வேண்டியது" },
  onCredit: { en: "On credit", ta: "நிலுவை கடன்" },
  acrossOne: { en: "from 1 customer", ta: "1 வாடிக்கையாளரிடம்" },
  acrossMany: { en: "from {n} customers", ta: "{n} வாடிக்கையாளர்களிடம்" },
  allSettled: { en: "Everyone has settled", ta: "அனைவரும் கடனை அடைத்துவிட்டனர்" },
  topItemsToday: { en: "Top Items Today", ta: "இன்றைய முக்கிய பொருட்கள்" },
  loading: { en: "Loading…", ta: "ஏற்றுகிறது…" },
};

export function DashboardScreen() {
  const { language } = useLanguage();
  const [graphMode, setGraphMode] = useState<GraphMode>("weekly");
  const [owedOpen, setOwedOpen] = useState(false);
  const [spendingOpen, setSpendingOpen] = useState(false);

  const dailyRange = useMemo(() => getRange("daily"), []);
  const weeklyRange = useMemo(() => getRange("weekly"), []);
  const monthlyRange = useMemo(() => getRange("monthly"), []);
  // getRange already takes a reference date — yesterday's window is just
  // "today's window, computed as of 24h ago", not a separate calculation.
  const yesterdayRange = useMemo(() => getRange("daily", new Date(Date.now() - 86400000)), []);

  const daily = useOrdersInRange(dailyRange);
  const weekly = useOrdersInRange(weeklyRange);
  const monthly = useOrdersInRange(monthlyRange);
  const yesterday = useOrdersInRange(yesterdayRange);
  const dailySpend = useExpensesInRange(dailyRange);
  const customers = useCustomers();

  // Anything older than 3 days no longer exists as live orders (see
  // dailySummary.service.ts) — its total comes from here instead. A day
  // only ever has ONE of the two sources contribute a nonzero figure, so
  // adding them is safe, never a double count (see
  // useDailySummariesInRange's own comment).
  const weeklyArchived = useDailySummariesInRange(weeklyRange);
  const monthlyArchived = useDailySummariesInRange(monthlyRange);

  // Nothing here is a live listener anymore (2026-09-07) — refetch when the
  // owner actually looks at this screen again (phone unlocked, tab
  // re-focused), so a dashboard left open doesn't quietly go stale for the
  // rest of the day. See useRefreshOnFocus's own comment.
  const refreshAll = useCallback(() => {
    daily.refresh();
    weekly.refresh();
    monthly.refresh();
    yesterday.refresh();
    dailySpend.refresh();
    customers.refresh();
    weeklyArchived.refresh();
    monthlyArchived.refresh();
  }, [daily, weekly, monthly, yesterday, dailySpend, customers, weeklyArchived, monthlyArchived]);
  useRefreshOnFocus(refreshAll);

  // Belt-and-braces for a device that's never backgrounded (a counter
  // tablet left on the Dashboard all day fires no focus/visibilitychange
  // events at all) — just today's own figures, on a 5-minute interval.
  // Deliberately not weekly/monthly; see usePeriodicRefresh's own comment.
  usePeriodicRefresh(daily.refresh, 5 * 60_000);
  usePeriodicRefresh(dailySpend.refresh, 5 * 60_000);

  const dailyStats = useMemo(() => computeDashboardStats(daily.orders), [daily.orders]);
  const weeklyTotal = useMemo(
    () => computeDashboardStats(weekly.orders).totalSales + weeklyArchived.totalSales,
    [weekly.orders, weeklyArchived.totalSales],
  );
  const monthlyTotal = useMemo(
    () => computeDashboardStats(monthly.orders).totalSales + monthlyArchived.totalSales,
    [monthly.orders, monthlyArchived.totalSales],
  );
  const yesterdayTotal = useMemo(() => computeDashboardStats(yesterday.orders).totalSales, [yesterday.orders]);

  // A real day-over-day change, not a decorative percentage — null when
  // there's nothing honest to compare against yet (no sales either day, or
  // yesterday had none — a percentage against zero is either 0/0 or an
  // infinite jump, neither of which tells the owner anything true).
  const salesChange = useMemo(() => {
    if (yesterdayTotal <= 0 || dailyStats.totalSales <= 0) return null;
    return Math.round(((dailyStats.totalSales - yesterdayTotal) / yesterdayTotal) * 100);
  }, [dailyStats.totalSales, yesterdayTotal]);

  const netToday = dailyStats.totalSales - dailySpend.totalSpent;
  const dayHasActivity = dailyStats.totalSales > 0 || dailySpend.totalSpent > 0;

  const graphData = useMemo(() => {
    if (graphMode === "weekly") return bucketByDayOfWeek(weekly.orders, language);
    return bucketByWeekOfMonth(monthly.orders, monthlyRange.start, language);
  }, [graphMode, weekly.orders, monthly.orders, monthlyRange.start, language]);

  const graphLoading = graphMode === "weekly" ? weekly.loading : monthly.loading;
  const error =
    daily.error ??
    weekly.error ??
    monthly.error ??
    dailySpend.error ??
    customers.error ??
    weeklyArchived.error ??
    monthlyArchived.error;

  const owedCount = customers.outstanding.length;
  const owedCaption =
    owedCount === 0
      ? STRINGS.allSettled[language]
      : owedCount === 1
        ? STRINGS.acrossOne[language]
        : STRINGS.acrossMany[language].replace("{n}", String(owedCount));

  return (
    <div className="dashboard-screen">
      <div className="dashboard-screen__header">
        <h1 className="dashboard-screen__title">{STRINGS.title[language]}</h1>
        {/* Manual fallback alongside the automatic refresh-on-focus above —
            for the same always-open-device case usePeriodicRefresh covers,
            but immediate, for whenever the owner wants this instant rather
            than on the next 5-minute tick. */}
        <button type="button" className="dashboard-screen__refresh" onClick={refreshAll}>
          {STRINGS.refresh[language]}
        </button>
      </div>

      {error ? (
        <p className="dashboard-screen__error">{error}</p>
      ) : (
        <>
          <ValueGraphCard mode={graphMode} onModeChange={setGraphMode} data={graphData} loading={graphLoading} />

          <h2 className="dashboard-screen__group">{STRINGS.today[language]}</h2>

          {/* One card, because money in / out / left is one story. Splitting
              it across rows of two and three is what stopped the columns
              lining up, and left the reader to work out the relationship. */}
          <section className="today-card">
            <div className="today-card__headline">
              <p className="today-card__label">{STRINGS.todaySales[language]}</p>
              {/* A real day-over-day change, not a decorative badge — absent
                  rather than shown as 0% or an infinite jump on the days
                  there's nothing honest to compare against (see salesChange). */}
              {salesChange !== null && (
                <span className={`today-card__change ${salesChange >= 0 ? "is-up" : "is-down"}`}>
                  {salesChange >= 0 ? "▲" : "▼"} {Math.abs(salesChange)}%
                </span>
              )}
            </div>
            <p className="today-card__value">{formatCurrency(dailyStats.totalSales)}</p>

            <dl className="today-card__split">
              {/* Clickable — opens TodaySpendingModal, listing what the
                  worker actually typed for each expense (Expense.name),
                  not just this total. A <div> with button semantics, not a
                  real <button>, since <dl>'s content model wants dt/dd
                  pairs wrapped in plain elements — the same reasoning
                  MenuItemCard's card-level tap target uses. */}
              <div
                className="today-card__split-clickable"
                role="button"
                tabIndex={0}
                onClick={() => setSpendingOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSpendingOpen(true);
                  }
                }}
              >
                <dt>{STRINGS.spent[language]}</dt>
                <dd className={dailySpend.totalSpent > 0 ? "is-spend" : ""}>
                  {dailySpend.totalSpent > 0 ? "−" : ""}
                  {formatCurrency(dailySpend.totalSpent)}
                </dd>
              </div>
              <div>
                <dt>{STRINGS.net[language]}</dt>
                {/* Uncoloured until the day has done something: a red zero
                    before the first sale would read as a problem. */}
                <dd className={!dayHasActivity ? "" : netToday < 0 ? "is-negative" : "is-positive"}>
                  {formatCurrency(netToday)}
                </dd>
              </div>
            </dl>
          </section>

          <div className="dashboard-screen__pair">
            <StatCard label={STRINGS.ordersToday[language]} value={String(dailyStats.orderCount)} />
            {/* Only what actually reached the GPay account — a split
                bill's cash half isn't in this figure (see gpayCollected). */}
            <StatCard label={STRINGS.gpayToday[language]} value={formatCurrency(dailyStats.gpayCollected)} />
          </div>

          <h2 className="dashboard-screen__group">{STRINGS.thisPeriod[language]}</h2>

          <div className="dashboard-screen__pair">
            <StatCard label={STRINGS.weeklySales[language]} value={formatCurrency(weeklyTotal)} />
            <StatCard label={STRINGS.monthlySales[language]} value={formatCurrency(monthlyTotal)} />
          </div>

          {/* A running receivable, not a figure for today — so it gets its
              own group rather than sitting beside the day's counts. */}
          <h2 className="dashboard-screen__group">{STRINGS.owed[language]}</h2>

          {/* A button, not a static card — tapping it opens the same detail
              ReportsScreen shows inline (who owes what, with Collect), as a
              pop-up here instead of a navigation away from the dashboard. */}
          <button type="button" className="owed-card" onClick={() => setOwedOpen(true)}>
            <div className="owed-card__text">
              <p className="owed-card__label">{STRINGS.onCredit[language]}</p>
              <p className="owed-card__caption">{owedCaption}</p>
            </div>
            <p className={`owed-card__value ${owedCount > 0 ? "is-spend" : ""}`}>
              {formatCurrency(customers.totalOutstanding)}
            </p>
          </button>

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
              expenses={dailySpend.expenses}
              totalSpent={dailySpend.totalSpent}
              onClose={() => setSpendingOpen(false)}
              onChanged={dailySpend.refresh}
            />
          )}

          <section className="dashboard-screen__section">
            <h2 className="dashboard-screen__section-title">{STRINGS.topItemsToday[language]}</h2>
            {daily.loading ? (
              <p className="dashboard-screen__loading">{STRINGS.loading[language]}</p>
            ) : (
              <TopItemsList items={dailyStats.topItems} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
