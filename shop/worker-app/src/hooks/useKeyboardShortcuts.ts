import { useEffect } from "react";
import { useLanguage, type MenuItem, type PaymentMethod } from "@kumbakonam/shared";
import type { UseCartResult } from "./useCart";
import type { UseOrderSubmitResult } from "./useOrderSubmit";

/** Keys 1-9 then 0 — matches the ⌨ badges MenuGrid shows on the first 10 visible items. */
const DIGIT_TO_INDEX: Record<string, number> = {
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 3,
  "5": 4,
  "6": 5,
  "7": 6,
  "8": 7,
  "9": 8,
  "0": 9,
};

const PAYMENT_KEYS: Record<string, PaymentMethod> = { c: "cash", u: "upi", s: "split", k: "credit" };

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export interface UseKeyboardShortcutsOptions {
  visibleItems: MenuItem[];
  cart: UseCartResult;
  orderSubmit: UseOrderSubmitResult;
  /** Routed through WorkerHome rather than set on the cart directly, because
   *  picking Split also has to open the amounts dialog. */
  onSelectPayment: (method: PaymentMethod) => void;
  onCycleCategory: (direction: 1 | -1) => void;
  onRequestClearCart: () => void;
  onOpenPrinterSetup: () => void;
  onOpenExpenses: () => void;
  onOpenKhata: () => void;
}

/**
 * Counter keyboard shortcuts for the ordering screen — Design Brief's "speed
 * over decoration" principle, but for staff with a physical keyboard instead
 * of only touch. Disabled while typing in a text field, and while any modal
 * (confirm dialog / bill view / printer setup) is open — those own their own
 * Escape/Enter handling, so this stays out of their way entirely.
 *
 * Key map:
 *   1-9, 0   add the Nth visible menu item (see the badge on each card)
 *   ← / →    switch category tab
 *   C/U/S/K  select Cash / UPI / Split / Credit (S and K open a dialog)
 *   Enter    submit the order (Print Bill)
 *   ⌫/Del    clear cart (opens a confirm dialog — the only way to clear now)
 *   P        open printer setup
 *   E        record spending
 *   B        open the credit book
 *   L        toggle English/Tamil
 */
export function useKeyboardShortcuts({
  visibleItems,
  cart,
  orderSubmit,
  onSelectPayment,
  onCycleCategory,
  onRequestClearCart,
  onOpenPrinterSetup,
  onOpenExpenses,
  onOpenKhata,
}: UseKeyboardShortcutsOptions): void {
  const { toggleLanguage } = useLanguage();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (TYPING_TAGS.has(target.tagName) || target.isContentEditable)) return;
      // Any open modal handles its own Escape/Enter — stay out of the way entirely.
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;

      if (e.key in DIGIT_TO_INDEX) {
        const item = visibleItems[DIGIT_TO_INDEX[e.key]];
        if (item) {
          e.preventDefault();
          cart.addItem(item);
        }
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        onCycleCategory(1);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onCycleCategory(-1);
        return;
      }

      const lower = e.key.toLowerCase();
      if (lower in PAYMENT_KEYS) {
        e.preventDefault();
        onSelectPayment(PAYMENT_KEYS[lower]);
        return;
      }

      if (lower === "l") {
        e.preventDefault();
        toggleLanguage();
        return;
      }

      if (lower === "p") {
        e.preventDefault();
        onOpenPrinterSetup();
        return;
      }

      if (lower === "e") {
        e.preventDefault();
        onOpenExpenses();
        return;
      }

      if (lower === "b") {
        e.preventDefault();
        onOpenKhata();
        return;
      }

      if (e.key === "Enter") {
        if (!orderSubmit.submitting && !cart.isEmpty && cart.paymentMethod) {
          e.preventDefault();
          void orderSubmit.submit();
        }
        return;
      }

      if (e.key === "Backspace" || e.key === "Delete") {
        if (!cart.isEmpty) {
          e.preventDefault();
          onRequestClearCart();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    visibleItems,
    cart,
    orderSubmit,
    onSelectPayment,
    onCycleCategory,
    onRequestClearCart,
    onOpenPrinterSetup,
    onOpenExpenses,
    onOpenKhata,
    toggleLanguage,
  ]);
}
