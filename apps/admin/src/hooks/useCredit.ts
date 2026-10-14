import { useEffect, useState } from 'react';
import {
  describeError,
  rangeFor,
  subscribeOutstandingCustomers,
  subscribePayments,
  type Customer,
  type CustomerPayment,
  type RangePreset,
} from '@broiler/shared';

interface CreditState {
  /** Everyone who owes something now. null until the first snapshot. */
  customers: Customer[] | null;
  /** Money received in the chosen range. null until the first snapshot. */
  payments: CustomerPayment[] | null;
  error: string | null;
}

/** Live outstanding balances, and the payments received in a date-range preset. */
export function useCredit(preset: RangePreset): CreditState {
  const [state, setState] = useState<CreditState>({ customers: null, payments: null, error: null });

  useEffect(() => {
    setState({ customers: null, payments: null, error: null });
    const fail = (e: Error) => setState((s) => ({ ...s, error: describeError(e) }));
    const stopCustomers = subscribeOutstandingCustomers((customers) => setState((s) => ({ ...s, customers })), fail);
    const stopPayments = subscribePayments(rangeFor(preset), (payments) => setState((s) => ({ ...s, payments })), fail);
    return () => {
      stopCustomers();
      stopPayments();
    };
  }, [preset]);

  return state;
}
