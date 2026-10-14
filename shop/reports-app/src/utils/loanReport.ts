import { businessDayKey, type CustomerPayment, type Language, type Order } from "@kumbakonam/shared";
import { dayLabels } from "./dayLabels";

export interface LoanMovementLine {
  customerId: string;
  customerName: string;
  amount: number;
}

export interface DayLoanReport {
  /** businessDayKey — YYYY-MM-DD */
  key: string;
  dateLabel: string;
  relativeLabel: string | undefined;
  /** New credit sales billed that day — the loan given out. */
  given: LoanMovementLine[];
  /** Payments received against a balance that day. */
  received: LoanMovementLine[];
  givenTotal: number;
  receivedTotal: number;
  /** given − received: how much the total loan book grew (or shrank) that day. */
  netTotal: number;
}

/** Day-grouped loan (Khata) activity — requested 2026-09-05: "the loan
 *  should be separated day wise", matching Sales/Expenses instead of the
 *  single all-time "who owes right now" snapshot Loan started as. Two
 *  independent sources per day: credit orders (money lent, from the same
 *  `orders` this app's Sales section already reads) and customerPayments
 *  (money repaid) — paired by day, not by customer, since a payment
 *  rarely lands the same day as the sale it's settling. */
export function buildLoanReport(orders: Order[], payments: CustomerPayment[], language: Language): DayLoanReport[] {
  const byDay = new Map<string, { given: LoanMovementLine[]; received: LoanMovementLine[] }>();

  const bucket = (key: string) => {
    let day = byDay.get(key);
    if (!day) {
      day = { given: [], received: [] };
      byDay.set(key, day);
    }
    return day;
  };

  for (const order of orders) {
    if (order.status === "voided") continue;
    if (order.paymentMethod !== "credit" || !order.customerId) continue;
    const key = businessDayKey(order.createdAt.toDate());
    bucket(key).given.push({
      customerId: order.customerId,
      customerName: order.customerName ?? "—",
      amount: order.total,
    });
  }

  for (const payment of payments) {
    const key = businessDayKey(payment.createdAt.toDate());
    bucket(key).received.push({
      customerId: payment.customerId,
      customerName: payment.customerName,
      amount: payment.amount,
    });
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, day]) => {
      const given = [...day.given].sort((a, b) => b.amount - a.amount);
      const received = [...day.received].sort((a, b) => b.amount - a.amount);
      const givenTotal = given.reduce((sum, line) => sum + line.amount, 0);
      const receivedTotal = received.reduce((sum, line) => sum + line.amount, 0);
      return {
        key,
        ...dayLabels(key, language),
        given,
        received,
        givenTotal,
        receivedTotal,
        netTotal: givenTotal - receivedTotal,
      };
    });
}
