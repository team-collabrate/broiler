import { useCallback, useEffect, useMemo, useState } from "react";
import { describeFirestoreError, formatCurrency, getOrdersInRange, useLanguage, type Order } from "@kumbakonam/shared";
import { buildItemSalesReport, nthBusinessDayStart } from "../utils/itemSalesReport";
import { exportItemSalesXlsx } from "../utils/exportXlsx";

const STRINGS = {
  title: { en: "Sales", ta: "விற்பனை" },
  download: { en: "Download", ta: "பதிவிறக்கு" },
  refresh: { en: "Refresh", ta: "புதுப்பி" },
  loading: { en: "Loading…", ta: "ஏற்றுகிறது…" },
  empty: { en: "No orders in the last 3 days.", ta: "கடந்த 3 நாட்களில் ஆர்டர்கள் இல்லை." },
  item: { en: "Item", ta: "பொருள்" },
  qty: { en: "Qty", ta: "எண்ணிக்கை" },
  rate: { en: "Rate", ta: "விலை" },
  amount: { en: "Amount", ta: "தொகை" },
  rateVaries: { en: "avg — sold at more than one price", ta: "சராசரி — ஒன்றுக்கு மேற்பட்ட விலையில் விற்பனை" },
  total: { en: "Total", ta: "மொத்தம்" },
  orders: { en: "orders", ta: "ஆர்டர்கள்" },
};

/** Item-by-item sales, day-grouped, one Download button per day — moved out
 *  of ItemSalesReport.tsx on 2026-09-04 when Spending and Khata needed
 *  their own sections on the same page and one file holding all three data
 *  subscriptions + renders was getting hard to follow.
 *
 *  Fetch-once-plus-manual-refresh, not live — changed 2026-09-07 after the
 *  project's Firestore read quota kept getting exhausted mid-day; a live
 *  listener here re-delivered on every order anywhere, for as long as this
 *  page happened to stay open. See owner-app's useOrdersInRange for the
 *  same reasoning in full. */
export function SalesSection() {
  const { language } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    const now = new Date();
    return { start: nthBusinessDayStart(now, 2), end: now };
  }, []);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    getOrdersInRange(range.start, range.end)
      .then((result) => {
        setError(null);
        setOrders(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetching orders failed", err);
        setError(describeFirestoreError(err, language));
        setLoading(false);
      });
  }, [range.start, range.end, language]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const days = useMemo(() => buildItemSalesReport(orders, language), [orders, language]);

  return (
    <section id="section-sales" className="report-section">
      <div className="report-section__header">
        <h2 className="report-section__title">{STRINGS.title[language]}</h2>
        <button type="button" className="report-section__refresh" onClick={fetchOrders} disabled={loading}>
          {STRINGS.refresh[language]}
        </button>
      </div>

      {error ? (
        <p className="sales-report__error">{error}</p>
      ) : loading ? (
        <p className="sales-report__status">{STRINGS.loading[language]}</p>
      ) : days.length === 0 ? (
        <p className="sales-report__status">{STRINGS.empty[language]}</p>
      ) : (
        <div className="sales-report__days">
          {days.map((day) => (
            <section key={day.key} className="day-card">
              <div className="day-card__header">
                <div className="day-card__heading">
                  <h3 className="day-card__label">{day.dateLabel}</h3>
                  {day.relativeLabel && <p className="day-card__relative">{day.relativeLabel}</p>}
                </div>
                <p className="day-card__meta">
                  {day.orderCount} {STRINGS.orders[language]}
                </p>
                <p className="day-card__total">{formatCurrency(day.totalSales)}</p>
                <button
                  type="button"
                  className="day-card__download"
                  onClick={() => exportItemSalesXlsx([day])}
                >
                  {STRINGS.download[language]}
                </button>
              </div>
              <div className="day-card__table-wrap">
                <table className="day-card__table">
                  <thead>
                    <tr>
                      <th>{STRINGS.item[language]}</th>
                      <th className="is-numeric">{STRINGS.qty[language]}</th>
                      <th className="is-numeric">{STRINGS.rate[language]}</th>
                      <th className="is-numeric">{STRINGS.amount[language]}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.items.map((item) => (
                      <tr key={item.itemId}>
                        <td>{item.name}</td>
                        <td className="is-numeric">{item.qty}</td>
                        {/* Same display name can legitimately cover two
                            different itemIds at different prices (a menu
                            item re-added under a new id, a bulk/wholesale
                            rate billed under the retail name) — the rate
                            here, plus the itemId in the XLSX export, is
                            what tells those apart instead of them just
                            looking like an unexplained duplicate row. */}
                        <td className="is-numeric" title={item.rateVaries ? STRINGS.rateVaries[language] : undefined}>
                          {formatCurrency(item.rate)}
                          {item.rateVaries ? "*" : ""}
                        </td>
                        <td className="is-numeric">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>{STRINGS.total[language]}</td>
                      <td className="is-numeric" />
                      <td className="is-numeric" />
                      <td className="is-numeric">{formatCurrency(day.totalSales)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
