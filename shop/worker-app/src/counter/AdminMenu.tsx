import { useEffect } from "react";
import { t } from "./strings";

interface Props {
  /** Today's rates are not all set yet: the entry says so. */
  rateNeeded: boolean;
  onRates: () => void;
  onPrinter: () => void;
  onLock: () => void;
  onClose: () => void;
}

/** What the round Admin button opens: the owner's jobs at the counter, kept off the selling screen. */
export function AdminMenu({ rateNeeded, onRates, onPrinter, onLock, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ct-backdrop ct-backdrop--corner" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ct-menu" role="dialog" aria-modal="true" aria-label={t.adminMenuTitle}>
        <h2 className="ct-menu__title">{t.adminMenuTitle}</h2>
        <button type="button" className="ct-menu__item" onClick={onRates}>
          {t.todaysRate}
          {rateNeeded && <span className="ct-menu__dot" />}
        </button>
        <button type="button" className="ct-menu__item" onClick={onPrinter}>
          {t.printerSetup}
        </button>
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
