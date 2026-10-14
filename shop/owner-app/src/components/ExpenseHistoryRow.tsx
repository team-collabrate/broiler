import { useState } from "react";
import { ConfirmDialog, deleteExpense, formatCurrency, useLanguage, type Expense } from "@kumbakonam/shared";
import "./ExpenseHistoryRow.css";

const STRINGS = {
  delete: { en: "Delete", ta: "நீக்கு" },
  deleteTitle: { en: "Delete this expense?", ta: "இந்த செலவை நீக்கவா?" },
  deleteMessage: {
    en: "This can't be undone — use it for a mistyped or duplicate entry, not a real expense you no longer want counted.",
    ta: "இதை மீட்க முடியாது — தவறாக தட்டச்சு செய்யப்பட்ட அல்லது நகல் பதிவுக்கு மட்டும் பயன்படுத்தவும், இனி கணக்கிட வேண்டாத உண்மையான செலவுக்கு அல்ல.",
  },
  deleteConfirm: { en: "Delete", ta: "நீக்கு" },
  deleteFailed: { en: "Could not delete. Try again.", ta: "நீக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்." },
  viewPhoto: { en: "View bill photo", ta: "பில் புகைப்படத்தைப் பார்" },
  closePhoto: { en: "Close", ta: "மூடு" },
};

/** Plain stroke camera icon, matching worker-app's SidebarIcons.tsx style
 *  (24x24, stroke=currentColor, no fill) — kept inline here rather than a
 *  shared component since nothing else in owner-app uses it yet. */
function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l2-2h6l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="14" r="3.5" />
    </svg>
  );
}

export interface ExpenseHistoryRowProps {
  expense: Expense;
  /** Omit to render without a delete control at all (kept optional so this
   *  stays a plain display row wherever showing one doesn't make sense). */
  onDeleted?: () => void;
}

/** One line of spending — a name, a time, an amount, and (if `onDeleted` is
 *  given) a way to remove it: the correction path for a mistyped or
 *  duplicate entry, which used to exist as a service function
 *  (deleteExpense) with no button anywhere in either app calling it. */
export function ExpenseHistoryRow({ expense, onDeleted }: ExpenseHistoryRowProps) {
  const { language } = useLanguage();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState(false);

  const confirmDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteExpense(expense.expenseId);
      setConfirming(false);
      onDeleted?.();
    } catch (err) {
      console.error("Delete expense failed", err);
      setError(STRINGS.deleteFailed[language]);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="expense-row">
      <span className="expense-row__time">
        {/* Queued offline writes have no server timestamp until they sync. */}
        {expense.createdAt
          ? expense.createdAt.toDate().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
          : "—"}
      </span>
      <span className="expense-row__name">{expense.name}</span>

      {/* Only rendered when a photo was actually attached (requested
          2026-09-05) — most expenses recorded before this existed, or
          where the upload failed/was skipped, have none. */}
      {expense.receiptPhotoUrl && (
        <button
          type="button"
          className="expense-row__photo"
          onClick={() => setViewingPhoto(true)}
          aria-label={STRINGS.viewPhoto[language]}
        >
          <CameraIcon />
        </button>
      )}

      <span className="expense-row__amount">−{formatCurrency(expense.amount)}</span>

      {onDeleted && (
        <button
          type="button"
          className="expense-row__delete"
          onClick={() => setConfirming(true)}
          aria-label={`${STRINGS.delete[language]} ${expense.name}`}
        >
          ×
        </button>
      )}

      {confirming && (
        <ConfirmDialog
          title={STRINGS.deleteTitle[language]}
          message={error ?? STRINGS.deleteMessage[language]}
          confirmLabel={deleting ? undefined : STRINGS.deleteConfirm[language]}
          destructive
          onConfirm={confirmDelete}
          onCancel={() => setConfirming(false)}
        />
      )}

      {viewingPhoto && expense.receiptPhotoUrl && (
        <div
          className="expense-row__photo-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={STRINGS.viewPhoto[language]}
          onClick={() => setViewingPhoto(false)}
        >
          <img src={expense.receiptPhotoUrl} alt="" onClick={(e) => e.stopPropagation()} />
          <button
            type="button"
            className="expense-row__photo-close"
            onClick={() => setViewingPhoto(false)}
          >
            {STRINGS.closePhoto[language]}
          </button>
        </div>
      )}
    </div>
  );
}
