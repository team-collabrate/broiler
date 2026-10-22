import { useEffect, useState } from "react";
import { renderReceiptCanvas } from "../printing/receiptCanvas";
import type { BillInput } from "../printing/receipt";
import type { PrinterProblem } from "../hooks/usePrinter";
import { t } from "./strings";

interface Props {
  bill: BillInput;
  /** Why the bill is on the screen after a sale: what stopped it printing. Null when an earlier bill is being looked at. */
  problem: PrinterProblem | null;
  printing: boolean;
  /** Prints this bill. */
  onPrint: () => void;
  onPrinterSetup: () => void;
  onClose: () => void;
}

/**
 * A bill on the screen: shown after a sale that could not be printed (with the reason, and a button to print again),
 * or when an earlier bill is opened from the recent list to be printed as a copy. It draws the very same picture the
 * printer gets, so the screen and the paper cannot differ.
 */
export function BillSheet({ bill, problem, printing, onPrint, onPrinterSetup, onClose }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    renderReceiptCanvas(bill)
      .then((canvas) => {
        if (!cancelled) setImageUrl(canvas.toDataURL("image/png"));
      })
      .catch((err) => console.error("Receipt rendering failed", err));
    return () => {
      cancelled = true;
    };
  }, [bill]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The printer screen helps when no printer is chosen or the chosen one does not answer. Bluetooth being off or refused
  // is fixed in the tablet's own settings, which the message says.
  const setupHelps = problem === "no-printer" || problem === "unreachable";

  return (
    <div className="ct-backdrop" role="presentation">
      <div className="ct-sheet ct-sheet--narrow" role="dialog" aria-modal="true" aria-label={t.billTitle(bill.billNo)}>
        <header className="ct-sheet__header">
          <div className="ct-sheet__heading">
            <h2 className="ct-sheet__title">{t.billTitle(bill.billNo)}</h2>
          </div>
          <button type="button" className="ct-sheet__close" aria-label={t.dismiss} onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="ct-sheet__body">
          {problem ? (
            <div className="ct-notice ct-notice--error" role="alert">
              <span>
                {!bill.isCopy && (
                  <>
                    <strong>{t.billNotPrinted}</strong>
                    <br />
                  </>
                )}
                {t.printProblem[problem]}
              </span>
            </div>
          ) : (
            bill.isCopy && <p className="ct-hint">{t.billCopyNote}</p>
          )}

          <div className="ct-bill">
            {imageUrl ? <img className="ct-bill__image" src={imageUrl} alt="" /> : <p className="ct-list__status">{t.billRendering}</p>}
          </div>
        </div>

        <footer className="ct-sheet__actions">
          {problem && setupHelps && (
            <button type="button" className="ct-btn ct-btn--plain" onClick={onPrinterSetup}>
              {t.printerTitle}
            </button>
          )}
          <button type="button" className="ct-btn ct-btn--plain" onClick={onClose}>
            {problem ? t.closeNext : t.dismiss}
          </button>
          <button type="button" className="ct-btn ct-btn--primary" disabled={printing} onClick={onPrint}>
            {printing ? t.printing : t.printAgain}
          </button>
        </footer>
      </div>
    </div>
  );
}
