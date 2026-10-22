import { useCallback, useEffect, useMemo, useState } from "react";
import { categoryLabel, isRateStale, itemName, type MenuItem } from "@kumbakonam/shared/core";
import { getMenuItems, setMenuRates } from "@kumbakonam/shared/shop";
import type { OwnerData } from "./data";
import { errorText, paiseToRupees, rupeesToPaise } from "./fmt";
import { Notice } from "./ui";

/** Today's rates: one row per item, the rate in rupees, and one Save that confirms them all for today. */
export function Rates({ data }: { data: OwnerData }) {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await getMenuItems();
      setItems(list);
      setTexts(Object.fromEntries(list.map((i) => [i.id, paiseToRupees(i.rateMinor)])));
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const out: { key: string; items: MenuItem[] }[] = [];
    for (const item of items ?? []) {
      const group = out.find((g) => g.key === item.category);
      if (group) group.items.push(item);
      else out.push({ key: item.category, items: [item] });
    }
    return out;
  }, [items]);

  const parsed = (id: string) => rupeesToPaise(texts[id] ?? "");
  const allValid = (items ?? []).length > 0 && (items ?? []).every((i) => (parsed(i.id) ?? 0) > 0);
  const changed = (items ?? []).filter((i) => parsed(i.id) !== i.rateMinor).length;

  const save = async () => {
    if (busy || !items || !allValid) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await setMenuRates(items.map((i) => ({ id: i.id, rateMinor: parsed(i.id) as number })));
      setSaved(true);
      await load();
      await data.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (items === null) return <p className="ow-empty">{error ?? "ஏற்றுகிறது…"}</p>;

  return (
    <div className="ow-stack ow-rates">
      <p className="ow-text ow-text--muted">ஒவ்வொரு பொருளுக்கும் இன்றைய விலையைப் போட்டு "சேமி" அழுத்தவும். மாற்றாத விலைகளும் இன்றைக்கு உறுதி ஆகும்.</p>
      {error && <Notice tone="error">{error}</Notice>}
      {saved && <Notice tone="info">சேமித்தது ✓ இன்றைய விலை போடப்பட்டது. கவுண்டரில் உடனே தெரியும்.</Notice>}

      {groups.map((group) => (
        <section key={group.key} className="ow-card" aria-label={categoryLabel(group.key, undefined, "ta")}>
          <h2 className="ow-card__title">{categoryLabel(group.key, undefined, "ta")}</h2>
          <ul className="ow-list">
            {group.items.map((item) => {
              const value = parsed(item.id);
              const stale = isRateStale(item);
              return (
                <li key={item.id} className="ow-list__row ow-rate">
                  <span className="ow-list__main">
                    <strong className="ow-list__name">{itemName(item)}</strong>
                    <span className={`ow-list__sub${stale && value === item.rateMinor ? " is-warn" : ""}`}>
                      {item.unit === "kg" ? "ஒரு கிலோ" : "ஒரு எண்"} · {stale ? "இன்று போடவில்லை" : "இன்று போட்டாச்சு ✓"}
                    </span>
                  </span>
                  <label className="ow-rate__field">
                    <span aria-hidden="true">₹</span>
                    <input
                      className={`ow-input ow-rate__input${value === null || value <= 0 ? " is-bad" : ""}`}
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={`${itemName(item)} விலை ரூபாயில்`}
                      value={texts[item.id] ?? ""}
                      onChange={(e) => {
                        setTexts((s) => ({ ...s, [item.id]: e.target.value }));
                        setSaved(false);
                      }}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="ow-savebar">
        <button type="button" className="ow-btn ow-btn--primary ow-btn--wide" disabled={busy || !allValid} onClick={() => void save()}>
          {busy ? "சேமிக்கிறது…" : changed > 0 ? `இன்றைய விலை சேமி (${changed} மாற்றம்)` : "இன்றைய விலை சேமி"}
        </button>
      </div>
    </div>
  );
}
