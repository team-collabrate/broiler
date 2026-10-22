import { useState } from "react";
import {
  applyRateKey,
  CURRENCY_SYMBOL,
  dayKey,
  describeError,
  formatRateInput,
  itemName,
  parseRateInput,
  type MenuItem,
} from "@kumbakonam/shared/core";
import { setMenuRates } from "@kumbakonam/shared/shop";
import { categoryLabel, unitSuffix } from "./fmt";
import { Keypad } from "./Keypad";
import { t } from "./strings";

/** True when this item's rate hasn't been set (or confirmed) today. */
export function isRateStale(item: MenuItem, now: Date = new Date()): boolean {
  return item.rateUpdatedAt === null || dayKey(item.rateUpdatedAt) !== dayKey(now);
}

function hint(item: MenuItem): string {
  if (item.rateUpdatedAt === null) return t.rateNever;
  return isRateStale(item) ? t.rateNotToday : t.rateToday;
}

interface Props {
  items: MenuItem[];
  /** Leave the rates view (after saving, or on Back). */
  onClose: () => void;
}

/**
 * Today's rate for each item (per kg, or per piece for items sold by count), grouped by category and shown on the
 * page in place of the products. Pick an item, type its rate on the keypad. Saving confirms every rate shown, so
 * "same as yesterday" is one tap. Only the owner can save (the rules check it).
 */
export function RatesView({ items, onClose }: Props) {
  const [texts, setTexts] = useState<Record<string, string>>(() => Object.fromEntries(items.map((i) => [i.id, formatRateInput(i.rateMinor)])));
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
  // The first key after picking an item replaces its rate, like selecting the whole field.
  const [fresh, setFresh] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = items.map((item) => ({ item, minor: parseRateInput(texts[item.id] ?? "") }));
  const allValid = parsed.length > 0 && parsed.every((p) => p.minor !== null);

  const press = (key: string) => {
    if (activeId === null) return;
    setTexts((prev) => ({ ...prev, [activeId]: applyRateKey(fresh ? "" : (prev[activeId] ?? ""), key) }));
    setFresh(false);
  };

  const save = async () => {
    if (!allValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await setMenuRates(parsed.map((p) => ({ id: p.item.id, rateMinor: p.minor as number })));
      onClose();
    } catch (e) {
      setError(describeError(e));
      setSaving(false);
    }
  };

  const today = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="ct-rates">
      <header className="ct-rates__header">
        <h2>{t.todaysRate}</h2>
        <span>{t.ratesSubtitle(today)}</span>
      </header>

      <div className="ct-rates__body">
        <div className="ct-rates__list">
          {parsed.map(({ item, minor }, index) => {
            const active = item.id === activeId;
            const newGroup = index === 0 || parsed[index - 1].item.category !== item.category;
            return (
              <div key={item.id}>
                {newGroup && <h3 className="ct-rates__group">{categoryLabel(item.category)}</h3>}
                <button
                  type="button"
                  className={`ct-rate-row${active ? " is-on" : ""}${minor === null ? " is-bad" : ""}`}
                  aria-pressed={active}
                  disabled={saving}
                  onClick={() => {
                    setActiveId(item.id);
                    setFresh(true);
                  }}
                >
                  <span className="ct-rate-row__info">
                    <strong>{itemName(item)}</strong>
                    <small className={isRateStale(item) ? "is-stale" : "is-ok"}>{hint(item)}</small>
                  </span>
                  <span className="ct-rate-row__value">
                    {CURRENCY_SYMBOL}
                    {texts[item.id] || "–"}
                    <small>{unitSuffix(item.unit)}</small>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="ct-rates__keys">
          <Keypad leftKey="." onKey={press} tall />
        </div>
      </div>

      {error && (
        <p className="ct-notice ct-notice--error" role="alert">
          {t.ratesError(error)}
        </p>
      )}

      <footer className="ct-rates__actions">
        <button type="button" className="ct-btn ct-btn--plain" disabled={saving} onClick={onClose}>
          {t.back}
        </button>
        <button type="button" className="ct-btn ct-btn--primary" disabled={!allValid || saving} onClick={save}>
          {saving ? t.saving : error ? t.retrySave : t.saveRates}
        </button>
      </footer>
    </div>
  );
}
