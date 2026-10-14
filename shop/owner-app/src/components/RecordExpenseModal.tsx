import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createExpense, uploadExpenseReceipt, useLanguage } from "@kumbakonam/shared";
import "./RecordExpenseModal.css";

const STRINGS = {
  title: { en: "Record spending", ta: "செலவு பதிவு" },
  subtitle: {
    en: "Vegetables, milk, gas — anything paid for out of the till.",
    ta: "காய்கறி, பால், கேஸ் — கல்லாவிலிருந்து செலுத்திய அனைத்தும்.",
  },
  name: { en: "What was bought", ta: "என்ன வாங்கியது" },
  namePlaceholder: { en: "Vegetables", ta: "காய்கறி" },
  amount: { en: "Amount (₹)", ta: "தொகை (₹)" },
  save: { en: "Save", ta: "சேமி" },
  close: { en: "Close", ta: "மூடு" },
  needName: { en: "Type what was bought.", ta: "என்ன வாங்கியது என்று எழுதவும்." },
  needAmount: { en: "Enter an amount above zero.", ta: "பூஜ்ஜியத்திற்கு மேல் தொகையை உள்ளிடவும்." },
  failed: { en: "Could not save. Try again.", ta: "சேமிக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்." },
  addPhoto: { en: "Add bill photo", ta: "பில் புகைப்படம் சேர்" },
  retakePhoto: { en: "Change photo", ta: "புகைப்படத்தை மாற்று" },
  removePhoto: { en: "Remove", ta: "நீக்கு" },
};

export interface RecordExpenseModalProps {
  /** The active owner's own user id — expenses.workerId per the schema name, filled by whoever recorded it. */
  ownerId: string;
  onClose: () => void;
  /** Called once, right before onClose, only after a genuine successful
   *  save — never on Cancel. Added 2026-09-07 when the expenses list
   *  stopped being a live subscription (see useExpensesInRange's own
   *  comment): the caller needs an explicit signal to refetch, since
   *  nothing updates that list on its own anymore. Kept separate from
   *  onClose specifically so cancelling doesn't trigger a wasted refetch. */
  onSaved?: () => void;
}

/**
 * Owner-side equivalent of the worker app's ExpenseModal. The worker could
 * always record till spending from the counter; the owner could only view
 * it in reports afterward, with no way to log a purchase they made
 * themselves (a supplier run, say) — this closes that gap. Same
 * createExpense() call the worker uses; the rule already allows the owner
 * role.
 */
export function RecordExpenseModal({ ownerId, onClose, onSaved }: RecordExpenseModalProps) {
  const { language } = useLanguage();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) {
      setPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const handlePhotoChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPhoto(file ?? null);
    e.target.value = "";
  }, []);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      const value = Number(amount);

      if (!trimmed) {
        setError(STRINGS.needName[language]);
        return;
      }
      if (!Number.isFinite(value) || value <= 0) {
        setError(STRINGS.needAmount[language]);
        return;
      }

      setSaving(true);
      const { expenseId, committed } = createExpense({ name: trimmed, amount: value, workerId: ownerId });
      committed
        .then(() => {
          // Fire-and-forget, same reasoning as the worker app's
          // ExpenseModal — a failed photo upload should never undo an
          // already-successful expense save, so this doesn't block closing.
          if (photo) {
            uploadExpenseReceipt(expenseId, photo).catch((err) => {
              console.error("Receipt photo upload failed (expense itself was still saved)", err);
            });
          }
          onSaved?.();
          onClose();
        })
        .catch((err) => {
          console.error("Expense write refused", err);
          setError(STRINGS.failed[language]);
          setSaving(false);
        });
    },
    [name, amount, photo, ownerId, language, onClose, onSaved],
  );

  return (
    <div className="record-expense__backdrop" role="dialog" aria-modal="true" aria-label={STRINGS.title[language]}>
      <form className="record-expense" onSubmit={handleSubmit}>
        <div>
          <h2 className="record-expense__title">{STRINGS.title[language]}</h2>
          <p className="record-expense__subtitle">{STRINGS.subtitle[language]}</p>
        </div>

        <label className="record-expense__field">
          <span>{STRINGS.name[language]}</span>
          <input
            type="text"
            value={name}
            placeholder={STRINGS.namePlaceholder[language]}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoFocus
          />
        </label>

        <label className="record-expense__field">
          <span>{STRINGS.amount[language]}</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={amount}
            placeholder="0"
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={handlePhotoChange}
        />
        <div className="record-expense__photo-field">
          {photoPreviewUrl ? (
            <div className="record-expense__photo-preview">
              <img src={photoPreviewUrl} alt="" />
              <div className="record-expense__photo-preview-actions">
                <button type="button" onClick={() => photoInputRef.current?.click()}>
                  {STRINGS.retakePhoto[language]}
                </button>
                <button type="button" onClick={() => setPhoto(null)}>
                  {STRINGS.removePhoto[language]}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="record-expense__photo-add"
              onClick={() => photoInputRef.current?.click()}
            >
              {STRINGS.addPhoto[language]}
            </button>
          )}
        </div>

        <div className="record-expense__status" role="status">
          {error ?? " "}
        </div>

        <div className="record-expense__actions">
          <button type="button" className="record-expense__cancel" onClick={onClose} disabled={saving}>
            {STRINGS.close[language]}
          </button>
          <button type="submit" className="record-expense__save" disabled={saving}>
            {STRINGS.save[language]}
          </button>
        </div>
      </form>
    </div>
  );
}
