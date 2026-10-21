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
  onAdmin: () => void;
}

/**
 * The slim rail down the left edge: the shop logo on top, the connection status with the number of bills still to
 * upload, and the round Admin button at the bottom, so none of them take room from the products or cover a card.
 */
export function SideRail({ logoUrl, rateNeeded, connected, waiting, stale, onAdmin }: Props) {
  return (
    <aside className="ct-rail">
      <img className="ct-rail__logo" src={logoUrl} alt={t.appTitle} draggable={false} />
      <span className={`ct-rail__status${connected ? "" : " is-off"}`} role="status">
        {connected ? t.online : t.offline}
      </span>
      {waiting > 0 && (
        <span className={`ct-rail__waiting${stale ? " is-stale" : ""}`} role="status" aria-label={t.waitingBills(waiting)}>
          <b>{waiting}</b>
          <small>{t.waitingShort}</small>
        </span>
      )}
      <span className="ct-rail__spacer" />
      <button type="button" className="ct-rail__admin" aria-label={t.admin} onClick={onAdmin}>
        {t.adminShort}
        {rateNeeded && <span className="ct-rail__dot" />}
      </button>
    </aside>
  );
}
