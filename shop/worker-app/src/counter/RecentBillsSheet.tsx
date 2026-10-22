import { useEffect } from "react";
import type { RecentEntry } from "@kumbakonam/shared/core";
import type { BillInput } from "../printing/receipt";
import { t } from "./strings";

interface Props {
  bills: RecentEntry<BillInput>[];
  /** Opens a bill to be printed again. */
  onOpen: (bill: BillInput) => void;
  onClose: () => void;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const clock = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** The last bills printed on this tablet, newest first, so one can be printed again as a copy. */
export function RecentBillsSheet({ bills, onOpen, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ct-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ct-sheet ct-sheet--narrow" role="dialog" aria-modal="true" aria-label={t.recentTitle}>
        <header className="ct-sheet__header">
          <div className="ct-sheet__heading">
            <h2 className="ct-sheet__title">{t.recentTitle}</h2>
            <span className="ct-sheet__sub ct-sheet__sub--note">{t.recentSubtitle}</span>
          </div>
          <button type="button" className="ct-sheet__close" aria-label={t.dismiss} onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="ct-sheet__body">
          <div className="ct-list" role="list">
            {bills.length === 0 ? (
              <p className="ct-list__status">{t.recentEmpty}</p>
            ) : (
              bills.map(({ id, payload }) => (
                <button key={id} type="button" role="listitem" className="ct-list__row" onClick={() => onOpen(payload)}>
                  <span className="ct-list__name">
                    {t.billTitle(payload.billNo)} · {clock(payload.createdAt)} · {payload.paymentLabel}
                  </span>
                  <strong className="ct-list__amount">{payload.total}</strong>
                </button>
              ))
            )}
          </div>
        </div>

        <footer className="ct-sheet__actions">
          <button type="button" className="ct-btn ct-btn--plain" onClick={onClose}>
            {t.dismiss}
          </button>
        </footer>
      </div>
    </div>
  );
}
