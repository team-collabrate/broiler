export type PaymentMethod = 'cash' | 'upi' | 'card';

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'upi', 'card'];

export const PAYMENT_LABELS: Record<PaymentMethod, string> = { cash: 'Cash', upi: 'UPI', card: 'Card' };

/** A product sold by weight. Prices are integer minor units (paise) per kg. */
export interface MenuItem {
  id: string;
  name: string;
  pricePerKgMinor: number;
  /** The item's usual sale weight in grams (liver 100, chicken 1000); where the sale panel starts. */
  defaultGrams: number;
  /** When the rate was last set (or confirmed) at the counter; null if never. Used to flag a stale daily rate. */
  rateUpdatedAt: Date | null;
  active: boolean;
  sortOrder: number;
}

/** What the POS sends when charging a sale: the weighed lines. */
export interface OrderLineInput {
  itemId: string;
  name: string;
  pricePerKgMinor: number;
  /** Weight in whole grams. For a fixed-amount sale this is the weight to weigh out. */
  grams: number;
  /**
   * Set only when the line was sold for a fixed amount (₹100 of chicken). The line then
   * charges exactly this, in paise, instead of pricing the weight. Leave the key out otherwise:
   * Firestore rejects `undefined` values.
   */
  amountMinor?: number;
}

export interface OrderLine extends OrderLineInput {
  lineTotalMinor: number;
}

export interface Order {
  id: string;
  /** Sequential per day, starting at 1. */
  orderNo: number;
  /** Local date the sale was made, `YYYY-MM-DD`. */
  dayKey: string;
  createdAt: Date;
  lines: OrderLine[];
  totalMinor: number;
  totalGrams: number;
  paymentMethod: PaymentMethod;
}
