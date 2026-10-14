import type { Timestamp } from "firebase/firestore";

/**
 * `customers/{customerId}` — a regular who buys on credit (கடன் / khata).
 *
 * Created the first time someone takes an order on account, and kept
 * afterwards even once they've settled: the owner's history needs the record,
 * and the same person usually comes back. The counter's picker filters to
 * `balance > 0`, so a settled customer disappears from the till by itself
 * without anything being deleted.
 */
export interface Customer {
  customerId: string;
  /** As the worker typed it the first time, e.g. "Ravi Stores". */
  name: string;
  /**
   * Lower-cased, trimmed `name`. Exists so a returning customer is matched to
   * their existing record instead of quietly becoming a second one with the
   * balance split across two spellings.
   */
  nameKey: string;
  /**
   * Outstanding amount in ₹. Grows with each credit order, shrinks with each
   * payment, and is maintained with Firestore's atomic `increment` — which,
   * unlike a transaction, still works while the counter is offline.
   */
  balance: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * `customerPayments/{paymentId}` — a settlement against a balance.
 *
 * Money owed needs an audit trail: without one, `balance` is a number that
 * changed for reasons nobody can reconstruct, which is no use when a customer
 * disputes what they paid.
 */
export interface CustomerPayment {
  paymentId: string;
  customerId: string;
  /** Denormalized so the owner's history reads without a second lookup. */
  customerName: string;
  amount: number;
  /** Reference to `users.userId` who took the money. */
  workerId: string;
  createdAt: Timestamp;
}
