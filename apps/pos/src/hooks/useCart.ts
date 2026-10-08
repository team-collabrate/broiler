import { useCallback, useMemo, useReducer } from 'react';
import { addLine, cartTotals, removeLine, type CartLine } from '@broiler/shared';

type Action = { type: 'add'; line: CartLine } | { type: 'remove'; itemId: string } | { type: 'clear' };

// The merge and pricing rules live in @broiler/shared so they can be unit-tested.
function reducer(lines: CartLine[], action: Action): CartLine[] {
  switch (action.type) {
    case 'add':
      return addLine(lines, action.line);
    case 'remove':
      return removeLine(lines, action.itemId);
    case 'clear':
      return [];
  }
}

export function useCart() {
  const [lines, dispatch] = useReducer(reducer, []);

  const totals = useMemo(() => cartTotals(lines), [lines]);

  const add = useCallback((line: CartLine) => dispatch({ type: 'add', line }), []);
  const remove = useCallback((itemId: string) => dispatch({ type: 'remove', itemId }), []);
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);

  return { lines, ...totals, add, remove, clear };
}
