import { useCallback, useEffect, useRef, useState } from "react";
import { dayKey, daysWorkedSince, earnedFor, labourBalance, weekStartKey, type LabourEntry, type LabourKind, type Labourer } from "@kumbakonam/shared/core";
import { addLabourEntry, deleteLabourEntry, getLabourEntries, getLabourers, newLabourId, saveLabourer } from "@kumbakonam/shared/shop";
import { dayText, errorText, formatMoney, paiseToRupees, rupeesToPaise } from "./fmt";
import { Notice, Sheet } from "./ui";

// The labour salary book: daily-wage workers. A worker's balance is what they earned, less what was paid and lent, from
// the day entries (never stored), so deleting a wrong entry corrects it. Positive: the shop owes them. Negative: an advance.

const KIND_LABELS: Record<LabourKind, string> = { work: "வேலை", leave: "லீவு", double: "இரட்டை", vehicle: "வண்டி", other: "மற்றது" };
const KINDS: LabourKind[] = ["work", "leave", "double", "vehicle", "other"];

/** `₹650` for whole rupees, `₹650.50` with paise. */
const rupees = (minor: number) => formatMoney(Math.abs(minor));

/** A typed amount in rupees as paise; empty counts as 0; null when it is not an amount. */
function typedMinor(text: string): number | null {
  return text.trim() === "" ? 0 : rupeesToPaise(text);
}

/** What the balance means, in words: who owes whom. */
function balanceWords(balanceMinor: number): string {
  if (balanceMinor > 0) return `கொடுக்க வேண்டியது ${rupees(balanceMinor)}`;
  if (balanceMinor < 0) return `முன்பணம் (அவர் தர வேண்டும்) ${rupees(balanceMinor)}`;
  return "கணக்கு சரி";
}

export function Salary() {
  const [workers, setWorkers] = useState<Labourer[] | null>(null);
  const [entries, setEntries] = useState<LabourEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, e] = await Promise.all([getLabourers(), getLabourEntries()]);
      setWorkers(w);
      setEntries(e);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (workers === null) return error ? <Notice tone="error">{error}</Notice> : <p className="ow-empty">ஏற்றுகிறது…</p>;

  const entriesOf = (id: string) => entries.filter((e) => e.labourerId === id);
  const balanceOf = (w: Labourer) => labourBalance(w.openingMinor, entriesOf(w.id));
  const week = weekStartKey(new Date());
  const rows = workers.map((w) => ({ w, balance: balanceOf(w), days: daysWorkedSince(entriesOf(w.id), week) }));
  const owed = rows.reduce((sum, r) => sum + Math.max(r.balance, 0), 0);
  const lent = rows.reduce((sum, r) => sum + Math.max(-r.balance, 0), 0);
  const active = rows.filter((r) => r.w.active);
  const left = rows.filter((r) => !r.w.active);
  const open = workers.find((w) => w.id === openId) ?? null;

  const row = (r: (typeof rows)[number]) => (
    <li key={r.w.id}>
      <button type="button" className={`ow-bill${r.w.active ? "" : " is-deleted"}`} onClick={() => setOpenId(r.w.id)}>
        <span className="ow-bill__main">
          <strong className="ow-bill__no">{r.w.name}</strong>
          <span className="ow-bill__meta">
            நாள் சம்பளம் {rupees(r.w.dayWageMinor)} · இந்த வாரம் {r.days} நாள்
          </span>
        </span>
        <span className="ow-bill__side">
          <strong className={`ow-bill__total${r.balance < 0 ? " is-credit" : ""}`}>{r.balance === 0 ? "₹0" : `${r.balance < 0 ? "−" : ""}${rupees(r.balance)}`}</strong>
          <span className="ow-bill__meta">{r.balance > 0 ? "கொடுக்க" : r.balance < 0 ? "முன்பணம்" : ""}</span>
        </span>
      </button>
    </li>
  );

  return (
    <div className="ow-stack">
      <section className="ow-card ow-summary" aria-label="மொத்த சம்பளக் கணக்கு">
        <div>
          <p className="ow-label">கொடுக்க வேண்டியது</p>
          <p className="ow-summary__total">{formatMoney(owed)}</p>
        </div>
        <div>
          <p className="ow-label">கொடுத்த முன்பணம்</p>
          <p className={`ow-summary__total${lent > 0 ? " is-credit" : ""}`}>{formatMoney(lent)}</p>
        </div>
      </section>

      {error && <Notice tone="error">{error}</Notice>}

      <button type="button" className="ow-btn ow-btn--primary ow-btn--wide" onClick={() => setAdding(true)}>
        + புதிய ஆள்
      </button>

      {rows.length === 0 ? <p className="ow-empty">இன்னும் யாரும் சேர்க்கவில்லை.</p> : <ul className="ow-bills">{active.map(row)}</ul>}
      {left.length > 0 && (
        <>
          <h3 className="ow-card__title">விட்டவர்கள்</h3>
          <ul className="ow-bills">{left.map(row)}</ul>
        </>
      )}

      {adding && (
        <WorkerFormSheet
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await load();
          }}
        />
      )}
      {open && <WorkerSheet worker={open} entries={entriesOf(open.id)} balance={balanceOf(open)} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}

/** Add a worker, or change one: name, usual day wage, what was owed (or lent, with a minus) before this book, and whether they still work. */
function WorkerFormSheet({ worker, onClose, onSaved }: { worker?: Labourer; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(worker?.name ?? "");
  const [wage, setWage] = useState(worker ? paiseToRupees(worker.dayWageMinor) : "");
  const [opening, setOpening] = useState(worker && worker.openingMinor !== 0 ? paiseToRupees(worker.openingMinor) : "");
  const [active, setActive] = useState(worker?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useRef(worker?.id ?? null);

  const wageMinor = typedMinor(wage);
  // The opening amount may be negative (an advance already given): a minus sign in front.
  const negative = opening.trim().startsWith("-");
  const openingAbs = typedMinor(opening.trim().replace(/^-/, ""));
  const openingMinor = openingAbs === null ? null : negative ? -openingAbs : openingAbs;
  const valid = name.trim() !== "" && wageMinor !== null && openingMinor !== null;

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    id.current ??= newLabourId("labourers");
    try {
      await saveLabourer(id.current, { name, dayWageMinor: wageMinor, openingMinor, active });
      await onSaved();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <Sheet title={worker ? "திருத்து" : "புதிய ஆள்"} onClose={onClose} busy={busy}>
      <div className="ow-stack">
        <label className="ow-field">
          <span className="ow-label">பெயர்</span>
          <input className="ow-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </label>
        <label className="ow-field">
          <span className="ow-label">ஒரு நாள் சம்பளம் (₹)</span>
          <input className="ow-input" inputMode="decimal" autoComplete="off" placeholder="650" value={wage} onChange={(e) => setWage(e.target.value)} />
        </label>
        <label className="ow-field">
          <span className="ow-label">முன் கணக்கு (₹): கொடுக்க வேண்டியது + , முன்பணம் −</span>
          <input className="ow-input" inputMode="decimal" autoComplete="off" placeholder="0" value={opening} onChange={(e) => setOpening(e.target.value)} />
        </label>
        {worker && (
          <div className="ow-chips" role="radiogroup" aria-label="நிலை">
            <button type="button" role="radio" aria-checked={active} className={`ow-chip${active ? " is-active" : ""}`} onClick={() => setActive(true)}>
              வேலை செய்கிறார்
            </button>
            <button type="button" role="radio" aria-checked={!active} className={`ow-chip${!active ? " is-active" : ""}`} onClick={() => setActive(false)}>
              விட்டுவிட்டார்
            </button>
          </div>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <button type="button" className="ow-btn ow-btn--primary ow-btn--wide" disabled={!valid || busy} onClick={() => void save()}>
          {busy ? "சேமிக்கிறது…" : "சேமி"}
        </button>
      </div>
    </Sheet>
  );
}

/** One worker: the balance, a form for a day, the day-by-day list (with delete), and a way to edit them. */
function WorkerSheet({ worker, entries, balance, onClose, onChanged }: { worker: Labourer; entries: LabourEntry[]; balance: number; onClose: () => void; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [day, setDay] = useState(dayKey(new Date()));
  const [kind, setKind] = useState<LabourKind>("work");
  const [typedEarned, setTypedEarned] = useState("");
  const [paid, setPaid] = useState("");
  const [advance, setAdvance] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // One id per entry, kept until it is saved, so a retry after a lost answer cannot add the day twice.
  const entryId = useRef<string | null>(null);

  const typedMode = kind === "vehicle" || kind === "other";
  const typed = typedMinor(typedEarned);
  const earnedMinor = typedMode ? typed : earnedFor(kind, worker.dayWageMinor);
  const paidMinor = typedMinor(paid);
  const advanceMinor = typedMinor(advance);
  const amountsOk = earnedMinor !== null && paidMinor !== null && advanceMinor !== null;
  const nothing = amountsOk && kind !== "leave" && earnedMinor === 0 && paidMinor === 0 && advanceMinor === 0;
  const after = amountsOk ? balance + earnedMinor - paidMinor - advanceMinor : balance;

  const payAll = () => {
    if (earnedMinor === null) return;
    const advanceNow = advanceMinor ?? 0;
    const due = balance + earnedMinor - advanceNow;
    setPaid(due > 0 ? paiseToRupees(due) : "");
  };

  const save = async () => {
    if (busy || !amountsOk || nothing || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    entryId.current ??= newLabourId("labourEntries");
    try {
      await addLabourEntry({ id: entryId.current, labourerId: worker.id, dayKey: day, kind, earnedMinor, paidMinor, advanceMinor, note });
      entryId.current = null;
      setTypedEarned("");
      setPaid("");
      setAdvance("");
      setNote("");
      setKind("work");
      setSaved("சேமித்தது ✓");
      await onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await deleteLabourEntry(id);
      setConfirmDelete(null);
      await onChanged();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <WorkerFormSheet
        worker={worker}
        onClose={() => setEditing(false)}
        onSaved={async () => {
          setEditing(false);
          await onChanged();
        }}
      />
    );
  }

  return (
    <Sheet title={worker.name} subtitle={balanceWords(balance)} onClose={onClose} busy={busy}>
      <div className="ow-stack">
        <section className="ow-pay" aria-label="நாள் பதிவு">
          <h3 className="ow-card__title">நாள் பதிவு</h3>
          <label className="ow-field">
            <span className="ow-label">தேதி</span>
            <input className="ow-input" type="date" value={day} max={dayKey(new Date())} onChange={(e) => setDay(e.target.value)} />
          </label>
          <div className="ow-chips" role="radiogroup" aria-label="அன்று என்ன">
            {KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className={`ow-chip${kind === k ? " is-active" : ""}`} onClick={() => setKind(k)}>
                {KIND_LABELS[k]}
              </button>
            ))}
          </div>
          {typedMode ? (
            <label className="ow-field">
              <span className="ow-label">{kind === "vehicle" ? "வண்டி தொகை (₹)" : "தொகை (₹)"}</span>
              <input className="ow-input" inputMode="decimal" autoComplete="off" placeholder="0" value={typedEarned} onChange={(e) => setTypedEarned(e.target.value)} />
            </label>
          ) : (
            <p className="ow-text">{kind === "leave" ? "அன்று சம்பளம் இல்லை." : `சம்பளம் ${formatMoney(earnedMinor ?? 0)}${kind === "double" ? " (இரண்டு நாள்)" : ""}`}</p>
          )}
          <div className="ow-pay__row">
            <label className="ow-field ow-field--grow">
              <span className="ow-label">கொடுத்தது (₹)</span>
              <input className="ow-input" inputMode="decimal" autoComplete="off" placeholder="0" value={paid} onChange={(e) => setPaid(e.target.value)} />
            </label>
            <button type="button" className="ow-btn ow-btn--small" onClick={payAll}>
              முழுவதும்
            </button>
          </div>
          <label className="ow-field">
            <span className="ow-label">முன்பணம் (₹)</span>
            <input className="ow-input" inputMode="decimal" autoComplete="off" placeholder="0" value={advance} onChange={(e) => setAdvance(e.target.value)} />
          </label>
          <label className="ow-field">
            <span className="ow-label">குறிப்பு</span>
            <input className="ow-input" autoComplete="off" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <p className="ow-text">சேமித்த பின் கணக்கு: <strong>{balanceWords(after)}</strong></p>
          {!amountsOk && <p className="ow-text ow-text--error">தொகையை சரியாக போடவும்.</p>}
          {error && <Notice tone="error">{error}</Notice>}
          {saved && <Notice tone="info">{saved}</Notice>}
          <button type="button" className="ow-btn ow-btn--primary ow-btn--wide" disabled={busy || !amountsOk || nothing} onClick={() => void save()}>
            {busy ? "சேமிக்கிறது…" : "பதிவு செய்"}
          </button>
        </section>

        <section aria-label="கணக்கு வரிசை">
          <h3 className="ow-card__title">கணக்கு</h3>
          {worker.openingMinor !== 0 && <p className="ow-text ow-text--muted">முன் கணக்கு: {balanceWords(worker.openingMinor)}</p>}
          {entries.length === 0 ? (
            <p className="ow-text ow-text--muted">இன்னும் பதிவு இல்லை.</p>
          ) : (
            <ul className="ow-list">
              {entries.map((e) => (
                <li key={e.id} className="ow-list__row">
                  <span className="ow-list__main">
                    <strong className="ow-list__name">
                      {dayText(e.dayKey)} · {KIND_LABELS[e.kind]}
                    </strong>
                    <span className="ow-list__sub">
                      {e.earnedMinor > 0 ? `சம்பளம் ${rupees(e.earnedMinor)}` : ""}
                      {e.paidMinor > 0 ? ` · கொடுத்தது ${rupees(e.paidMinor)}` : ""}
                      {e.advanceMinor > 0 ? ` · முன்பணம் ${rupees(e.advanceMinor)}` : ""}
                      {e.note ? ` · ${e.note}` : ""}
                    </span>
                  </span>
                  {confirmDelete === e.id ? (
                    <span className="ow-list__amount">
                      <button type="button" className="ow-btn ow-btn--small" disabled={busy} onClick={() => void remove(e.id)}>
                        உறுதி
                      </button>{" "}
                      <button type="button" className="ow-btn ow-btn--small" disabled={busy} onClick={() => setConfirmDelete(null)}>
                        வேண்டாம்
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="ow-btn ow-btn--small" aria-label="நீக்கு" disabled={busy} onClick={() => setConfirmDelete(e.id)}>
                      நீக்கு
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <button type="button" className="ow-btn ow-btn--wide" onClick={() => setEditing(true)}>
          பெயர் / சம்பளம் திருத்து
        </button>
      </div>
    </Sheet>
  );
}
