import { useCallback, useMemo, useState } from "react";
import type { MenuItem, PaymentMethod } from "@kumbakonam/shared";

export interface CartLine {
  itemId: string;
  name: string;
  nameTa?: string;
  price: number;
  qty: number;
  note: string;
}

export interface UseCartResult {
  lines: CartLine[];
  isEmpty: boolean;
  addItem: (item: MenuItem) => void;
  incrementQty: (itemId: string) => void;
  decrementQty: (itemId: string) => void;
  removeLine: (itemId: string) => void;
  setNote: (itemId: string, note: string) => void;
  paymentMethod: PaymentMethod | null;
  /** Accepts null so cancelling the split dialog can undo the choice. */
  setPaymentMethod: (method: PaymentMethod | null) => void;
  /** UPI/GPay share of a split bill. The cash share is whatever is left. */
  splitUpiAmount: number;
  setSplitUpiAmount: (value: number) => void;
  /** Derived: total - splitUpiAmount. Never set directly. */
  splitCashAmount: number;
  /** Who a credit bill is on account for. Null for every other method. */
  creditCustomer: { customerId: string; name: string } | null;
  setCreditCustomer: (customer: { customerId: string; name: string } | null) => void;
  subtotal: number;
  total: number;
  clearCart: () => void;
}

/** Cart state for the order-in-progress — PRD §5.1 (qty/note/remove). */
export function useCart(): UseCartResult {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [splitUpiInput, setSplitUpiInput] = useState(0);
  const [creditCustomer, setCreditCustomer] = useState<{ customerId: string; name: string } | null>(null);

  const addItem = useCallback((item: MenuItem) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.itemId === item.itemId);
      if (existing) {
        return prev.map((l) => (l.itemId === item.itemId ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { itemId: item.itemId, name: item.name, nameTa: item.nameTa, price: item.price, qty: 1, note: "" }];
    });
  }, []);

  const incrementQty = useCallback((itemId: string) => {
    setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + 1 } : l)));
  }, []);

  const decrementQty = useCallback((itemId: string) => {
    setLines((prev) =>
      prev
        .map((l) => (l.itemId === itemId ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0),
    );
  }, []);

  const removeLine = useCallback((itemId: string) => {
    setLines((prev) => prev.filter((l) => l.itemId !== itemId));
  }, []);

  const setNote = useCallback((itemId: string, note: string) => {
    setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, note } : l)));
  }, []);

  const setSplitUpiAmount = useCallback((value: number) => {
    setSplitUpiInput(Number.isFinite(value) && value >= 0 ? value : 0);
  }, []);

  const clearCart = useCallback(() => {
    setLines([]);
    setPaymentMethod(null);
    setSplitUpiInput(0);
    setCreditCustomer(null);
  }, []);

  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + l.price * l.qty, 0), [lines]);

  // No discount: the cafe doesn't give them, so the total is the subtotal.
  const total = subtotal;

  // Only the UPI side is stored; cash is always the remainder. That is what
  // makes the two boxes track each other, and it means adding an item after
  // the split was entered can't leave the two halves disagreeing with the
  // bill — the cash side simply absorbs the change.
  const splitUpiAmount = Math.min(Math.max(splitUpiInput, 0), total);
  const splitCashAmount = total - splitUpiAmount;

  return {
    lines,
    isEmpty: lines.length === 0,
    addItem,
    incrementQty,
    decrementQty,
    removeLine,
    setNote,
    paymentMethod,
    setPaymentMethod,
    splitUpiAmount,
    setSplitUpiAmount,
    splitCashAmount,
    creditCustomer,
    setCreditCustomer,
    subtotal,
    total,
    clearCart,
  };
}
