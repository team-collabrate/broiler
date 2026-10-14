import { useCallback, useEffect, useMemo, useState } from "react";
import {
  describeFirestoreError,
  formatCurrency,
  getOrdersInRange,
  getOutstandingCustomers,
  getPaymentsInRange,
  useLanguage,
  type Customer,
  type CustomerPayment,
  type Order,
} from "@kumbakonam/shared";
import { buildLoanReport } from "../utils/loanReport";
import { nthBusinessDayStart } from "../utils/itemSalesReport";
import { exportLoanXlsx, exportLoanCustomersXlsx } from "../utils/exportXlsx";
import { CustomerHistoryModal } from "./CustomerHistoryModal";

const STRINGS = {
  title: { en: "Loan", ta: "கடன்" },
  download: { en: "Download", ta: "பதிவிறக்கு" },
  refresh: { en: "Refresh", ta: "புதுப்பி" },
  loading: { en: "Loading…", ta: "ஏற்றுகிறது…" },
  empty: { en: "No loan activity in the last 3 days.", ta: "கடந்த 3 நாட்களில் கடன் நடவடிக்கை இல்லை." },
  given: { en: "Given", ta: "கொடுத்தது" },
  received: { en: "Received", ta: "பெற்றது" },
  net: { en: "Net", ta: "நிகர" },
  customer: { en: "Customer", ta: "வாடிக்கையாளர்" },
  amount: { en: "Amount", ta: "தொகை" },
  none: { en: "None", ta: "ஏதுமில்லை" },
  customerWise: { en: "Customer-wise", ta: "வாடிக்கையாளர் வாரியாக" },
  customerWiseSubtitle: { en: "How much each customer owes, right now", ta: "இப்போது ஒவ்வொரு வாடிக்கையாளரும் எவ்வளவு கடன்பட்டுள்ளனர்" },
  balance: { en: "Balance", ta: "நிலுவை" },
  total: { en: "Total outstanding", ta: "மொத்த நிலுவை" },
  noneOwing: { en: "Nobody owes anything right now.", ta: "இப்போது யாரும் கடன்பட்டில்லை." },
};

/** Day-grouped loan (Khata) activity — requested 2026-09-05 ("the loan
 *  should be separated day wise"), replacing the earlier single "who owes
 *  right now" snapshot. Two independent live subscriptions per the same
 *  3-day window Sales/Expenses use: credit orders (money lent) and
 *  customerPayments (money repaid) — see buildLoanReport for how they're
 *  paired by day. */
export function LoanSection() {
  const { language } = useLanguage();
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<CustomerPayment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingHistoryFor, setViewingHistoryFor] = useState<Customer | null>(null);

  const range = useMemo(() => {
    const now = new Date();
    return { start: nthBusinessDayStart(now, 2), end: now };
  }, []);

  const fetchOrders = useCallback(() => {
    setOrdersLoading(true);
    getOrdersInRange(range.start, range.end)
      .then((result) => {
        setError(null);
        setOrders(result);
        setOrdersLoading(false);
      })
      .catch((err) => {
        console.error("Fetching orders failed", err);
        setError(describeFirestoreError(err, language));
        setOrdersLoading(false);
      });
  }, [range.start, range.end, language]);

  const fetchPayments = useCallback(() => {
    setPaymentsLoading(true);
    getPaymentsInRange(range.start, range.end)
      .then((result) => {
        setError(null);
        setPayments(result);
        setPaymentsLoading(false);
      })
      .catch((err) => {
        console.error("Fetching payments failed", err);
        setError(describeFirestoreError(err, language));
        setPaymentsLoading(false);
      });
  }, [range.start, range.end, language]);

  const fetchCustomers = useCallback(() => {
    setCustomersLoading(true);
    getOutstandingCustomers()
      .then((result) => {
        setError(null);
        setCustomers(result);
        setCustomersLoading(false);
      })
      .catch((err) => {
        console.error("Fetching customers failed", err);
        setError(describeFirestoreError(err, language));
        setCustomersLoading(false);
      });
  }, [language]);

  // One button refetches all three (below) — Loan is the one section whose
  // numbers come from three independent sources at once, so a per-source
  // refresh button would be three buttons for what reads as one screen.
  const refreshAll = useCallback(() => {
    fetchOrders();
    fetchPayments();
    fetchCustomers();
  }, [fetchOrders, fetchPayments, fetchCustomers]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const loading = ordersLoading || paymentsLoading;
  const days = useMemo(() => buildLoanReport(orders, payments, language), [orders, payments, language]);
  const totalOutstanding = customers.reduce((sum, c) => sum + c.balance, 0);

  return (
    <section id="section-loan" className="report-section">
      <div className="report-section__header">
        <h2 className="report-section__title">{STRINGS.title[language]}</h2>
        <button type="button" className="report-section__refresh" onClick={refreshAll} disabled={loading || customersLoading}>
          {STRINGS.refresh[language]}
        </button>
      </div>

      {/* Customer-wise, right now — requested 2026-09-05 alongside the
          day-wise breakdown below ("customer wise we need to know - each
          customer should give how much"): the two answer different
          questions and neither replaces the other. Live via
          subscribeToOutstandingCustomers, same as the original
          single-card Loan section this was pulled out of. */}
      <section className="day-card loan-card__summary">
        <div className="day-card__header">
          <div className="day-card__heading">
            <h3 className="day-card__label">{STRINGS.customerWise[language]}</h3>
            <p className="day-card__relative">{STRINGS.customerWiseSubtitle[language]}</p>
          </div>
          <p className="day-card__total">{formatCurrency(totalOutstanding)}</p>
          <button
            type="button"
            className="day-card__download"
            disabled={customersLoading || customers.length === 0}
            onClick={() => exportLoanCustomersXlsx(customers)}
          >
            {STRINGS.download[language]}
          </button>
        </div>
        {customersLoading ? (
          <p className="sales-report__status" style={{ padding: "var(--space-4)" }}>
            {STRINGS.loading[language]}
          </p>
        ) : customers.length === 0 ? (
          <p className="sales-report__status" style={{ padding: "var(--space-4)" }}>
            {STRINGS.noneOwing[language]}
          </p>
        ) : (
          <div className="day-card__table-wrap">
            <table className="day-card__table">
              <thead>
                <tr>
                  <th>{STRINGS.customer[language]}</th>
                  <th className="is-numeric">{STRINGS.balance[language]}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.customerId}>
                    {/* Requested 2026-09-05: tapping a customer shows what
                        they bought on credit each time, not just the
                        balance total this table already gives. */}
                    <td>
                      <button type="button" className="loan-card__customer-link" onClick={() => setViewingHistoryFor(customer)}>
                        {customer.name}
                      </button>
                    </td>
                    <td className="is-numeric">{formatCurrency(customer.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>{STRINGS.total[language]}</td>
                  <td className="is-numeric">{formatCurrency(totalOutstanding)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

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
                <p
                  className="day-card__total"
                  title={`${STRINGS.given[language]} ${formatCurrency(day.givenTotal)} − ${STRINGS.received[language]} ${formatCurrency(day.receivedTotal)}`}
                >
                  {formatCurrency(day.netTotal)}
                </p>
                <button
                  type="button"
                  className="day-card__download"
                  onClick={() => exportLoanXlsx([day])}
                >
                  {STRINGS.download[language]}
                </button>
              </div>

              <div className="loan-card__block">
                <h4 className="loan-card__block-title is-received">
                  {STRINGS.received[language]} · {formatCurrency(day.receivedTotal)}
                </h4>
                {day.received.length === 0 ? (
                  <p className="loan-card__none">{STRINGS.none[language]}</p>
                ) : (
                  <div className="day-card__table-wrap">
                    <table className="day-card__table">
                      <thead>
                        <tr>
                          <th>{STRINGS.customer[language]}</th>
                          <th className="is-numeric">{STRINGS.amount[language]}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.received.map((line, i) => (
                          <tr key={`${line.customerId}-${i}`}>
                            <td>{line.customerName}</td>
                            <td className="is-numeric">{formatCurrency(line.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="loan-card__block">
                <h4 className="loan-card__block-title is-given">
                  {STRINGS.given[language]} · {formatCurrency(day.givenTotal)}
                </h4>
                {day.given.length === 0 ? (
                  <p className="loan-card__none">{STRINGS.none[language]}</p>
                ) : (
                  <div className="day-card__table-wrap">
                    <table className="day-card__table">
                      <thead>
                        <tr>
                          <th>{STRINGS.customer[language]}</th>
                          <th className="is-numeric">{STRINGS.amount[language]}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.given.map((line, i) => (
                          <tr key={`${line.customerId}-${i}`}>
                            <td>{line.customerName}</td>
                            <td className="is-numeric">{formatCurrency(line.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {viewingHistoryFor && (
        <CustomerHistoryModal
          customerId={viewingHistoryFor.customerId}
          customerName={viewingHistoryFor.name}
          onClose={() => setViewingHistoryFor(null)}
        />
      )}
    </section>
  );
}
