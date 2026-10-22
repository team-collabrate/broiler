import { useEffect } from "react";
import type { PrinterProblem, PrinterStatus } from "../hooks/usePrinter";
import type { ClassicPrinterConnection } from "../printing/classicBluetoothPrinter";
import { usePrinterErrorDetail } from "../printing/lastError";
import { t } from "./strings";

interface Props {
  status: PrinterStatus;
  problem: PrinterProblem | null;
  deviceName: string | null;
  /** "native" (classic Bluetooth, the installed app) or "web" (Bluetooth LE only, a browser). */
  platform: "native" | "web";
  /** Native only: filled once status is "picking". */
  printerDevices: ClassicPrinterConnection[];
  /** The result of the last test print, shown under its button. */
  testOutcome: "ok" | PrinterProblem | null;
  /** A test print is going out. */
  busy: boolean;
  /** Show the speed readout while printing. */
  showSpeed: boolean;
  onShowSpeed: (on: boolean) => void;
  onConnect: () => void;
  onSelectPrinter: (address: string) => void;
  onTestPrint: () => void;
  onCalibration: () => void;
  onClose: () => void;
}

/**
 * Choosing the printer and checking the paper. The printer is remembered, so this is a one-time job (and again only if
 * the printer is replaced): scan, tap the printer, print a test bill. The calibration sheet is for the day a new
 * printer or paper roll goes in.
 */
export function PrinterSheet({
  status,
  problem,
  deviceName,
  platform,
  printerDevices,
  testOutcome,
  busy,
  showSpeed,
  onShowSpeed,
  onConnect,
  onSelectPrinter,
  onTestPrint,
  onCalibration,
  onClose,
}: Props) {
  const detail = usePrinterErrorDetail();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ready = status === "ready";
  const statusText = ready ? (deviceName ? t.printerRemembered(deviceName) : "") : t.printerStatus[status];

  return (
    <div className="ct-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ct-sheet ct-sheet--narrow" role="dialog" aria-modal="true" aria-label={t.printerTitle}>
        <header className="ct-sheet__header">
          <div className="ct-sheet__heading">
            <h2 className="ct-sheet__title">{t.printerTitle}</h2>
          </div>
          <button type="button" className="ct-sheet__close" aria-label={t.dismiss} onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="ct-sheet__body">
          <p className="ct-printer__status">{statusText}</p>

          {problem && (
            <div className="ct-notice ct-notice--error" role="alert">
              <span>{t.printProblem[problem]}</span>
              {detail !== "" && <small className="ct-notice__detail">Details: {detail}</small>}
            </div>
          )}

          {platform === "native" && status === "picking" && (
            <div className="ct-list" role="list">
              {printerDevices.length === 0 ? (
                <p className="ct-list__status">{t.printerEmptyScan}</p>
              ) : (
                printerDevices.map((device) => (
                  <button key={device.address} type="button" role="listitem" className="ct-list__row" onClick={() => onSelectPrinter(device.address)}>
                    <span className="ct-list__name">{device.name}</span>
                  </button>
                ))
              )}
            </div>
          )}

          <button type="button" className="ct-btn ct-btn--plain ct-printer__button" disabled={status === "unsupported" || status === "connecting"} onClick={onConnect}>
            {ready ? t.connectOtherPrinter : t.connectPrinter}
          </button>
          {!ready && status !== "picking" && platform === "native" && <p className="ct-hint">{t.printerPairHint}</p>}
          {platform === "web" && <p className="ct-hint">{t.printerWebNote}</p>}

          {ready && (
            <>
              <button type="button" className="ct-btn ct-btn--plain ct-printer__button" disabled={busy} onClick={onTestPrint}>
                {busy ? t.printing : t.testBill}
              </button>
              <button type="button" className="ct-btn ct-btn--plain ct-printer__button" disabled={busy} onClick={onCalibration}>
                {t.calibrationBill}
              </button>
              {testOutcome && (
                <p className={testOutcome === "ok" ? "ct-khata__note" : "ct-field__error"} role="status">
                  {testOutcome === "ok" ? t.testPrinted : t.printProblem[testOutcome]}
                </p>
              )}
            </>
          )}

          <label className="ct-printer__toggle">
            <input type="checkbox" checked={showSpeed} onChange={(e) => onShowSpeed(e.target.checked)} />
            <span>{t.showPrintSpeed}</span>
          </label>
        </div>

        <footer className="ct-sheet__actions">
          <button type="button" className="ct-btn ct-btn--primary" onClick={onClose}>
            {t.done}
          </button>
        </footer>
      </div>
    </div>
  );
}
