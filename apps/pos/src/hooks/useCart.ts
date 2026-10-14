import { useCallback, useMemo, useReducer } from 'react';
import { addLine, cartTotals, removeLine, replaceLine, type CartLine, type OrderLineInput } from '@broiler/shared';

type Action =
  | { type: 'add'; line: OrderLineInput }
  | { type: 'remove'; key: string }
  | { type: 'replace'; key: string; line: OrderLineInput }
  | { type: 'clear' };

// The merge, adjustment and pricing rules live in @broiler/shared so they can be unit-tested.
function reducer(lines: CartLine[], action: Action): CartLine[] {
  switch (action.type) {
    case 'add':
      return addLine(lines, action.line);
    case 'remove':
      return removeLine(lines, action.key);
    case 'replace':
      return replaceLine(lines, action.key, action.line);
    case 'clear':
      return [];
  }
}

export function useCart() {
  const [lines, dispatch] = useReducer(reducer, []);

  const totals = useMemo(() => cartTotals(lines), [lines]);

  const add = useCallback((line: OrderLineInput) => dispatch({ type: 'add', line }), []);
  const remove = useCallback((key: string) => dispatch({ type: 'remove', key }), []);
  const replace = useCallback((key: string, line: OrderLineInput) => dispatch({ type: 'replace', key, line }), []);
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);

  return { lines, ...totals, add, remove, replace, clear };
}
