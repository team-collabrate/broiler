import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CURRENCY_SYMBOL,
  formatMoney,
  gramsForAmount,
  itemName,
  lineTotalMinor,
  VARIANT_LABELS,
  type MenuItem,
  type Method,
  type OrderLineInput,
} from "@kumbakonam/shared/core";
import { formatWeight, unitSuffix } from "./fmt";
import { productImageUrl } from "./images";
import { t } from "./strings";

/** The quick weights, in grams, and the quick amounts, in rupees, and the quick counts. */
const WEIGHT_PRESETS = [250, 500, 750, 1000];
const AMOUNT_PRESETS = [100, 150, 200, 300];
const COUNT_PRESETS = [1, 2, 3, 4];

interface Family {
  key: string;
  /** The Tamil name the variants share: `பிராய்லர் கோழி` for `பிராய்லர் கோழி - தோலுடன்`. */
  title: string;
  items: MenuItem[];
}

/** Kinds shown first (and chosen by default) when the tab has them: broiler is the shop's main seller. */
const FIRST_GROUPS = ["broiler"];

/** Items that share a `group` are one family (bone and boneless of the same bird); the rest are families of one. */
function familiesOf(items: MenuItem[]): Family[] {
  const byGroup = new Map<string, MenuItem[]>();
  for (const item of items) byGroup.set(item.group, [...(byGroup.get(item.group) ?? []), item]);
  const families = [...byGroup.entries()].map(([key, list]) => ({
    key,
    title: list.length > 1 ? itemName(list[0]).split(" - ")[0] : itemName(list[0]),
    items: list,
  }));
  const rank = (key: string) => (FIRST_GROUPS.includes(key) ? FIRST_GROUPS.indexOf(key) : FIRST_GROUPS.length);
  return families.sort((a, b) => rank(a.key) - rank(b.key));
}

/** The short label of a variant on the switch: Bone, Boneless, With skin, Skinless, and உயிர் (uyir) for live. */
function variantLabel(item: MenuItem): string {
  if (item.variant === "live") return "உயிர்";
  if (item.variant) return VARIANT_LABELS[item.variant].name.replace(/^With bone$/, "Bone");
  const tail = itemName(item).split(" - ")[1];
  return tail ?? item.name;
}

/** `₹450` for a whole-rupee rate, `₹450.50` when it has paise. */
const shortRate = (minor: number) => (minor % 100 === 0 ? `${CURRENCY_SYMBOL}${minor / 100}` : formatMoney(minor));

/** The weight and amount ways to bill an item, in the order the owner switched them on. */
function ways(item: MenuItem): ("weight" | "amount")[] {
  return item.unit === "kg" ? (item.methods.filter((m) => m === "weight" || m === "amount") as ("weight" | "amount")[]) : [];
}

function lineBase(item: MenuItem) {
  return { itemId: item.id, name: itemName(item), category: item.category, unit: item.unit, rateMinor: item.rateMinor, listRateMinor: item.rateMinor };
}

interface Props {
  /** The items of the selected tab. */
  items: MenuItem[];
  /** Adds a ready line to the bill. */
  onAdd: (line: OrderLineInput) => void;
  /** Opens the full sheet for any other weight, amount or count. */
  onOther: (item: MenuItem, method: Method) => void;
}

function FamilyCard({ family, item, selected, onSelect }: { family: Family; item: MenuItem; selected: boolean; onSelect: () => void }) {
  const [photo, setPhoto] = useState<"loading" | "ok" | "missing">("loading");
  // The kind's own photo (public/families/<group>.jpg) first; failing that, the selected cut's product photo.
  const kindPhoto = `/families/${encodeURIComponent(family.key)}.jpg`;
  const [src, setSrc] = useState(kindPhoto);
  const rate = item.rateMinor > 0 ? `${item.unit === "kg" ? "1 × 1 kg" : "1 × 1 pc"} · ${shortRate(item.rateMinor)}` : t.setRate;
  return (
    <button type="button" className={`ct-fcard${selected ? " is-on" : ""}`} aria-pressed={selected} onClick={onSelect}>
      {/* The photo slot is always there; the product photo covers it once it has loaded. */}
      <span className="ct-fcard__pic">
        <svg className="ct-fcard__ph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <circle cx="9" cy="10" r="1.8" />
          <path d="m4 18 5-5 4 4 3-3 4 4" />
        </svg>
        {photo !== "missing" && <img className={`ct-fcard__photo${photo === "ok" ? " is-ready" : ""}`} src={src} alt="" draggable={false} onLoad={() => setPhoto("ok")} onError={() => (src === kindPhoto ? setSrc(productImageUrl(item)) : setPhoto("missing"))} />}
      </span>
      <span className="ct-fcard__cap">
        <span className="ct-fcard__name">{family.title}</span>
        <span className="ct-fcard__meta">{rate}</span>
      </span>
    </button>
  );
}

/**
 * The item picker: a column of cards down the left (one per kind: country chicken, broiler, mutton…) and, on the
 * right, everything for the chosen kind. A switch picks the cut (Bone / Boneless), a bar picks how the customer
 * asks (by weight or by amount), and four big squares add the common weights or amounts with one tap. Anything else
 * goes through "Other", which opens the full sheet.
 */
export function ItemPicker({ items, onAdd, onOther }: Props) {
  const families = useMemo(() => familiesOf(items), [items]);
  const [familyKey, setFamilyKey] = useState<string | null>(null);
  const [variantByFamily, setVariantByFamily] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"weight" | "amount">("weight");

  // A small down arrow shows while more cards are hidden below the ones on screen.
  const listRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  const checkMore = useCallback(() => {
    const el = listRef.current;
    setMoreBelow(el !== null && el.scrollHeight - el.scrollTop - el.clientHeight > 12);
  }, []);
  useEffect(() => {
    checkMore();
    window.addEventListener("resize", checkMore);
    return () => window.removeEventListener("resize", checkMore);
  }, [checkMore, families.length]);

  const family = families.find((f) => f.key === familyKey) ?? families[0];
  if (!family) return null;
  const item = family.items.find((i) => i.id === variantByFamily[family.key]) ?? family.items[0];

  const available = ways(item);
  const activeMode = available.includes(mode) ? mode : available[0];
  const piece = item.unit === "piece";
  const ready = item.rateMinor > 0;

  const addWeight = (grams: number) => onAdd({ ...lineBase(item), grams, qty: 0 });
  const addAmount = (rupees: number) => {
    const amountMinor = rupees * 100;
    onAdd({ ...lineBase(item), grams: gramsForAmount(amountMinor, item.rateMinor), qty: 0, amountMinor });
  };
  const addCount = (qty: number) => onAdd({ ...lineBase(item), grams: 0, qty });

  // Each tile: a big figure with a small unit (or ₹ in front), what it comes to, and a + that says "tap to add".
  type Tile = { key: number; prefix?: string; num: string; unit?: string; sub: string; add: () => void };
  const squares: Tile[] = piece
    ? COUNT_PRESETS.map((n) => ({ key: n, num: String(n), unit: n === 1 ? t.onePiece : t.manyPieces, sub: ready ? formatMoney(item.rateMinor * n) : "", add: () => addCount(n) }))
    : activeMode === "amount"
      ? AMOUNT_PRESETS.map((a) => ({ key: a, prefix: CURRENCY_SYMBOL, num: String(a), sub: ready ? `≈ ${formatWeight(gramsForAmount(a * 100, item.rateMinor))}` : "", add: () => addAmount(a) }))
      : WEIGHT_PRESETS.map((g) => ({ key: g, num: g === 1000 ? "1" : String(g), unit: g === 1000 ? "kg" : "g", sub: ready ? formatMoney(lineTotalMinor(item.rateMinor, g)) : "", add: () => addWeight(g) }));
  const otherMethod: Method = piece ? "qty" : activeMode === "amount" ? "amount" : "weight";
  const otherLabel = piece ? t.otherCount : activeMode === "amount" ? t.otherAmount : t.otherWeight;

  return (
    <div className="ct-pick">
      <div className="ct-pick__col">
      <div className="ct-pick__cards" role="group" aria-label={t.kindsLabel} ref={listRef} onScroll={checkMore}>
        {families.map((f) => {
          const shown = f.items.find((v) => v.id === variantByFamily[f.key]) ?? f.items[0];
          return <FamilyCard key={f.key} family={f} item={shown} selected={f.key === family.key} onSelect={() => setFamilyKey(f.key)} />;
        })}
      </div>
      {moreBelow && (
        <button type="button" className="ct-pick__more" aria-label={t.scrollDown} onClick={() => listRef.current?.scrollBy({ top: listRef.current.clientHeight / 2, behavior: "smooth" })}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}
      </div>

      <section className="ct-pick__panel" aria-label={family.title}>
        <header className="ct-pick__head">
          <h2 className="ct-pick__title">{family.title}</h2>
          <span className="ct-pick__rate">{ready ? `${formatMoney(item.rateMinor)}${unitSuffix(item.unit)}` : t.setRate}</span>
        </header>

        {family.items.length > 1 && (
          <div className="ct-switch" role="radiogroup" aria-label={t.cutLabel}>
            {family.items.map((v) => (
              <button key={v.id} type="button" role="radio" aria-checked={v.id === item.id} className={`ct-switch__opt${v.id === item.id ? " is-on" : ""}`} onClick={() => setVariantByFamily((s) => ({ ...s, [family.key]: v.id }))}>
                {variantLabel(v)}
              </button>
            ))}
          </div>
        )}

        {available.length > 1 && (
          <div className="ct-modebar" role="tablist" aria-label={t.howLabel}>
            {available.map((m) => (
              <button key={m} type="button" role="tab" aria-selected={m === activeMode} className={`ct-modebar__opt${m === activeMode ? " is-on" : ""}`} onClick={() => setMode(m)}>
                {m === "weight" ? t.byWeight : t.byAmount}
              </button>
            ))}
          </div>
        )}

        <div className="ct-pick__squares">
          {squares.map((s) => (
            <button key={s.key} type="button" className="ct-square" disabled={!ready} onClick={s.add}>
              <span className="ct-square__fig">
                {s.prefix && <i className="ct-square__prefix">{s.prefix}</i>}
                <b className="ct-square__num">{s.num}</b>
                {s.unit && <i className="ct-square__unit">{s.unit}</i>}
              </span>
              <span className="ct-square__foot">
                <span className="ct-square__sub">{s.sub}</span>
                <span className="ct-square__add" aria-hidden="true">
                  +
                </span>
              </span>
            </button>
          ))}
        </div>

        <button type="button" className="ct-pick__other" disabled={!ready} onClick={() => onOther(item, otherMethod)}>
          {otherLabel}
        </button>
      </section>
    </div>
  );
}
