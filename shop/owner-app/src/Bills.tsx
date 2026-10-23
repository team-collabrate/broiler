import { useState } from "react";
import { daysInclusive, dayKey, describeLine, firstKeptDay, formatRate, isVoided, summarizeOrders, type Order } from "@kumbakonam/shared/core";
import { voidOrder } from "@kumbakonam/shared/shop";
import type { OwnerData } from "./data";
import { billNo, dayText, errorText, formatMoney, paymentText, soldTime, timeText } from "./fmt";
import { Notice, Sheet } from "./ui";

/** The bills of the last 4 days, a day at a time. Tap one for its lines; a bill can be deleted from there. */
export function Bills({ data }: { data: OwnerData }) {
  const today = dayKey(data.now);
  const days = daysInclusive(firstKeptDay(data.now), today).reverse();
  const [day, setDay] = useState(today);
  const [openId, setOpenId] = useState<string | null>(null);

  const bills = data.orders.filter((o) => o.dayKey === day);
  const summary = summarizeOrders(bills);
  const deletedCount = bills.filter(isVoided).length;
  const open = openId === null ? null : (data.orders.find((o) => o.id === openId) ?? null);

  return (
    <div className="ow-stack">
      <div className="ow-chips" role="tablist" aria-label="நாள்">
        {days.map((d) => (
          <button key={d} type="button" role="tab" aria-selected={day === d} className={`ow-chip${day === d ? " is-active" : ""}`} onClick={() => setDay(d)}>
            {d === today ? "இன்று" : dayText(d)}
          </button>
        ))}
      </div>

      <section className="ow-card ow-summary" aria-label="நாள் மொத்தம்">
        <div>
          <p className="ow-label">{dayText(day)}</p>
          <p className="ow-summary__total">{formatMoney(summary.totalMinor)}</p>
        </div>
        <p className="ow-summary__count">
          {summary.orderCount} பில்
          {deletedCount > 0 && <span className="ow-summary__deleted"> · {deletedCount} நீக்கியது</span>}
        </p>
      </section>

      {bills.length === 0 ? (
        <p className="ow-empty">இந்த நாளில் பில் இல்லை.</p>
      ) : (
        <ul className="ow-bills">
          {bills.map((order) => (
            <li key={order.id}>
              <button type="button" className={`ow-bill${isVoided(order) ? " is-deleted" : ""}`} onClick={() => setOpenId(order.id)}>
                <span className="ow-bill__main">
                  <strong className="ow-bill__no">{billNo(order)}</strong>
                  <span className="ow-bill__meta">
                    {timeText(soldTime(order))} · {paymentText(order)}
                    {order.paymentMethod === "credit" && order.customerName ? ` (${order.customerName})` : ""}
                  </span>
                </span>
                <span className="ow-bill__right">
                  <strong className="ow-bill__total">{formatMoney(order.totalMinor)}</strong>
                  {isVoided(order) && <span className="ow-bill__tag">நீக்கியது</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && <BillSheet order={open} onClose={() => setOpenId(null)} onDeleted={data.refresh} />}
    </div>
  );
}

/** One bill in full, with the delete button (and its confirmation). */
function BillSheet({ order, onClose, onDeleted }: { order: Order; onClose: () => void; onDeleted: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleted = isVoided(order);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await voidOrder(order.id);
      await onDeleted();
      onClose();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={confirming ? `பில் ${billNo(order)} நீக்கவா?` : `பில் ${billNo(order)}`}
      subtitle={`${dayText(order.dayKey)} · ${timeText(soldTime(order))}`}
      onClose={onClose}
      busy={busy}
      footer={
        confirming ? (
          <>
            <button type="button" className="ow-btn" disabled={busy} onClick={() => setConfirming(false)}>
              வேண்டாம்
            </button>
            <button type="button" className="ow-btn ow-btn--danger" disabled={busy} onClick={() => void remove()}>
              {busy ? "நீக்குகிறது…" : "பில்லை நீக்கு"}
            </button>
          </>
        ) : deleted ? (
          <button type="button" className="ow-btn" onClick={onClose}>
            மூடு
          </button>
        ) : (
          <>
            <button type="button" className="ow-btn" onClick={onClose}>
              மூடு
            </button>
            <button type="button" className="ow-btn ow-btn--danger-outline" onClick={() => setConfirming(true)}>
              பில்லை நீக்கு
            </button>
          </>
        )
      }
    >
      {confirming ? (
        <div className="ow-stack">
          <p className="ow-text">
            இந்த பில் ({formatMoney(order.totalMinor)}, {paymentText(order)}) எந்த கணக்கிலும் சேராது. பட்டியலில் "நீக்கியது" என்று இருக்கும். மீண்டும் சரிசெய்ய முடியாது.
          </p>
          {order.paymentMethod === "credit" && <p className="ow-text">இது கடன் பில்: {order.customerName ?? "வாடிக்கையாளர்"} கடன் {formatMoney(order.totalMinor)} குறையும்.</p>}
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      ) : (
        <div className="ow-stack">
          {deleted && <Notice tone="warn">நீக்கியது{order.voidedAt ? ` (${timeText(order.voidedAt)})` : ""}. இந்த பில் எந்த கணக்கிலும் சேராது.</Notice>}
          <ul className="ow-lines">
            {order.lines.map((line, i) => (
              <li key={`${line.itemId}-${i}`} className="ow-line">
                <span className="ow-line__main">
                  <strong className="ow-line__name">{line.name}</strong>
                  <span className="ow-line__detail">{describeLine(line, "ta")}</span>
                  {line.rateMinor !== line.listRateMinor && <span className="ow-line__detail">வழக்கமான விலை {formatRate(line.listRateMinor, line.unit, "ta")}</span>}
                </span>
                <strong className="ow-line__amount">{formatMoney(line.lineTotalMinor)}</strong>
              </li>
            ))}
          </ul>
          <dl className="ow-rows">
            {order.discountMinor !== undefined && (
              <div className="ow-row">
                <dt>தள்ளுபடி</dt>
                <dd>-{formatMoney(order.discountMinor)}</dd>
              </div>
            )}
            {order.roundOffMinor !== undefined && (
              <div className="ow-row">
                <dt>ரவுண்ட் ஆஃப்</dt>
                <dd>
                  {order.roundOffMinor > 0 ? "+" : "-"}
                  {formatMoney(Math.abs(order.roundOffMinor))}
                </dd>
              </div>
            )}
            <div className="ow-row ow-row--total">
              <dt>மொத்தம்</dt>
              <dd>{formatMoney(order.totalMinor)}</dd>
            </div>
            <div className="ow-row">
              <dt>பணம் தந்த விதம்</dt>
              <dd>{paymentText(order)}</dd>
            </div>
            {order.paymentMethod === "split" && (
              <>
                <div className="ow-row">
                  <dt>பணம்</dt>
                  <dd>{formatMoney(order.cashAmountMinor ?? 0)}</dd>
                </div>
                <div className="ow-row">
                  <dt>GPay / UPI</dt>
                  <dd>{formatMoney(order.upiAmountMinor ?? 0)}</dd>
                </div>
              </>
            )}
            {order.paymentMethod === "credit" && (
              <div className="ow-row">
                <dt>வாடிக்கையாளர்</dt>
                <dd>{order.customerName ?? "—"}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </Sheet>
  );
}
