import { useCallback, useMemo, useReducer } from 'react';
import { lineTotalMinor, type OrderLineInput } from '@broiler/shared';

/** 999.999 kg: the most the keypad can enter, kept as a ceiling when weights are merged. */
export const MAX_LINE_GRAMS = 999_999;

export type CartLine = OrderLineInput;

type Action = { type: 'add'; line: CartLine } | { type: 'remove'; itemId: string } | { type: 'clear' };

function reducer(lines: CartLine[], action: Action): CartLine[] {
  switch (action.type) {
    case 'add': {
      const { line } = action;
      const existing = lines.find((l) => l.itemId === line.itemId);
      if (!existing) return [...lines, { ...line, grams: Math.min(line.grams, MAX_LINE_GRAMS) }];
      // Weighing the same item again adds to its line rather than starting a second one.
      return lines.map((l) =>
        l.itemId === line.itemId ? { ...l, grams: Math.min(l.grams + line.grams, MAX_LINE_GRAMS) } : l,
      );
    }
    case 'remove':
      return lines.filter((l) => l.itemId !== action.itemId);
    case 'clear':
      return [];
  }
}

export function useCart() {
  const [lines, dispatch] = useReducer(reducer, []);

  const totals = useMemo(
    () => ({
      totalMinor: lines.reduce((sum, l) => sum + lineTotalMinor(l.pricePerKgMinor, l.grams), 0),
      totalGrams: lines.reduce((sum, l) => sum + l.grams, 0),
    }),
    [lines],
  );

  const add = useCallback((line: CartLine) => dispatch({ type: 'add', line }), []);
  const remove = useCallback((itemId: string) => dispatch({ type: 'remove', itemId }), []);
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);

  return { lines, ...totals, add, remove, clear };
}
