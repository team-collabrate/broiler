import { billLabel, describeError, keyToDate, PAYMENT_LABELS, type Order } from "@kumbakonam/shared/core";

export { formatMoney } from "@kumbakonam/shared/core";

/** Weight in kilos: `42.35 kg`, `0 kg`. Trailing zeros are dropped. */
export function kgText(grams: number): string {
  return `${(grams / 1000).toFixed(3).replace(/\.?0+$/, "")} கிலோ`;
}

export const pcsText = (qty: number): string => `${qty} எண்`;

/** `4:05 pm` */
export function timeText(d: Date): string {
  return d.toLocaleTimeString("ta-IN", { hour: "numeric", minute: "2-digit" });
}

/** `Tue, 21 Oct` from a `YYYY-MM-DD` day. */
export function dayText(key: string): string {
  return keyToDate(key).toLocaleDateString("ta-IN", { weekday: "short", day: "numeric", month: "short" });
}

/** `21 Oct 2026` from a `YYYY-MM-DD` day. */
export function longDayText(key: string): string {
  return keyToDate(key).toLocaleDateString("ta-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** The number printed on the bill: `22-10/3`. */
export const billNo = (order: Order): string => billLabel(order.dayKey, order.device ?? "A", order.orderNo);

export const paymentText = (order: Pick<Order, "paymentMethod">): string => PAYMENT_LABELS[order.paymentMethod];

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

const ERROR_TA: Record<string, string> = {
  "You don't have access to this data.": "இந்த தகவலைப் பார்க்க அனுமதி இல்லை.",
  "Can't reach the server. Check the connection.": "இணையம் இல்லை. இணைப்பைப் பார்க்கவும்.",
  "Wrong PIN.": "PIN தவறு.",
  "Too many wrong PINs. Try again in a little while.": "அதிக முறை தவறு. சிறிது நேரம் கழித்து முயற்சிக்கவும்.",
  "The PIN must be 4 to 6 digits.": "PIN 4 முதல் 6 இலக்கம் இருக்க வேண்டும்.",
  "Something went wrong. Please try again.": "ஏதோ பிழை ஆகிவிட்டது. மீண்டும் முயற்சிக்கவும்.",
  "Customer not found": "வாடிக்கையாளர் கிடைக்கவில்லை.",
  "Enter an amount above zero": "பூஜ்யத்துக்கு மேல் தொகை போடவும்.",
  "That is more than the customer owes": "அவர் தரவேண்டிய கடனை விட அதிகம்.",
  "Every rate must be above zero": "ஒவ்வொரு விலையும் பூஜ்யத்துக்கு மேல் இருக்க வேண்டும்.",
  "Sign in again, then try once more": "மீண்டும் உள்நுழைந்து முயற்சிக்கவும்.",
  "This bill can no longer be deleted from here. Ask the owner": "இந்த பில்லை இனி இங்கே நீக்க முடியாது.",
  "This bill has not reached the server yet. Wait for it to upload, then try again": "இந்த பில் இன்னும் சேவையகத்துக்கு போகவில்லை. சிறிது நேரம் கழித்து முயற்சிக்கவும்.",
};

/** An error as a short Tamil message for the owner's screens. */
export const errorText = (e: unknown): string => ERROR_TA[describeError(e)] ?? ERROR_TA["Something went wrong. Please try again."];
