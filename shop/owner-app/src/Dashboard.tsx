import { dayKey, monthStartKey, weekStartKey } from "@kumbakonam/shared/core";
import { figuresForRange, type OwnerData } from "./data";
import { dayText, formatMoney, kgText, pcsText } from "./fmt";
import { Notice } from "./ui";

/** Today at a glance: kilos sold and the amount, how it was paid, this week and month, and what is owed. */
export function Dashboard({ data, onOpenCredit, onOpenRates }: { data: OwnerData; onOpenCredit: () => void; onOpenRates: () => void }) {
  const today = dayKey(data.now);
  const todayFigures = figuresForRange(data.orders, data.dayTotals, { fromKey: today, toKey: today });
  const week = figuresForRange(data.orders, data.dayTotals, { fromKey: weekStartKey(data.now), toKey: today });
  const month = figuresForRange(data.orders, data.dayTotals, { fromKey: monthStartKey(data.now), toKey: today });
  const owed = data.customers.reduce((sum, c) => sum + c.balanceMinor, 0);

  return (
    <div className="ow-stack ow-dash">
      {data.ratesMissing > 0 && (
        <Notice tone="warn">
          இன்று {data.ratesMissing} பொருளுக்கு விலை போடவில்லை.{" "}
          <button type="button" className="ow-link" onClick={onOpenRates}>
            இன்றைய விலை போடு
          </button>
        </Notice>
      )}

      <section className="ow-card ow-hero" aria-label="இன்றைய விற்பனை">
        <p className="ow-label">இன்றைய விற்பனை · {dayText(today)}</p>
        <p className="ow-hero__kg">{kgText(todayFigures.totalGrams)}</p>
        <p className="ow-hero__total">{formatMoney(todayFigures.totalMinor)}</p>
        {todayFigures.totalPieces > 0 && <p className="ow-hero__sub">மேலும் {pcsText(todayFigures.totalPieces)}</p>}
      </section>

      <section className="ow-card" aria-label="இன்று பணம் வந்த விதம்">
        <h2 className="ow-card__title">இன்றைய பணம்</h2>
        <dl className="ow-rows">
          <div className="ow-row">
            <dt>பணம்</dt>
            <dd>{formatMoney(todayFigures.cashCollectedMinor)}</dd>
          </div>
          <div className="ow-row">
            <dt>GPay / UPI</dt>
            <dd>{formatMoney(todayFigures.upiCollectedMinor)}</dd>
          </div>
          <div className="ow-row">
            <dt>கடன் கொடுத்தது</dt>
            <dd className={todayFigures.creditGivenMinor > 0 ? "is-credit" : ""}>{formatMoney(todayFigures.creditGivenMinor)}</dd>
          </div>
        </dl>
      </section>

      <div className="ow-pair">
        <section className="ow-card ow-tile" aria-label="இந்த வாரம்">
          <p className="ow-label">இந்த வாரம்</p>
          <p className="ow-tile__value">{formatMoney(week.totalMinor)}</p>
          <p className="ow-tile__sub">{kgText(week.totalGrams)}</p>
        </section>
        <section className="ow-card ow-tile" aria-label="இந்த மாதம்">
          <p className="ow-label">இந்த மாதம்</p>
          <p className="ow-tile__value">{formatMoney(month.totalMinor)}</p>
          <p className="ow-tile__sub">{kgText(month.totalGrams)}</p>
        </section>
      </div>

      <button type="button" className="ow-card ow-owed" onClick={onOpenCredit}>
        <span className="ow-owed__text">
          <span className="ow-label">வர வேண்டிய கடன்</span>
          <span className="ow-owed__caption">
            {data.customers.length === 0 ? "யாருக்கும் கடன் இல்லை" : `${data.customers.length} பேரிடம் இருந்து. கடன் பட்டியலைப் பார்க்க தொடவும்`}
          </span>
        </span>
        <span className={`ow-owed__value${owed > 0 ? " is-credit" : ""}`}>{formatMoney(owed)}</span>
      </button>
    </div>
  );
}
