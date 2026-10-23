import { useCallback, useMemo, useReducer } from "react";
import { addLine, cartTotals, regroupLines, removeLine, replaceLine, type CartLine, type OrderLineInput } from "@kumbakonam/shared/core";

type Action =
  | { type: "add"; line: OrderLineInput; keepPacks: boolean }
  | { type: "regroup"; keepPacks: boolean }
  | { type: "remove"; key: string }
  | { type: "replace"; key: string; line: OrderLineInput }
  | { type: "clear" };

// The merge, edit and pricing rules live in the core module so they can be unit-tested.
function reducer(lines: CartLine[], action: Action): CartLine[] {
  switch (action.type) {
    case "add":
      return regroupLines(addLine(lines, action.line), action.keepPacks);
    case "regroup":
      return regroupLines(lines, action.keepPacks);
    case "remove":
      return removeLine(lines, action.key);
    case "replace":
      return replaceLine(lines, action.key, action.line);
    case "clear":
      return [];
  }
}

/** The sale in progress: lines, their totals, and add, edit, remove and clear. */
export function useCounterCart() {
  const [lines, dispatch] = useReducer(reducer, []);
  const totals = useMemo(() => cartTotals(lines), [lines]);

  /** Adds a line; `keepPacks` says whether equal packs stay apart (2 × 250 g) or add up (500 g). */
  const add = useCallback((line: OrderLineInput, keepPacks: boolean) => dispatch({ type: "add", line, keepPacks }), []);
  /** Puts the whole cart in the form the "Keep packs separate" box asks for. */
  const regroup = useCallback((keepPacks: boolean) => dispatch({ type: "regroup", keepPacks }), []);
  const remove = useCallback((key: string) => dispatch({ type: "remove", key }), []);
  const replace = useCallback((key: string, line: OrderLineInput) => dispatch({ type: "replace", key, line }), []);
  const clear = useCallback(() => dispatch({ type: "clear" }), []);

  return { lines, ...totals, add, regroup, remove, replace, clear };
}
