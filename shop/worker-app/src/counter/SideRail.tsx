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
  onAdmin: () => void;
}

/**
 * The slim rail down the left edge: the shop logo on top, the connection status with the number of bills still to
 * upload, and the round gear (Admin) button at the bottom, so none of them take room from the products or cover a card.
 */
export function SideRail({ logoUrl, rateNeeded, connected, waiting, stale, printer, onPrinter, onAdmin }: Props) {
  return (
    <aside className="ct-rail">
      <img className="ct-rail__logo" src={logoUrl} alt={t.appTitle} draggable={false} />
      <span className={`ct-rail__status${connected ? " is-on" : " is-off"}`} role="status">
        <span className="ct-rail__light" aria-hidden="true" />
        {connected ? t.online : t.offline}
      </span>
      {waiting > 0 && (
        <span className={`ct-rail__waiting${stale ? " is-stale" : ""}`} role="status" aria-label={t.waitingBills(waiting)}>
          <b>{waiting}</b>
          <small>{t.waitingShort}</small>
        </span>
      )}
      <button type="button" className={`ct-rail__printer is-${printer}`} onClick={onPrinter}>
        <svg className="ct-rail__printer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        <span>{printer === "ok" ? t.printerOk : printer === "none" ? t.printerNone : t.printerProblem}</span>
      </button>
      <span className="ct-rail__spacer" />
      <button type="button" className="ct-rail__admin" aria-label={t.admin} onClick={onAdmin}>
        <svg className="ct-rail__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        {rateNeeded && <span className="ct-rail__dot" />}
      </button>
    </aside>
  );
}
