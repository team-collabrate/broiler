import { useEffect, useMemo, useState } from "react";
import {
  categoryLabel,
  combineSales,
  daysInclusive,
  dayKey,
  describeError,
  keyToDate,
  periodRange,
  salesByDay,
  salesByHour,
  splitByWindow,
  type DayTotals,
  type ReportPeriod,
} from "@kumbakonam/shared/core";
import type { OwnerData } from "./data";
import { formatMoney, kgText, longDayText, pcsText } from "./fmt";
import { BarChart, Notice, type Bar } from "./ui";

type Kind = ReportPeriod["kind"];
const CHOICES: { kind: Kind; label: string }[] = [
  { kind: "today", label: "Today" },
  { kind: "yesterday", label: "Yesterday" },
  { kind: "last7", label: "Last 7 days" },
  { kind: "month", label: "This month" },
  { kind: "date", label: "Pick a date" },
];

const hourLabel = (h: number): string => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);

/** Sales for a period: totals, how it was paid, a chart, the items sold and the three categories. */
export function Reports({ data }: { data: OwnerData }) {
  const todayKey = dayKey(data.now);
  const [kind, setKind] = useState<Kind>("today");
  const [date, setDate] = useState(todayKey);
  const period: ReportPeriod = kind === "date" ? { kind, date } : ({ kind } as ReportPeriod);
  const range = useMemo(() => periodRange(period, data.now), [kind, date, data.now]); // eslint-disable-line react-hooks/exhaustive-deps
  const split = useMemo(() => splitByWindow(range, data.now), [range, data.now]);

  // The older part of the period (saved daily totals) is fetched once and kept until Refresh.
  const [archived, setArchived] = useState<DayTotals[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setError(null);
    if (!split.archived) {
      setArchived([]);
      return;
    }
    setLoading(true);
    data.loadArchived(split.archived).then(
      (days) => alive && (setArchived(days), setLoading(false)),
      (e) => alive && (setError(describeError(e)), setArchived([]), setLoading(false)),
    );
    return () => {
      alive = false;
    };
  }, [split.archived?.fromKey, split.archived?.toKey, data.now]); // eslint-disable-line react-hooks/exhaustive-deps

  const liveOrders = useMemo(
    () => (split.live ? data.orders.filter((o) => o.dayKey >= split.live!.fromKey && o.dayKey <= split.live!.toKey) : []),
    [data.orders, split.live],
  );
  const figures = useMemo(() => combineSales(liveOrders, archived), [liveOrders, archived]);

  const singleDay = range.fromKey === range.toKey;
  const bars: Bar[] | null = useMemo(() => {
    if (singleDay) {
      if (!split.live) return null; // an older day: only its totals are kept, not the hours
      const hours = salesByHour(liveOrders);
      const used = hours.flatMap((v, h) => (v > 0 ? [h] : []));
      const from = Math.min(7, ...used);
      const to = Math.max(20, ...used);
      return hours.slice(from, to + 1).map((value, i) => ({ label: hourLabel(from + i), value }));
    }
    const days = daysInclusive(range.fromKey, range.toKey);
    return salesByDay(days, liveOrders, archived).map((d) => ({
      label: days.length <= 8 ? keyToDate(d.dayKey).toLocaleDateString("en-IN", { weekday: "short" }) : String(keyToDate(d.dayKey).getDate()),
      value: d.totalMinor,
    }));
  }, [singleDay, split.live, liveOrders, archived, range.fromKey, range.toKey]);

  const heading = singleDay ? longDayText(range.fromKey) : `${longDayText(range.fromKey)} to ${longDayText(range.toKey)}`;
  const itemTotal = Math.max(1, figures.totalMinor);

  return (
    <div className="ow-stack">
      <div className="ow-chips" role="tablist" aria-label="Period">
        {CHOICES.map((c) => (
          <button key={c.kind} type="button" role="tab" aria-selected={kind === c.kind} className={`ow-chip${kind === c.kind ? " is-active" : ""}`} onClick={() => setKind(c.kind)}>
            {c.label}
          </button>
        ))}
      </div>
      {kind === "date" && (
        <label className="ow-field">
          <span className="ow-label">Date</span>
          <input className="ow-input" type="date" max={todayKey} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      <section className="ow-card ow-hero" aria-label="Sales">
        <p className="ow-label">{heading}</p>
        <p className="ow-hero__total">{loading ? "…" : formatMoney(figures.totalMinor)}</p>
        <p className="ow-hero__sub">
          {figures.orderCount} {figures.orderCount === 1 ? "bill" : "bills"} · {kgText(figures.totalGrams)}
          {figures.totalPieces > 0 ? ` · ${pcsText(figures.totalPieces)}` : ""}
        </p>
      </section>

      <section className="ow-card" aria-label="How it was paid">
        <h2 className="ow-card__title">How it was paid</h2>
        <dl className="ow-rows">
          <div className="ow-row">
            <dt>Cash</dt>
            <dd>{formatMoney(figures.cashCollectedMinor)}</dd>
          </div>
          <div className="ow-row">
            <dt>GPay / UPI</dt>
            <dd>{formatMoney(figures.upiCollectedMinor)}</dd>
          </div>
          <div className="ow-row">
            <dt>Credit given</dt>
            <dd className={figures.creditGivenMinor > 0 ? "is-credit" : ""}>{formatMoney(figures.creditGivenMinor)}</dd>
          </div>
        </dl>
      </section>

      <section className="ow-card" aria-label="Chart">
        <h2 className="ow-card__title">{singleDay ? "Sales by hour" : "Sales by day"}</h2>
        {bars ? (
          <BarChart bars={bars} labelEvery={singleDay ? 2 : bars.length > 12 ? 3 : 1} format={formatMoney} caption={singleDay ? "Sales by hour" : "Sales by day"} />
        ) : (
          <p className="ow-text ow-text--muted">Bills are kept in full for 4 days. For an older day only its totals are kept, so there is no hourly chart.</p>
        )}
      </section>

      <section className="ow-card" aria-label="Items sold">
        <h2 className="ow-card__title">Items sold</h2>
        {figures.byItem.length === 0 ? (
          <p className="ow-text ow-text--muted">Nothing sold in this period.</p>
        ) : (
          <ul className="ow-list">
            {figures.byItem.map((item) => (
              <li key={item.itemId} className="ow-list__row">
                <span className="ow-list__main">
                  <strong className="ow-list__name">{item.name}</strong>
                  <span className="ow-list__sub">{item.unit === "piece" ? pcsText(item.qty) : kgText(item.grams)}</span>
                </span>
                <span className="ow-list__amount">{formatMoney(item.totalMinor)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ow-card" aria-label="By category">
        <h2 className="ow-card__title">By category</h2>
        {figures.byCategory.length === 0 ? (
          <p className="ow-text ow-text--muted">Nothing sold in this period.</p>
        ) : (
          <ul className="ow-list">
            {figures.byCategory.map((c) => (
              <li key={c.category} className="ow-list__row ow-list__row--bar">
                <span className="ow-list__main">
                  <strong className="ow-list__name">{categoryLabel(c.category, undefined, "en")}</strong>
                  <span className="ow-share" aria-hidden="true">
                    <span className="ow-share__fill" style={{ width: `${Math.round((c.totalMinor / itemTotal) * 100)}%` }} />
                  </span>
                </span>
                <span className="ow-list__amount">{formatMoney(c.totalMinor)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
