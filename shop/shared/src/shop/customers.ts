import { collection, doc, getDocs, orderBy, query, runTransaction, serverTimestamp, Timestamp, where, type DocumentData } from "firebase/firestore";
import { dayKey, paymentProblem, type Customer, type SettleMethod } from "../core";
import { getFirestoreDb } from "../firebase";
import { isOnlineNow, needsConnectionError } from "./online";

const toCustomer = (id: string, d: DocumentData): Customer => ({
  id,
  name: String(d.name ?? ""),
  nameKey: String(d.nameKey ?? ""),
  balanceMinor: Number(d.balanceMinor ?? 0),
  updatedAt: d.updatedAt instanceof Timestamp ? d.updatedAt.toDate() : null,
});

/**
 * Everyone who currently owes something, biggest balance first. This is the counter's whole customer list: a settled
 * customer drops off it by itself (nothing is deleted) and returns the next time they take credit. One fetch, not a
 * live listener, so an idle till costs no reads; fetch again when the list is opened. With no connection this is the
 * last list the tablet saw, which is fine for looking at but not for taking a payment.
 */
export async function getOutstandingCustomers(): Promise<Customer[]> {
  const snap = await getDocs(query(collection(getFirestoreDb(), "customers"), where("balanceMinor", ">", 0), orderBy("balanceMinor", "desc")));
  return snap.docs.map((d) => toCustomer(d.id, d.data()));
}

/** A fresh receipt id. Make one per payment and keep it until the payment is recorded, so a retry cannot record it twice. */
export function newPaymentId(): string {
  return doc(collection(getFirestoreDb(), "customerPayments")).id;
}

export interface RecordPaymentInput {
  /** From `newPaymentId()`. */
  paymentId: string;
  customerId: string;
  /** Money received, in paise. */
  amountMinor: number;
  method: SettleMethod;
}

export interface RecordedPayment {
  /** What the customer still owes after this payment, in paise. */
  balanceMinor: number;
  /** True when this exact payment had already been recorded (a retry after a lost answer): nothing was taken off twice. */
  alreadyRecorded: boolean;
}

/**
 * Takes money off a customer's balance and leaves a receipt behind, in one transaction: the balance and the receipt
 * cannot disagree. The balance is read inside the transaction, so a bill added in the meantime is not lost, and a
 * payment larger than what is owed is refused. It needs the internet (see OFFLINE.md): the rules only accept a balance
 * change that arrives together with its receipt, and that is checked against the balance on the server.
 */
export async function recordCustomerPayment(input: RecordPaymentInput): Promise<RecordedPayment> {
  if (!isOnlineNow()) throw needsConnectionError();
  const db = getFirestoreDb();
  const customerRef = doc(db, "customers", input.customerId);
  const paymentRef = doc(db, "customerPayments", input.paymentId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(customerRef);
    if (!snap.exists()) throw new Error("வாடிக்கையாளர் கிடைக்கவில்லை");
    const customer = toCustomer(snap.id, snap.data());
    // The counter may not read receipts, so a retry is recognised by the customer's own note of the last receipt.
    if (snap.data().lastPaymentId === input.paymentId) return { balanceMinor: customer.balanceMinor, alreadyRecorded: true };
    const problem = paymentProblem(input.amountMinor, customer.balanceMinor);
    if (problem === "zero") throw new Error("பூஜ்ஜியத்திற்கு மேல் தொகையை உள்ளிடவும்");
    if (problem === "tooMuch") throw new Error("கடனை விட அதிகம்");
    tx.update(customerRef, {
      balanceMinor: customer.balanceMinor - input.amountMinor,
      lastPaymentId: input.paymentId,
      updatedAt: serverTimestamp(),
    });
    tx.set(paymentRef, {
      customerId: customer.id,
      customerName: customer.name,
      amountMinor: input.amountMinor,
      method: input.method,
      dayKey: dayKey(new Date()),
      createdAt: serverTimestamp(),
    });
    return { balanceMinor: customer.balanceMinor - input.amountMinor, alreadyRecorded: false };
  });
}
