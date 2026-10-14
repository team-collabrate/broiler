import { useCallback, useEffect, useMemo, useState } from "react";
import { describeFirestoreError, formatCurrency, getExpensesInRange, useLanguage, type Expense } from "@kumbakonam/shared";
import { buildExpensesReport } from "../utils/expensesReport";
import { nthBusinessDayStart } from "../utils/itemSalesReport";
import { exportExpensesXlsx } from "../utils/exportXlsx";

const STRINGS = {
  title: { en: "Expenses", ta: "செலவுகள்" },
  download: { en: "Download", ta: "பதிவிறக்கு" },
  refresh: { en: "Refresh", ta: "புதுப்பி" },
  loading: { en: "Loading…", ta: "ஏற்றுகிறது…" },
  empty: { en: "No expenses in the last 3 days.", ta: "கடந்த 3 நாட்களில் செலவுகள் இல்லை." },
  description: { en: "Description", ta: "விவரம்" },
  amount: { en: "Amount", ta: "தொகை" },
  total: { en: "Total", ta: "மொத்தம்" },
};

/** Day-grouped "what was spent on", one Download button per day — the same
 *  itemized-detail treatment as Sales, requested 2026-09-04 alongside it
 *  ("download the Spending and Khata... with details as xlsv") rather than
 *  just the single combined total the Dashboard/Reports quick-access card
 *  already shows. */
export function ExpensesSection() {
  const { language } = useLanguage();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => {
    const now = new Date();
    return { start: nthBusinessDayStart(now, 2), end: now };
  }, []);

  const fetchExpenses = useCallback(() => {
    setLoading(true);
    getExpensesInRange(range.start, range.end)
      .then((result) => {
        setError(null);
        setExpenses(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetching expenses failed", err);
        setError(describeFirestoreError(err, language));
        setLoading(false);
      });
  }, [range.start, range.end, language]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const days = useMemo(() => buildExpensesReport(expenses, language), [expenses, language]);

  return (
    <section id="section-expenses" className="report-section">
      <div className="report-section__header">
        <h2 className="report-section__title">{STRINGS.title[language]}</h2>
        <button type="button" className="report-section__refresh" onClick={fetchExpenses} disabled={loading}>
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
                <p className="day-card__total">{formatCurrency(day.total)}</p>
                <button
                  type="button"
                  className="day-card__download"
                  onClick={() => exportExpensesXlsx([day])}
                >
                  {STRINGS.download[language]}
                </button>
              </div>
              <div className="day-card__table-wrap">
                <table className="day-card__table">
                  <thead>
                    <tr>
                      <th>{STRINGS.description[language]}</th>
                      <th className="is-numeric">{STRINGS.amount[language]}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.expenses.map((expense) => (
                      <tr key={expense.expenseId}>
                        <td>{expense.name}</td>
                        <td className="is-numeric">{formatCurrency(expense.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>{STRINGS.total[language]}</td>
                      <td className="is-numeric">{formatCurrency(day.total)}</td>
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
