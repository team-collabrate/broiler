import { useEffect, useState } from "react";
import { t } from "./strings";

interface Props {
  logoUrl: string;
  /** Today's rates are not all set yet: the Admin button shows a dot. */
  rateNeeded: boolean;
  /** The server can be reached right now (not just "the tablet has a network"). */
  connected: boolean;
  /** Bills saved on this tablet that the server has not confirmed yet. */
  waiting: number;
  /** The oldest waiting bill has been waiting a day or more. */
  stale: boolean;
  /** The printer: working as far as is known, none chosen yet, or the last print failed. */
  printer: "ok" | "none" | "problem";
  /** Opens the printer screen. */
  onPrinter: () => void;
  /** Opens the list of recent bills (print a copy, or delete one of the last 3). */
  onRecent: () => void;
  /** Goes to the admin app. */
  onAdmin: () => void;
}

const clockText = () => new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

/**
 * The slim bar across the top of the counter. The app fills the whole screen (Android's own status bar is hidden), so
 * this carries what the cashier needs to glance at: the shop, online or offline, bills still to upload, the printer,
 * the time, and the gear (Admin).
 */
export function SideRail({ logoUrl, rateNeeded, connected, waiting, stale, printer, onPrinter, onRecent, onAdmin }: Props) {
  const [clock, setClock] = useState(clockText);
  useEffect(() => {
    const timer = setInterval(() => setClock(clockText()), 15_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="ct-top">
      <img className="ct-top__logo" src={logoUrl} alt="" draggable={false} />
      <span className="ct-top__name">HONEY BROILERS</span>
      <span className="ct-top__spacer" />

      {waiting > 0 && (
        <span className={`ct-top__waiting${stale ? " is-stale" : ""}`} role="status" aria-label={t.waitingBills(waiting)}>
          <b>{waiting}</b> {t.waitingShort}
        </span>
      )}
      <span className={`ct-top__pill ${connected ? "is-on" : "is-off"}`} role="status">
        <span className="ct-top__light" aria-hidden="true" />
        {connected ? t.online : t.offline}
      </span>
      <button type="button" className={`ct-top__pill ct-top__printer is-${printer}`} onClick={onPrinter}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        {printer === "ok" ? t.printerOk : printer === "none" ? t.printerNone : t.printerProblem}
        {printer === "ok" && (
          <svg className="ct-top__tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="4 13 10 19 20 6" />
          </svg>
        )}
      </button>
      <button type="button" className="ct-top__pill ct-top__recent" onClick={onRecent}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15.5 14" />
        </svg>
        {t.recentMenu}
      </button>
      <span className="ct-top__clock">{clock}</span>
      <button type="button" className="ct-top__gear" aria-label={t.admin} onClick={onAdmin}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        {rateNeeded && <span className="ct-top__dot" />}
      </button>
    </header>
  );
}
