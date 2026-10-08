import { useEffect, useState } from 'react';
import { dayKey, rangeFor, subscribeOrders, type Order, type RangePreset } from '@broiler/shared';

interface OrdersState {
  /** null until the first snapshot arrives. */
  orders: Order[] | null;
  error: string | null;
}

/** Today's date key, refreshed each minute so "Today" rolls over at midnight while the app stays open. */
function useDayKey(): string {
  const [key, setKey] = useState(() => dayKey(new Date()));
  useEffect(() => {
    const id = setInterval(() => setKey(dayKey(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);
  return key;
}

/** Live orders for a date-range preset, newest first. */
export function useOrders(preset: RangePreset): OrdersState {
  const today = useDayKey();
  const [state, setState] = useState<OrdersState>({ orders: null, error: null });

  useEffect(() => {
    setState({ orders: null, error: null });
    return subscribeOrders(
      rangeFor(preset),
      (orders) => setState({ orders, error: null }),
      (e) => setState({ orders: null, error: e.message }),
    );
  }, [preset, today]);

  return state;
}
