import { useEffect, useState } from "react";
import { describeError, formatMoney, PAYMENT_LABELS, splitPayment, type OrderLineInput, type PaymentMethod, type RecentEntry } from "@kumbakonam/shared/core";
import type { BillInput } from "../printing/receipt";
import { CreditModal } from "./CreditModal";
import { SplitModal } from "./SplitModal";
import { t } from "./strings";

interface Props {
  bills: RecentEntry<BillInput>[];
  /** Bills already deleted from this tablet: shown marked, never offered again. */
  deleted: ReadonlySet<string>;
  /** Bills still waiting to upload: the server does not have them yet, so they cannot be deleted. */
  waiting: ReadonlySet<string>;
  connected: boolean;
  /** Opens a bill to be printed again. */
  onOpen: (bill: BillInput) => void;
  /** Deletes a bill. Rejects with the reason to show. */
  onDelete: (orderId: string) => Promise<void>;
  /** Bills the payment of which can be changed in place: deletes the bill and bills the same items again. Rejects with the reason to show. */
  onReplace: (bill: BillInput, method: PaymentMethod, upiMinor: number, customerName?: string) => Promise<void>;
  /** The screen is empty, so a bill can be put back on it to be fixed. */
  canFix: boolean;
  /** Puts the items of a deleted bill back on the screen. */
  onFix: (lines: OrderLineInput[]) => void;
  onClose: () => void;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const clock = (d: Date) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** How many of the newest bills the till offers to delete, and for how long (the rules allow 24 hours). */
const DELETABLE_BILLS = 3;
const DELETABLE_MS = 24 * 60 * 60 * 1000;

/**
 * The last bills printed on this tablet, newest first, so one can be printed again as a copy. The newest 3 live
 * bills made in the last 24 hours also have a Delete button: a mis-billed sale is deleted here (it stays on the
 * owner's list marked deleted and leaves every total). Anything older is for the owner.
 */
export function RecentBillsSheet({ bills, deleted, waiting, connected, onOpen, onDelete, canFix, onFix, onReplace, onClose }: Props) {
  const [confirming, setConfirming] = useState<RecentEntry<BillInput> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fixing, setFixing] = useState(false);
  // Changing how a bill was paid: the bill being changed, the payment chosen, and the GPay half of a split.
  const [paying, setPaying] = useState<{ entry: RecentEntry<BillInput>; method: PaymentMethod; upiMinor: number; customerName: string } | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && !splitOpen && !creditOpen && (paying ? setPaying(null) : confirming ? setConfirming(null) : onClose());
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, confirming, busy, paying, splitOpen, creditOpen]);

  const now = Date.now();
  const deletable = new Set(
    bills
      .filter((b) => !deleted.has(b.id) && now - b.soldAtMs < DELETABLE_MS)
      .slice(0, DELETABLE_BILLS)
      .map((b) => b.id),
  );

  const confirmDelete = async () => {
    if (confirming === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(confirming.id);
      const restore = confirming.payload.restore;
      setConfirming(null);
      if (fixing && restore) onFix(restore);
    } catch (e) {
      setError(t.deleteFailed(describeError(e)));
    } finally {
      setBusy(false);
    }
  };

  /** The payment a bill was made with, from its printed label. */
  const methodOf = (bill: BillInput): PaymentMethod | null => (["cash", "upi", "split", "credit"] as const).find((m) => PAYMENT_LABELS[m] === bill.paymentLabel) ?? null;
  const startFix = (entry: RecentEntry<BillInput>) => {
    setError(null);
    const method = methodOf(entry.payload);
    if (method && entry.payload.fix && entry.payload.restore) {
      setPaying({ entry, method, upiMinor: 0, customerName: entry.payload.customerName ?? "" });
      return;
    }
    // Older bills (made before this was kept): only the items can be changed.
    setFixing(true);
    setConfirming(entry);
  };
  const replace = async () => {
    if (!paying || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onReplace(paying.entry.payload, paying.method, paying.method === "split" ? paying.upiMinor : 0, paying.method === "credit" ? paying.customerName : undefined);
    } catch (e) {
      setError(t.deleteFailed(describeError(e)));
      setBusy(false);
    }
  };
  const payingTotal = paying?.entry.payload.fix?.totalMinor ?? 0;
  const payingSame =
    paying !== null && paying.method === methodOf(paying.entry.payload) && paying.method !== "split" && (paying.method !== "credit" || paying.customerName === (paying.entry.payload.customerName ?? ""));

  return (
    <div className="ct-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="ct-sheet ct-sheet--narrow" role="dialog" aria-modal="true" aria-label={t.recentTitle}>
        <header className="ct-sheet__header">
          <div className="ct-sheet__heading">
            <h2 className="ct-sheet__title">{paying ? t.fixTitle(paying.entry.payload.billNo) : confirming ? (fixing ? t.fixTitle(confirming.payload.billNo) : t.deleteTitle(confirming.payload.billNo)) : t.recentTitle}</h2>
            <span className="ct-sheet__sub ct-sheet__sub--note">{paying ? `${paying.entry.payload.total} · ${paying.entry.payload.paymentLabel}` : confirming ? `${confirming.payload.total} · ${confirming.payload.paymentLabel}` : t.recentSubtitle}</span>
          </div>
          <button type="button" className="ct-sheet__close" aria-label={t.dismiss} disabled={busy} onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="ct-sheet__body">
          {paying ? (
            <div className="ct-confirm">
              <p className="ct-confirm__text">{t.fixPaymentPick}</p>
              <div className="ct-fixpay" role="group" aria-label={t.fixPaymentPick}>
                {(["cash", "upi", "split", "credit"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`ct-btn ct-fixpay__opt${paying.method === m ? " is-on" : ""}`}
                    aria-pressed={paying.method === m}
                    disabled={busy}
                    onClick={() => (m === "split" ? setSplitOpen(true) : m === "credit" ? setCreditOpen(true) : setPaying({ ...paying, method: m, upiMinor: 0 }))}
                  >
                    {PAYMENT_LABELS[m]}
                  </button>
                ))}
              </div>
              {paying.method === "credit" && paying.customerName && (
                <p className="ct-confirm__text">
                  <strong>{t.fixCreditFor(paying.customerName)}</strong>
                </p>
              )}
              {paying.method === "split" && paying.upiMinor > 0 && (
                <p className="ct-confirm__text">
                  <strong>{t.fixSplitSet(formatMoney(splitPayment(payingTotal, paying.upiMinor).cashMinor), formatMoney(paying.upiMinor))}</strong>
                </p>
              )}
              <p className="ct-confirm__text">{t.fixPaymentWarning}</p>
              {!connected && <p className="ct-confirm__text ct-confirm__text--warn">{t.deleteNeedsInternet}</p>}
              {error && (
                <p className="ct-confirm__text ct-confirm__text--error" role="alert">
                  {error}
                </p>
              )}
              <button
                type="button"
                className="ct-btn ct-btn--plain"
                disabled={busy || !canFix}
                onClick={() => {
                  const entry = paying.entry;
                  setPaying(null);
                  setFixing(true);
                  setConfirming(entry);
                }}
              >
                {t.fixItemsInstead}
              </button>
              {!canFix && <p className="ct-list__status">{t.fixNeedsEmpty}</p>}
            </div>
          ) : confirming ? (
            <div className="ct-confirm">
              <p className="ct-confirm__text">{fixing ? t.fixWarning : t.deleteWarning}</p>
              {!connected && <p className="ct-confirm__text ct-confirm__text--warn">{t.deleteNeedsInternet}</p>}
              {error && (
                <p className="ct-confirm__text ct-confirm__text--error" role="alert">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <div className="ct-list" role="list">
              {bills.length === 0 ? (
                <p className="ct-list__status">{t.recentEmpty}</p>
              ) : (
                bills.map(({ id, payload, soldAtMs }) => {
                  const isDeleted = deleted.has(id);
                  return (
                    <div key={id} role="listitem" className={`ct-list__item${isDeleted ? " is-deleted" : ""}`}>
                      <button type="button" className="ct-list__row" disabled={isDeleted} onClick={() => onOpen(payload)}>
                        <span className="ct-list__name">
                          {t.billTitle(payload.billNo)} · {clock(payload.createdAt)} · {payload.paymentLabel}
                        </span>
                        <strong className="ct-list__amount">{payload.total}</strong>
                      </button>
                      {isDeleted ? (
                        <span className="ct-list__tag">{t.billDeleted}</span>
                      ) : deletable.has(id) ? (
                        waiting.has(id) ? (
                          <span className="ct-list__tag">{t.billWaiting}</span>
                        ) : (
                          <>
                            {payload.restore && (canFix || (payload.fix && methodOf(payload))) && (
                              <button type="button" className="ct-list__delete ct-list__fix" onClick={() => startFix({ id, payload, soldAtMs })}>
                                {t.fixBill}
                              </button>
                            )}
                            <button
                              type="button"
                              className="ct-list__delete"
                              onClick={() => {
                                setError(null);
                                setFixing(false);
                                setConfirming({ id, payload, soldAtMs });
                              }}
                            >
                              {t.deleteBill}
                            </button>
                          </>
                        )
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <footer className="ct-sheet__actions">
          {paying ? (
            <>
              <button type="button" className="ct-btn ct-btn--plain" disabled={busy} onClick={() => setPaying(null)}>
                {t.keepBill}
              </button>
              <button
                type="button"
                className="ct-btn ct-btn--primary"
                disabled={busy || !connected || payingSame || (paying.method === "split" && paying.upiMinor <= 0) || (paying.method === "credit" && !paying.customerName)}
                onClick={() => void replace()}
              >
                {busy ? t.deleting : t.fixReplace}
              </button>
            </>
          ) : confirming ? (
            <>
              <button type="button" className="ct-btn ct-btn--plain" disabled={busy} onClick={() => setConfirming(null)}>
                {t.keepBill}
              </button>
              <button type="button" className="ct-btn ct-btn--danger" disabled={busy || !connected} onClick={() => void confirmDelete()}>
                {busy ? t.deleting : fixing ? t.fixConfirm : t.deleteConfirm}
              </button>
            </>
          ) : (
            <>
              {!canFix && <span className="ct-list__status">{t.fixNeedsEmpty}</span>}
              <button type="button" className="ct-btn ct-btn--plain" onClick={onClose}>
                {t.dismiss}
              </button>
            </>
          )}
        </footer>
      </div>
      {creditOpen && paying && (
        <CreditModal
          totalMinor={payingTotal}
          current={paying.customerName || null}
          onCancel={() => setCreditOpen(false)}
          onChoose={(name) => {
            setPaying({ ...paying, method: "credit", upiMinor: 0, customerName: name });
            setCreditOpen(false);
          }}
        />
      )}

      {splitOpen && paying && (
        <SplitModal
          totalMinor={payingTotal}
          upiMinor={paying.upiMinor}
          onCancel={() => setSplitOpen(false)}
          onDone={(upiMinor) => {
            setPaying({ ...paying, method: "split", upiMinor });
            setSplitOpen(false);
          }}
        />
      )}
    </div>
  );
}
