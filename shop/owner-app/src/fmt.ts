import { billLabel, keyToDate, PAYMENT_LABELS_EN, type Order } from "@kumbakonam/shared/core";

export { formatMoney } from "@kumbakonam/shared/core";

/** Weight in kilos: `42.35 kg`, `0 kg`. Trailing zeros are dropped. */
export function kgText(grams: number): string {
  return `${(grams / 1000).toFixed(3).replace(/\.?0+$/, "")} kg`;
}

export const pcsText = (qty: number): string => `${qty} ${qty === 1 ? "pc" : "pcs"}`;

/** `4:05 pm` */
export function timeText(d: Date): string {
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

/** `Tue, 21 Oct` from a `YYYY-MM-DD` day. */
export function dayText(key: string): string {
  return keyToDate(key).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/** `21 Oct 2026` from a `YYYY-MM-DD` day. */
export function longDayText(key: string): string {
  return keyToDate(key).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** The number printed on the bill: `22-10/3`. */
export const billNo = (order: Order): string => billLabel(order.dayKey, order.device ?? "A", order.orderNo);

export const paymentText = (order: Pick<Order, "paymentMethod">): string => PAYMENT_LABELS_EN[order.paymentMethod];

/** The time the sale was made (the tablet's clock), else when the server got it. */
export const soldTime = (order: Order): Date => order.soldAt ?? order.createdAt;

/** Rupees typed as `240` or `240.5` to paise, or null if it is not an amount. */
export function rupeesToPaise(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Paise as a typed amount: `24000` becomes `240.00`. */
export const paiseToRupees = (minor: number): string => (minor / 100).toFixed(2);
