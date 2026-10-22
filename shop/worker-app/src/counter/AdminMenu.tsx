import { useEffect } from "react";
import { t } from "./strings";

/** The letters a counter can be given. "A" is the first and prints bill numbers with no letter. */
const COUNTER_LETTERS = ["A", "B", "C", "D"];

interface Props {
  /** Today's rates are not all set yet: the entry says so. */
  rateNeeded: boolean;
  /** This tablet's counter letter. */
  device: string;
  /** Only the owner may give the tablet a different letter. */
  canSetDevice: boolean;
  onDevice: (letter: string) => void;
  onKhata: () => void;
  onRecent: () => void;
  onRates: () => void;
  onPrinter: () => void;
  onLock: () => void;
  onClose: () => void;
}

/** What the round Admin button opens: the owner's jobs at the counter, kept off the selling screen. */
export function AdminMenu({ rateNeeded, device, canSetDevice, onDevice, onKhata, onRecent, onRates, onPrinter, onLock, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ct-backdrop ct-backdrop--corner" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ct-menu" role="dialog" aria-modal="true" aria-label={t.adminMenuTitle}>
        <h2 className="ct-menu__title">{t.adminMenuTitle}</h2>
        <button type="button" className="ct-menu__item" onClick={onKhata}>
          {t.khataMenu}
        </button>
        <button type="button" className="ct-menu__item" onClick={onRecent}>
          {t.recentMenu}
        </button>
        <button type="button" className="ct-menu__item" onClick={onRates}>
          {t.todaysRate}
          {rateNeeded && <span className="ct-menu__dot" />}
        </button>
        <button type="button" className="ct-menu__item" onClick={onPrinter}>
          {t.printerTitle}
        </button>
        <div className="ct-menu__row">
          <span>{t.counterLetter(device)}</span>
          {canSetDevice && (
            <span className="ct-menu__letters" role="group" aria-label={t.counterLetterHint}>
              {COUNTER_LETTERS.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  className={`ct-menu__letter${letter === device ? " is-on" : ""}`}
                  aria-pressed={letter === device}
                  onClick={() => onDevice(letter)}
                >
                  {letter}
                </button>
              ))}
            </span>
          )}
        </div>
        <button type="button" className="ct-menu__item" onClick={onLock}>
          {t.lockLabel}
        </button>
        <button type="button" className="ct-menu__item ct-menu__item--close" onClick={onClose}>
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
