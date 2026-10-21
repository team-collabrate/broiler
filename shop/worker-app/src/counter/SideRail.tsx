import { useOnlineStatus } from "@kumbakonam/shared";
import { t } from "./strings";

interface Props {
  logoUrl: string;
  /** Today's rates are not all set yet: the Admin button shows a dot. */
  rateNeeded: boolean;
  onAdmin: () => void;
}

/**
 * The slim rail down the left edge: the shop logo on top, the connection status, and the round Admin button at
 * the bottom, so none of them take room from the products or cover a card.
 */
export function SideRail({ logoUrl, rateNeeded, onAdmin }: Props) {
  const online = useOnlineStatus();
  return (
    <aside className="ct-rail">
      <img className="ct-rail__logo" src={logoUrl} alt={t.appTitle} draggable={false} />
      <span className={`ct-rail__status${online ? "" : " is-off"}`} role="status">
        {online ? "● ஆன்லைன்" : "⚠ ஆஃப்லைன்"}
      </span>
      <span className="ct-rail__spacer" />
      <button type="button" className="ct-rail__admin" aria-label={t.admin} onClick={onAdmin}>
        {t.adminShort}
        {rateNeeded && <span className="ct-rail__dot" />}
      </button>
    </aside>
  );
}
