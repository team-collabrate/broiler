import { refreshApp } from "../updates";
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
  onConnect: () => void;
  onSelectPrinter: (address: string) => void;
  onTestPrint: () => void;
  onClose: () => void;
}

const PrinterGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

/**
 * The printer panel. A status card says at a glance where things stand (a green tick when the printer is connected,
 * amber when none is chosen, red when the last print failed), one big button does the next thing, and the rest
 * (test bill, change printer) waits underneath. The printer is remembered, so choosing it is a one-time job.
 */
export function PrinterSheet({ status, problem, deviceName, platform, printerDevices, testOutcome, busy, onConnect, onSelectPrinter, onTestPrint, onClose }: Props) {
  const detail = usePrinterErrorDetail();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ready = status === "ready";
  const working = status === "connecting" || status === "checking";
  const tone = problem ? "bad" : ready ? "good" : working ? "wait" : "none";

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
          <section className={`ct-pstat ct-pstat--${tone}`} role="status" aria-live="polite">
            <span className="ct-pstat__badge" aria-hidden="true">
              {tone === "good" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="5 13 10 18 19 7" />
                </svg>
              ) : tone === "bad" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="14" />
                  <line x1="12" y1="19" x2="12" y2="19.2" />
                </svg>
              ) : (
                <PrinterGlyph />
              )}
            </span>
            <span className="ct-pstat__text">
              <strong className="ct-pstat__title">
                {tone === "good" ? t.printerConnected : tone === "bad" ? t.printerProblem : working ? t.printerStatus.connecting : t.printerNone}
              </strong>
              <span className="ct-pstat__sub">
                {tone === "good" ? (deviceName ? `${deviceName} · ${t.printerReady}` : t.printerReady) : problem ? t.printProblem[problem] : tone === "none" && status !== "ready" ? t.printerStatus[status] : ""}
              </span>
              {problem && detail !== "" && <small className="ct-pstat__detail">Details: {detail}</small>}
            </span>
          </section>

          {platform === "native" && status === "picking" && (
            <div className="ct-pdevices">
              <h3 className="ct-pdevices__title">{t.chooseYourPrinter}</h3>
              {printerDevices.length === 0 ? (
                <p className="ct-list__status">{t.printerEmptyScan}</p>
              ) : (
                printerDevices.map((device) => (
                  <button key={device.address} type="button" className="ct-pdevice" onClick={() => onSelectPrinter(device.address)}>
                    <span className="ct-pdevice__icon">
                      <PrinterGlyph />
                    </span>
                    <span className="ct-pdevice__name">{device.name}</span>
                    <span className="ct-pdevice__go" aria-hidden="true">
                      ›
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {ready ? (
            <>
              <button type="button" className="ct-btn ct-btn--primary ct-btn--big" disabled={busy} onClick={onTestPrint}>
                {busy ? t.printing : t.testBill}
              </button>
              {testOutcome && (
                <p className={testOutcome === "ok" ? "ct-khata__note" : "ct-field__error"} role="status">
                  {testOutcome === "ok" ? `✓ ${t.testPrinted}` : t.printProblem[testOutcome]}
                </p>
              )}
              <div className="ct-prow">
                <button type="button" className="ct-btn ct-btn--plain" disabled={busy} onClick={onConnect}>
                  {t.changePrinter}
                </button>
              </div>
            </>
          ) : (
            status !== "picking" && (
              <>
                <button type="button" className="ct-btn ct-btn--primary ct-btn--big" disabled={status === "unsupported" || working} onClick={onConnect}>
                  {working ? t.printerStatus.connecting : t.connectPrinter}
                </button>
                {platform === "native" && (
                  <ol className="ct-psteps">
                    <li>{t.printerStep1}</li>
                    <li>{t.printerStep2}</li>
                    <li>{t.printerStep3}</li>
                  </ol>
                )}
              </>
            )
          )}
          {status === "picking" && (
            <button type="button" className="ct-btn ct-btn--plain ct-btn--big" onClick={onConnect}>
              {t.searchAgain}
            </button>
          )}
          {platform === "web" && <p className="ct-hint">{t.printerWebNote}</p>}
          <p className="ct-hint ct-version">App version {__APP_BUILD__}</p>
          <button type="button" className="ct-btn ct-btn--plain ct-version__update" onClick={() => void refreshApp()}>
            {t.updateAppNow}
          </button>
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
