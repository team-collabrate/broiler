import { formatMoney, rejectedEntries, type Outbox } from "@kumbakonam/shared/core";
import { t } from "./strings";

interface Props {
  outbox: Outbox;
  /** The oldest waiting bill has been waiting a day or more. */
  stale: boolean;
  /** The refused bill has been seen: clear its warning. */
  onDismiss: (orderId: string) => void;
}

/**
 * What staff must know about uploading, kept to the top of the catalog: that bills have been waiting too long, and the name of any bill the server refused (these stay until someone has
 * seen them, because a refused bill is a sale that is not in the books).
 */
export function SyncBanner({ outbox, stale, onDismiss }: Props) {
  const refused = rejectedEntries(outbox);
  // Going offline is shown by the online light alone; this strip is only for bills that need attention.
  if (!stale && refused.length === 0) return null;
  return (
    <div className="ct-sync">
      {stale && <p className="ct-sync__note ct-sync__note--warn">{t.staleWarning}</p>}
      {refused.map((entry) => (
        <div key={entry.orderId} className="ct-sync__refused" role="alert">
          <div>
            <strong>{t.refusedTitle(entry.label)}</strong>
            <span>{t.refusedDetail(formatMoney(entry.totalMinor), entry.summary, entry.reason ?? "")}</span>
          </div>
          <button type="button" className="ct-btn ct-btn--plain" onClick={() => onDismiss(entry.orderId)}>
            {t.refusedSeen}
          </button>
        </div>
      ))}
    </div>
  );
}
