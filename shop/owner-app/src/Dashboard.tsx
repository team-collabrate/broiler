import { dayKey, monthStartKey, weekStartKey } from "@kumbakonam/shared/core";
import { figuresForRange, type OwnerData } from "./data";
import { dayText, formatMoney, kgText, pcsText } from "./fmt";
import { Notice } from "./ui";

/** Today at a glance: kilos sold and the amount, how it was paid, this week and month, and what is owed. */
export function Dashboard({ data, onOpenCredit }: { data: OwnerData; onOpenCredit: () => void }) {
  const today = dayKey(data.now);
  const todayFigures = figuresForRange(data.orders, data.dayTotals, { fromKey: today, toKey: today });
  const week = figuresForRange(data.orders, data.dayTotals, { fromKey: weekStartKey(data.now), toKey: today });
  const month = figuresForRange(data.orders, data.dayTotals, { fromKey: monthStartKey(data.now), toKey: today });
  const owed = data.customers.reduce((sum, c) => sum + c.balanceMinor, 0);

  return (
    <div className="ow-stack">
      {data.ratesMissing > 0 && (
        <Notice tone="warn">
          Today's rate is not set for {data.ratesMissing} {data.ratesMissing === 1 ? "item" : "items"}. Set it at the counter: gear button, then Today's rate.
        </Notice>
      )}

      <section className="ow-card ow-hero" aria-label="Sold today">
        <p className="ow-label">Sold today · {dayText(today)}</p>
        <p className="ow-hero__kg">{kgText(todayFigures.totalGrams)}</p>
        <p className="ow-hero__total">{formatMoney(todayFigures.totalMinor)}</p>
        {todayFigures.totalPieces > 0 && <p className="ow-hero__sub">and {pcsText(todayFigures.totalPieces)}</p>}
      </section>

      <section className="ow-card" aria-label="How it was paid today">
        <h2 className="ow-card__title">Money today</h2>
        <dl className="ow-rows">
          <div className="ow-row">
            <dt>Cash</dt>
            <dd>{formatMoney(todayFigures.cashCollectedMinor)}</dd>
          </div>
          <div className="ow-row">
            <dt>GPay / UPI</dt>
            <dd>{formatMoney(todayFigures.upiCollectedMinor)}</dd>
          </div>
          <div className="ow-row">
            <dt>Credit given</dt>
            <dd className={todayFigures.creditGivenMinor > 0 ? "is-credit" : ""}>{formatMoney(todayFigures.creditGivenMinor)}</dd>
          </div>
        </dl>
      </section>

      <div className="ow-pair">
        <section className="ow-card ow-tile" aria-label="This week">
          <p className="ow-label">This week</p>
          <p className="ow-tile__value">{formatMoney(week.totalMinor)}</p>
          <p className="ow-tile__sub">{kgText(week.totalGrams)}</p>
        </section>
        <section className="ow-card ow-tile" aria-label="This month">
          <p className="ow-label">This month</p>
          <p className="ow-tile__value">{formatMoney(month.totalMinor)}</p>
          <p className="ow-tile__sub">{kgText(month.totalGrams)}</p>
        </section>
      </div>

      <button type="button" className="ow-card ow-owed" onClick={onOpenCredit}>
        <span className="ow-owed__text">
          <span className="ow-label">Owed to you</span>
          <span className="ow-owed__caption">
            {data.customers.length === 0 ? "Nobody owes anything" : `From ${data.customers.length} ${data.customers.length === 1 ? "customer" : "customers"}. Tap to open the credit book`}
          </span>
        </span>
        <span className={`ow-owed__value${owed > 0 ? " is-credit" : ""}`}>{formatMoney(owed)}</span>
      </button>
    </div>
  );
}
