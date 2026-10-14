import { useState } from "react";
import { formatCurrency, useLanguage, useSession, type Customer } from "@kumbakonam/shared";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { CustomerHistoryModal } from "./CustomerHistoryModal";
import "./OwedCustomersModal.css";

const STRINGS = {
  title: { en: "Owed to you", ta: "வர வேண்டியது" },
  total: { en: "Total outstanding", ta: "மொத்த நிலுவை" },
  nobody: { en: "Everyone has settled.", ta: "அனைவரும் கடனை அடைத்துவிட்டனர்." },
  collect: { en: "Collect", ta: "பணம் பெறு" },
  close: { en: "Close", ta: "மூடு" },
};

export interface OwedCustomersModalProps {
  customers: Customer[];
  totalOutstanding: number;
  onClose: () => void;
  /** Called after a payment is successfully recorded — refetches the
   *  caller's customer list, since it stopped being a live subscription
   *  (2026-09-07, see useCustomers' own comment). Balances/the list here
   *  otherwise go stale until this modal is closed and reopened. */
  onChanged?: () => void;
}

/** Pop-up detail behind the Dashboard's "Owed to you" card — who owes what,
 *  biggest first (customers.outstanding already comes sorted that way), with
 *  the same Collect flow ReportsScreen offers rather than a second one. */
export function OwedCustomersModal({ customers, totalOutstanding, onClose, onChanged }: OwedCustomersModalProps) {
  const { language } = useLanguage();
  const { sessionUser } = useSession();
  const [collectingFrom, setCollectingFrom] = useState<Customer | null>(null);
  const [viewingHistoryFor, setViewingHistoryFor] = useState<Customer | null>(null);

  return (
    <>
      <div className="owed-modal__backdrop" role="dialog" aria-modal="true" aria-label={STRINGS.title[language]}>
        <div className="owed-modal">
          <div className="owed-modal__header">
            <h2 className="owed-modal__title">{STRINGS.title[language]}</h2>
            <p className="owed-modal__total">{formatCurrency(totalOutstanding)}</p>
          </div>

          {customers.length === 0 ? (
            <p className="owed-modal__empty">{STRINGS.nobody[language]}</p>
          ) : (
            <ul className="owed-modal__list">
              {customers.map((customer) => (
                <li key={customer.customerId}>
                  {/* Whole name is the "view history" trigger, not a
                      separate button — requested 2026-09-05, and this row
                      already has no other use for a tap on the name
                      itself. Collect stays its own explicit button since
                      it's a real money-moving action, not a view. */}
                  <button
                    type="button"
                    className="owed-modal__name"
                    onClick={() => setViewingHistoryFor(customer)}
                  >
                    {customer.name}
                  </button>
                  <span className="owed-modal__balance">{formatCurrency(customer.balance)}</span>
                  {sessionUser && (
                    <button type="button" className="owed-modal__collect" onClick={() => setCollectingFrom(customer)}>
                      {STRINGS.collect[language]}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <button type="button" className="owed-modal__close" onClick={onClose}>
            {STRINGS.close[language]}
          </button>
        </div>
      </div>

      {collectingFrom && sessionUser && (
        <RecordPaymentModal
          customer={collectingFrom}
          ownerId={sessionUser.userId}
          onClose={() => setCollectingFrom(null)}
          onSaved={onChanged}
        />
      )}

      {viewingHistoryFor && (
        <CustomerHistoryModal
          customerId={viewingHistoryFor.customerId}
          customerName={viewingHistoryFor.name}
          onClose={() => setViewingHistoryFor(null)}
        />
      )}
    </>
  );
}
