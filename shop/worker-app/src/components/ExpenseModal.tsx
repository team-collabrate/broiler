import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createExpense, uploadExpenseReceipt, useLanguage } from "@kumbakonam/shared";
import "./ExpenseModal.css";

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
  addPhoto: { en: "Add bill photo", ta: "பில் புகைப்படம் சேர்" },
  retakePhoto: { en: "Change photo", ta: "புகைப்படத்தை மாற்று" },
  removePhoto: { en: "Remove", ta: "நீக்கு" },
};

export interface ExpenseModalProps {
  workerId: string;
  /** Restored when a refused write reopens this — otherwise blank. */
  initialName?: string;
  initialAmount?: string;
  initialError?: string | null;
  onClose: () => void;
  /** Fired as soon as the entry is in the local cache; the parent closes. */
  onSaved: () => void;
  /** A genuine refusal, after the dialog has already gone. */
  onFailed: (values: { name: string; amount: string }) => void;
}

/** Records money spent from the till. One entry, then it gets out of the way. */
export function ExpenseModal({
  workerId,
  initialName = "",
  initialAmount = "",
  initialError = null,
  onClose,
  onSaved,
  onFailed,
}: ExpenseModalProps) {
  const { language } = useLanguage();
  const [name, setName] = useState(initialName);
  const [amount, setAmount] = useState(initialAmount);
  const [error, setError] = useState<string | null>(initialError);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // object URL, not a data: URL — cheap for a multi-megabyte camera photo,
  // and revoked on every change/unmount so a swapped or abandoned photo
  // doesn't leak memory across however many expenses get entered in a day.
  useEffect(() => {
    if (!photo) {
      setPhotoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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

      const { expenseId, committed } = createExpense({ name: trimmed, amount: value, workerId });

      // Saved the moment it's in the local cache — the write syncs on its
      // own. Awaiting would hold the dialog open for the length of any wifi
      // outage, since a Firestore write promise doesn't resolve offline.
      onSaved();

      // This closure outlives the dialog on purpose. A refusal (bad rules,
      // a deactivated worker) has to reach someone, and by the time it
      // arrives this component is already unmounted — so the handler lives
      // in the parent, which reopens the form with the values intact.
      committed.catch((err) => {
        console.error("Expense write refused", err);
        onFailed({ name: trimmed, amount });
      });

      // Fire-and-forget, same as the expense write itself above — the
      // photo is proof-of-purchase, not the record of money spent, so a
      // failed or offline upload should never reopen the dialog or block
      // anything the way a refused expense write does. Uploading only
      // after the expense document exists (not alongside it) is
      // deliberate: Cloudinary has no offline queue the way Firestore does,
      // so this genuinely can fail on bad connectivity where the expense
      // itself just quietly queues and syncs later — see
      // uploadExpenseReceipt's own comment.
      if (photo) {
        uploadExpenseReceipt(expenseId, photo).catch((err) => {
          console.error("Receipt photo upload failed (expense itself was still saved)", err);
        });
      }
    },
    [name, amount, photo, workerId, language, onSaved, onFailed],
  );

  const handlePhotoChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPhoto(file ?? null);
    // Lets picking the exact same file again re-fire onChange (e.g. after
    // "Remove" then re-adding the same photo) — the input's own value
    // otherwise stays unchanged and no change event fires a second time.
    e.target.value = "";
  }, []);

  return (
    <div className="expense__backdrop" role="dialog" aria-modal="true" aria-label={STRINGS.title[language]}>
      <form className="expense" onSubmit={handleSubmit}>
        <div>
          <h2 className="expense__title">{STRINGS.title[language]}</h2>
          <p className="expense__subtitle">{STRINGS.subtitle[language]}</p>
        </div>

        <label className="expense__field">
          <span>{STRINGS.name[language]}</span>
          <input
            ref={nameRef}
            type="text"
            value={name}
            placeholder={STRINGS.namePlaceholder[language]}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
        </label>

        <label className="expense__field">
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

        {/* accept + capture: on a phone/tablet this opens straight to the
            camera by default, but the native chooser it triggers still
            offers gallery/files alongside it — no separate "pick from
            gallery" control needed (requested 2026-09-05: "camera or
            gallery"). Hidden input + a real button, not a bare <input
            type=file>, to match this form's own button styling. */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={handlePhotoChange}
        />
        <div className="expense__photo-field">
          {photoPreviewUrl ? (
            <div className="expense__photo-preview">
              <img src={photoPreviewUrl} alt="" />
              <div className="expense__photo-preview-actions">
                <button type="button" onClick={() => photoInputRef.current?.click()}>
                  {STRINGS.retakePhoto[language]}
                </button>
                <button type="button" onClick={() => setPhoto(null)}>
                  {STRINGS.removePhoto[language]}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="expense__photo-add" onClick={() => photoInputRef.current?.click()}>
              {STRINGS.addPhoto[language]}
            </button>
          )}
        </div>

        <div className="expense__status" role="status">
          {error ?? " "}
        </div>

        <div className="expense__actions">
          <button type="button" className="expense__close" onClick={onClose}>
            {STRINGS.close[language]}
          </button>
          <button type="submit" className="expense__save">
            {STRINGS.save[language]}
          </button>
        </div>
      </form>
    </div>
  );
}
