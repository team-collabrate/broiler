export type PaymentMethod = 'cash' | 'upi' | 'card';

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'upi', 'card'];

export const PAYMENT_LABELS: Record<PaymentMethod, string> = { cash: 'Cash', upi: 'UPI', card: 'Card' };

/** A product sold by weight. Prices are integer minor units (paise) per kg. */
export interface MenuItem {
  id: string;
  name: string;
  pricePerKgMinor: number;
  active: boolean;
  sortOrder: number;
}

/** What the POS sends when charging a sale: the weighed lines. */
export interface OrderLineInput {
  itemId: string;
  name: string;
  pricePerKgMinor: number;
  /** Weight in whole grams. */
  grams: number;
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
