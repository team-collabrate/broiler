/**
 * `split` is one bill paid partly in cash and partly by GPay/UPI. `credit` (கடன்) is a regular buying
 * on account: the sale happens, no money moves, and the total lands on the customer's balance.
 * `card` is no longer offered at the till but older orders carry it, so it stays.
 */
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'split' | 'credit';

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'upi', 'card', 'split', 'credit'];

/** Payment names as printed on the bill (Tamil). The counter screen uses `PAYMENT_LABELS_EN`. */
export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'பணம்',
  upi: 'UPI',
  card: 'கார்டு',
  split: 'பிரித்து',
  credit: 'கடன்',
};

/** Payment names on the counter screen (English). */
export const PAYMENT_LABELS_EN: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  split: 'Split',
  credit: 'Credit',
};

/** How money received against a credit balance was paid. */
export type SettleMethod = 'cash' | 'upi';

/**
 * A regular who buys on credit (கடன் / khata). Created the first time someone takes an order on account
 * and kept after they settle: the owner needs the record and the same person comes back. The counter's
 * list shows only `balanceMinor > 0`, so a settled customer drops off it by itself.
 */
export interface Customer {
  id: string;
  /** As first typed, e.g. "Ravi Stores". */
  name: string;
  /** Lower-cased, trimmed name: how a returning customer is matched to their record. */
  nameKey: string;
  /** What they owe, in paise. */
  balanceMinor: number;
  updatedAt: Date | null;
}

/** Money taken against a balance. Append-only: a receipt that can be edited is not an audit trail. */
export interface CustomerPayment {
  id: string;
  customerId: string;
  customerName: string;
  amountMinor: number;
  method: SettleMethod;
  createdAt: Date;
}

/** How an item is sold: by weight (rate per kg) or by count (rate per piece or packet). */
export type Unit = 'kg' | 'piece';

/**
 * How a sale is entered in the product's configuration sheet:
 * weight (pick a weight, the rate prices it), amount (type the money, the weight follows),
 * qty (pick a count, the rate prices each).
 */
export type Method = 'weight' | 'amount' | 'qty';

/** The form a product is sold in. Each variant is its own menu item with its own daily rate. */
export type Variant = 'live' | 'skin' | 'skinless' | 'bone' | 'boneless';

/** A product sold by weight or by count. Rates are integer minor units (paise) per kg or per piece. */
export interface MenuItem {
  id: string;
  /** English name; also the fallback when there is no Tamil one. */
  name: string;
  /** Tamil name shown in the apps and on the bill. */
  nameTa: string | null;
  /** Category key (see categories.ts): the tab the item sits under at the counter. */
  category: string;
  /** Product family the variants belong to, e.g. `broiler`. */
  group: string;
  variant: Variant | null;
  unit: Unit;
  /** The billing methods the sheet offers for this product, first is the default shown. Never empty. */
  methods: Method[];
  /** The product photo: a key from the generated image map (see scripts/build-image-map.mjs) or an https link. */
  image: string | null;
  /** Today's list rate in paise: per kg for `kg` items, per piece for `piece` items. */
  rateMinor: number;
  /** A kg item's usual sale weight in grams (liver 100, chicken 1000); where the sale panel starts. */
  defaultGrams: number;
  /** A piece item's usual count; where the quantity panel starts. */
  defaultQty: number;
  /** When the rate was last set (or confirmed); null if never. Used to flag a stale daily rate. */
  rateUpdatedAt: Date | null;
  active: boolean;
  sortOrder: number;
}

/** What the POS sends when charging a sale: the lines. */
export interface OrderLineInput {
  itemId: string;
  name: string;
  /** Category key at the time of sale, so reports can group without looking the item up. */
  category: string;
  unit: Unit;
  /** The rate actually charged per kg or per piece, in paise. Differs from `listRateMinor` when adjusted. */
  rateMinor: number;
  /** The item's list rate when the line was added, in paise. */
  listRateMinor: number;
  /** Weight in whole grams for a `kg` line (for a fixed-amount sale, the weight to weigh out); 0 for a `piece` line. */
  grams: number;
  /** Count for a `piece` line; 0 for a `kg` line. */
  qty: number;
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
  /** The counter (tablet) letter that made the sale. Absent on bills saved before counters had letters. */
  device?: string;
  /** When the server received the sale. For a sale made offline this is later than the sale itself. */
  createdAt: Date;
  /** When the sale was made, by the tablet's clock (the rules limit how old it can be). Reports use this. */
  soldAt?: Date;
  /** Who was billing: the worker picked at the till. Absent on bills saved before workers were named. */
  staffName?: string;
  lines: OrderLine[];
  totalMinor: number;
  /** Weight of the `kg` lines. */
  totalGrams: number;
  /** Count of the `piece` lines. */
  totalPieces: number;
  paymentMethod: PaymentMethod;
  /** Split bills only: the two halves, in paise, adding up to the total. */
  cashAmountMinor?: number;
  upiAmountMinor?: number;
  /** Credit bills only: who owes for it. */
  customerId?: string;
  customerName?: string;
  /**
   * `'voided'` when the bill was deleted: it stays on record, marked, and every total leaves it out. Absent on a
   * live bill (a bill is never created voided).
   */
  status?: 'voided';
  voidedAt?: Date | null;
  /** The signed-in account (user id) that deleted it. */
  voidedBy?: string;
}

/** A deleted bill: still on record, but not counted anywhere. */
export function isVoided(order: Pick<Order, 'status'>): boolean {
  return order.status === 'voided';
}

/** The name to show and print: Tamil when the item has one, else English. */
export function itemName(item: Pick<MenuItem, 'name' | 'nameTa'>): string {
  return item.nameTa ?? item.name;
}
