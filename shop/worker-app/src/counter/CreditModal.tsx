import { useEffect, useMemo, useState } from "react";
import { describeError, filterCustomersByName, formatMoney, MAX_CUSTOMER_NAME, tidyCustomerName, type Customer } from "@kumbakonam/shared/core";
import { getOutstandingCustomers } from "@kumbakonam/shared/shop";
import { t } from "./strings";

interface Props {
  totalMinor: number;
  /** The name already chosen for this bill, if the sheet is reopened. */
  current: string | null;
  /** Called with the chosen or typed name. The same name always finds the same customer. */
  onChoose: (name: string) => void;
  onCancel: () => void;
}

/**
 * Chooses who a credit (kadan) bill is for. The list is only people who owe something right now, which is the
 * counter's whole customer list: a settled customer drops off it and returns the next time they take credit. Typing
 * narrows the list; a name that is not on it makes a new customer.
 */
export function CreditModal({ totalMinor, current, onChoose, onCancel }: Props) {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState(current ?? "");
  const [error, setError] = useState<string | null>(null);

  // Fetched once when the sheet opens (not on every re-render of the screen behind it).
  useEffect(() => {
    let alive = true;
    getOutstandingCustomers().then(
      (list) => alive && setCustomers(list),
      (e) => alive && setLoadError(describeError(e)),
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const shown = useMemo(() => filterCustomersByName(customers ?? [], name), [customers, name]);

  const submitTyped = () => {
    const tidy = tidyCustomerName(name);
    if (tidy === "") return setError(t.needName);
    onChoose(tidy.slice(0, MAX_CUSTOMER_NAME));
  };

  return (
    <div className="ct-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="ct-sheet ct-sheet--narrow" role="dialog" aria-modal="true" aria-label={t.creditTitle}>
        <header className="ct-sheet__header">
          <div className="ct-sheet__heading">
            <h2 className="ct-sheet__title">{t.creditTitle}</h2>
            <span className="ct-sheet__sub ct-sheet__sub--note">{t.creditSubtitle}</span>
          </div>
          <button type="button" className="ct-sheet__close" aria-label={t.cancel} onClick={onCancel}>
            ✕
          </button>
        </header>

        <div className="ct-sheet__body">
          <div className="ct-summary">
            <div className="ct-summary__text">
              <span className="ct-summary__method">{t.thisBill}</span>
            </div>
            <span className="ct-summary__total">{formatMoney(totalMinor)}</span>
          </div>

          <label className="ct-field">
            <span className="ct-field__label">{t.newCustomer}</span>
            <input
              className="ct-input"
              value={name}
              placeholder={t.namePlaceholder}
              maxLength={MAX_CUSTOMER_NAME}
              autoComplete="off"
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && submitTyped()}
            />
          </label>
          <p className="ct-field__error" role="alert">
            {error ?? " "}
          </p>

          <span className="ct-field__label">{t.owing}</span>
          <div className="ct-list" role="list">
            {loadError ? (
              <p className="ct-list__status">{t.loadFailed(loadError)}</p>
            ) : customers === null ? (
              <p className="ct-list__status">{t.loading}</p>
            ) : customers.length === 0 ? (
              <p className="ct-list__status">{t.nobodyOwes}</p>
            ) : shown.length === 0 ? (
              <p className="ct-list__status">{t.noMatch}</p>
            ) : (
              shown.map((customer) => (
                <button key={customer.id} type="button" role="listitem" className="ct-list__row" onClick={() => onChoose(customer.name)}>
                  <span className="ct-list__name">{customer.name}</span>
                  <strong className="ct-list__amount">{formatMoney(customer.balanceMinor)}</strong>
                </button>
              ))
            )}
          </div>
        </div>

        <footer className="ct-sheet__actions">
          <button type="button" className="ct-btn ct-btn--plain" onClick={onCancel}>
            {t.cancel}
          </button>
          <button type="button" className="ct-btn ct-btn--primary" onClick={submitTyped}>
            {t.useName}
          </button>
        </footer>
      </div>
    </div>
  );
}
