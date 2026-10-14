import { formatCurrency, useLanguage, type Expense } from "@kumbakonam/shared";
import { ExpenseHistoryRow } from "./ExpenseHistoryRow";
import "./TodaySpendingModal.css";

const STRINGS = {
  title: { en: "Today's spending", ta: "இன்றைய செலவு" },
  empty: { en: "Nothing spent today.", ta: "இன்று எதுவும் செலவு செய்யவில்லை." },
  add: { en: "+ Add", ta: "+ சேர்" },
  close: { en: "Close", ta: "மூடு" },
};

export interface TodaySpendingModalProps {
  expenses: Expense[];
  totalSpent: number;
  onClose: () => void;
  /** Overrides STRINGS.title — Dashboard's "today" default doesn't fit
   *  Reports, where the list can span a week or month depending on the
   *  selected range. */
  title?: string;
  /** Opens RecordExpenseModal from inside this popup when given — omit to
   *  render a view-only list (Dashboard doesn't currently offer adding
   *  from here; Reports does, replacing its old standalone "+ Add" button
   *  now that the full list lives in this popup instead of an inline
   *  section). */
  onAdd?: () => void;
  /** Called after a row is successfully deleted — refetches the caller's
   *  expense list, since it stopped being a live subscription (2026-09-07,
   *  see useExpensesInRange's own comment). Without this the row would
   *  stay visible (Firestore delete already succeeded) until the popup is
   *  closed and reopened. */
  onChanged?: () => void;
}

/** Pop-up behind the "Spent" figure — what the worker typed for each
 *  expense (Expense.name) plus its amount and time, newest first
 *  (subscribeToExpensesInRange already orders that way). The figure on the
 *  card is just a total; this is where the "spent on what" the owner asked
 *  for actually shows. */
export function TodaySpendingModal({ expenses, totalSpent, onClose, title, onAdd, onChanged }: TodaySpendingModalProps) {
  const { language } = useLanguage();

  return (
    <div
      className="spending-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? STRINGS.title[language]}
    >
      <div className="spending-modal">
        <div className="spending-modal__header">
          <h2 className="spending-modal__title">{title ?? STRINGS.title[language]}</h2>
          <p className="spending-modal__total">−{formatCurrency(totalSpent)}</p>
        </div>

        {onAdd && (
          <button type="button" className="spending-modal__add" onClick={onAdd}>
            {STRINGS.add[language]}
          </button>
        )}

        {expenses.length === 0 ? (
          <p className="spending-modal__empty">{STRINGS.empty[language]}</p>
        ) : (
          <div className="spending-modal__list">
            {/* onDeleted triggers the caller's refresh() — this list is no
                longer a live subscription (see useExpensesInRange's own
                comment), so nothing removes the row on its own once
                Firestore confirms the delete. */}
            {expenses.map((expense) => (
              <ExpenseHistoryRow key={expense.expenseId} expense={expense} onDeleted={onChanged} />
            ))}
          </div>
        )}

        <button type="button" className="spending-modal__close" onClick={onClose}>
          {STRINGS.close[language]}
        </button>
      </div>
    </div>
  );
}
