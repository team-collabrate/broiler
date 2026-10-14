import { useCallback, useEffect, useRef, useState } from "react";
import {
  adjustCustomerBalance,
  createOrder,
  getNextBillNo,
  markOrderSynced,
  useLanguage,
  watchOrderSyncStatus,
  type OrderItem,
} from "@kumbakonam/shared";
import type { UseCartResult } from "./useCart";
import { paymentLabelForReceipt, splitBreakdownForReceipt, type BillInput } from "../printing/receipt";

export interface UseOrderSubmitResult {
  /** `print` defaults to true (the Enter shortcut and the Print button both
   *  want that). Pass `false` for the Save button — same write, no receipt. */
  submit: (print?: boolean) => Promise<void>;
  submitting: boolean;
  error: string | null;
  successMessage: string | null;
  /** Order ids written locally but not yet confirmed by the server — drives the sync badge. */
  pendingCount: number;
}

const SUCCESS_MESSAGE_MS = 3000;

const MESSAGES = {
  needItem: { en: "Add at least one item first.", ta: "முதலில் ஒரு பொருளையாவது சேர்க்கவும்." },
  needPayment: { en: "Select a payment method.", ta: "பணம் செலுத்தும் முறையைத் தேர்ந்தெடுக்கவும்." },
  needCustomer: { en: "Choose who this credit bill is for.", ta: "இந்த கடன் பில் யாருக்கு என்று தேர்ந்தெடுக்கவும்." },
  saveFailed: { en: "Could not save the order. Please try again.", ta: "ஆர்டரை சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்." },
  saved: { en: "Order saved.", ta: "ஆர்டர் சேமிக்கப்பட்டது." },
  // Rare: an order queued while offline reached the server later and was
  // rejected there (e.g. the worker account it was filed under got
  // deactivated in the meantime). The bill has already been printed by
  // then, so this can only warn after the fact, not prevent it.
  syncRejected: {
    en: "An earlier order failed to sync — check with the owner.",
    ta: "முந்தைய ஆர்டர் ஒத்திசைவு தோல்வியடைந்தது — உரிமையாளரிடம் சரிபார்க்கவும்.",
  },
};

export function useOrderSubmit(
  cart: UseCartResult,
  workerId: string,
  workerName: string,
  onSaved: (bill: BillInput, print: boolean) => void,
): UseOrderSubmitResult {
  const { language } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingOrderIds, setPendingOrderIds] = useState<string[]>([]);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  const submit = useCallback(async (print = true) => {
    if (cart.isEmpty) {
      setError(MESSAGES.needItem[language]);
      return;
    }
    if (!cart.paymentMethod) {
      setError(MESSAGES.needPayment[language]);
      return;
    }
    // A credit bill with nobody attached is an unrecoverable debt.
    if (cart.paymentMethod === "credit" && !cart.creditCustomer) {
      setError(MESSAGES.needCustomer[language]);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const items: OrderItem[] = cart.lines.map((l) => ({
        itemId: l.itemId,
        name: l.name,
        ...(l.nameTa ? { nameTa: l.nameTa } : {}),
        price: l.price,
        qty: l.qty,
        ...(l.note.trim() ? { note: l.note.trim() } : {}),
      }));

      const isSplit = cart.paymentMethod === "split";
      const credit = cart.paymentMethod === "credit" ? cart.creditCustomer : null;

      // Deliberately not awaited: createOrder() hands back orderId/ref the
      // instant the write is queued in Firestore's local cache, which is
      // what "works offline" actually depends on. Awaiting its `synced`
      // promise here would block this whole function — including printing
      // the bill and clearing the cart below — until the write reaches the
      // server, which per the Firestore SDK's documented behaviour never
      // happens while offline. That used to be exactly what this line did
      // (`await createOrder(...)`), silently defeating the offline design:
      // the "Print Bill" button would sit on "Saving…" indefinitely with a
      // real network outage, instead of completing immediately the way an
      // offline-first POS has to.
      // Also synchronous and offline-safe, for the same reason — see
      // billCounter.ts. This is the real, sequential bill number (starts
      // at DAILY_BILL_START each calendar day, never repeats within it);
      // the order id is no longer used for anything the customer sees.
      const billNo = getNextBillNo();

      const { orderId, synced } = createOrder({
        items,
        subtotal: cart.subtotal,
        // The cafe gives no discounts. The field stays on the document so
        // older orders that do carry one remain comparable.
        discount: 0,
        total: cart.total,
        paymentMethod: cart.paymentMethod,
        // Only written for a split bill; Firestore rejects undefined, so the
        // keys have to be absent rather than set to undefined.
        ...(isSplit ? { cashAmount: cart.splitCashAmount, upiAmount: cart.splitUpiAmount } : {}),
        ...(credit ? { customerId: credit.customerId, customerName: credit.name } : {}),
        workerId,
        // Who's actually on shift (see useActiveWorkerName), not just
        // whose PIN is signed in — this is what the Owner app's order
        // history colours its dot by.
        billedByName: workerName,
        billNo,
      });
      // Background-only: logs a real write failure (e.g. offline the whole
      // shift and the app closed before reconnecting) without gating
      // anything above on it. watchOrderSyncStatus below is what actually
      // drives the visible pending/rejected state.
      synced.catch((err) => console.error(`Order ${orderId} failed to reach the server`, err));

      if (credit) {
        // Deliberately not awaited, and separate from the order write: an
        // increment is applied server-side and survives being queued offline,
        // so the balance still lands even if this is written mid-outage.
        adjustCustomerBalance(credit.customerId, cart.total).catch((err) => {
          console.error("Customer balance update failed", err);
        });
      }

      setPendingOrderIds((ids) => [...ids, orderId]);
      const unsubscribe = watchOrderSyncStatus(
        orderId,
        (state) => {
          if (state.rejected) {
            // The queued write reached the server and was turned down there
            // (see OrderSyncState.rejected) — this is not the same as
            // "synced", even though it's also no longer pending. The bill
            // is already in the customer's hand by now; all that's left is
            // to say so rather than quietly counting it as done.
            console.error(`Order ${orderId} was rejected by the server after syncing.`);
            setPendingOrderIds((ids) => ids.filter((id) => id !== orderId));
            setError(MESSAGES.syncRejected[language]);
            unsubscribe();
            return;
          }
          if (!state.isPending) {
            setPendingOrderIds((ids) => ids.filter((id) => id !== orderId));
            unsubscribe();
            // Genuinely synced (not rejected, not pending) — record that.
            // Fire-and-forget: this is a courtesy timestamp for anyone
            // auditing sync health later, not something the badge or any
            // current screen reads back, so a failure here doesn't need to
            // surface anywhere.
            markOrderSynced(orderId).catch((err) =>
              console.error(`Failed to mark order ${orderId} as synced`, err),
            );
          }
        },
        (err) => {
          // Can't confirm sync state for this order anymore — stop tracking
          // it as pending rather than leaving the badge stuck forever.
          console.error("Order sync watch failed", err);
          setPendingOrderIds((ids) => ids.filter((id) => id !== orderId));
        },
      );

      onSaved({
        orderId,
        billNo: String(billNo),
        // The receipt prints in Tamil regardless of the app's language, so it
        // takes nameTa when the item has one.
        items: cart.lines.map((l) => ({
          name: l.nameTa || l.name,
          qty: l.qty,
          price: l.price,
          note: l.note.trim() || undefined,
        })),
        subtotal: cart.subtotal,
        total: cart.total,
        paymentMethod: cart.paymentMethod,
        paymentLabel: paymentLabelForReceipt(cart.paymentMethod),
        ...(credit ? { customerName: credit.name } : {}),
        ...(isSplit
          ? {
              paymentBreakdown: splitBreakdownForReceipt({
                cash: cart.splitCashAmount,
                upi: cart.splitUpiAmount,
              }),
            }
          : {}),
        workerName,
        createdAt: new Date(),
      }, print);

      cart.clearCart();
      setSuccessMessage(MESSAGES.saved[language]);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_MS);
    } catch (err) {
      console.error("Order submission failed", err);
      setError(MESSAGES.saveFailed[language]);
    } finally {
      setSubmitting(false);
    }
  }, [cart, workerId, workerName, onSaved, language]);

  return { submit, submitting, error, successMessage, pendingCount: pendingOrderIds.length };
}
