import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  canAddLine,
  formatMoney,
  isRealSplit,
  isStale,
  pendingEntries,
  splitPayment,
  describeError,
  normalizeMethods,
  type CartLine,
  type Category,
  type MenuItem,
  type Method,
  type OrderLineInput,
  type PaymentMethod,
  type Role,
  DEFAULT_CATEGORIES,
} from "@kumbakonam/shared/core";
import {
  abandonOrder,
  createOrder,
  dismissRefused,
  newOrderId,
  resumeOutbox,
  seedBillNumbers,
  subscribeCategories,
  subscribeMaxAdjust,
  subscribeMenu,
  useOutbox,
  useServerConnection,
  voidOrder,
} from "@kumbakonam/shared/shop";
import { DEFAULT_MAX_ADJUST_MINOR } from "@kumbakonam/shared/core";
import { usePrinter, type PrinterProblem, type PrintResult } from "../hooks/usePrinter";
import type { BillInput } from "../printing/receipt";
import { prepareReceiptRaster } from "../printing/receiptCanvas";
import { SAMPLE_BILLS } from "../printing/sampleBills";
import { AdminMenu } from "./AdminMenu";
import { toBillInput } from "./bill";
import { BillCart } from "./BillCart";
import { BillSheet } from "./BillSheet";
import { useCounterCart } from "./cart";
import { CreditModal } from "./CreditModal";
import { categoryLabel } from "./fmt";
import { ItemSheet } from "./ItemSheet";
import { KhataModal } from "./KhataModal";
import { PinScreen } from "./PinScreen";
import { PrinterSheet } from "./PrinterSheet";
import { ItemCards } from "./ItemCards";
import { ItemPicker } from "./ItemPicker";
import { CounterTabs } from "./ProductGrid";
import { RecentBillsSheet } from "./RecentBillsSheet";
import { markDeleted, rememberBill, useDeletedBills, useRecentBills } from "./recentBills";
import { isRateStale, RatesView } from "./RatesView";
import { playSavedSound, primeSound } from "./sound";
import { SideRail } from "./SideRail";
import { SplitModal } from "./SplitModal";
import { SyncBanner } from "./SyncBanner";
import { t } from "./strings";

/** Lets a catalog still being checked (items not switched on) show at the counter. Development only; never set in production. */
const SHOW_DRAFT_MENU = import.meta.env.DEV && import.meta.env.VITE_SHOW_DRAFT_MENU === "1";

type View = "sell" | "ownerPin" | "rates";
/** Menu groups that appear in every tab. */
const EVERY_TAB_GROUPS = ["excess"];

/** The owner's admin app: the gear goes straight there (rates, reports, bills, credit). */
const ADMIN_URL = "https://broiler-pos-admin.web.app";
const goToAdmin = () => window.location.assign(ADMIN_URL);

type Sheet = { item: MenuItem; editing?: CartLine; startMethod?: Method };

/** A stand-in for an item that has left the menu since it was added to the cart, so its line can still be edited. */
function itemFromLine(line: CartLine): MenuItem {
  return {
    id: line.itemId,
    name: line.name,
    nameTa: null,
    category: line.category,
    group: line.itemId,
    variant: null,
    unit: line.unit,
    methods: normalizeMethods(line.unit, undefined),
    image: null,
    rateMinor: line.listRateMinor,
    defaultGrams: 1000,
    defaultQty: 1,
    rateUpdatedAt: null,
    active: true,
    sortOrder: 0,
  };
}

interface Props {
  role: Role;
  /** Signs in as the owner (to set today's rates). Rejects on a wrong PIN. */
  signInOwner: (pin: string) => Promise<void>;
  /** Signs back in as the counter after the owner is done; signs out if that cannot be done. */
  restoreCounter: () => Promise<void>;
  /** Locks the screen (the tablet stays signed in). */
  onLock: () => void;
}

export function CounterScreen({ role, signInOwner, restoreCounter, onLock }: Props) {
  const cart = useCounterCart();
  const printer = usePrinter();
  const connected = useServerConnection();
  const outbox = useOutbox();
  const waiting = pendingEntries(outbox).length;
  // The clock moves on while the screen sits open, so "a day old" is re-checked once a minute.
  const [, setMinute] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setMinute((n) => n + 1), 60_000);
    return () => clearInterval(timer);
  }, []);
  const stale = isStale(outbox, Date.now());

  // Bills left waiting by an earlier launch are watched again, and the bill count is carried up to what the
  // server last saw (for a reinstalled tablet), now and every time the connection comes back.
  useEffect(() => {
    resumeOutbox();
  }, []);
  const wasConnected = useRef(false);
  useEffect(() => {
    if (connected && !wasConnected.current) void seedBillNumbers();
    wasConnected.current = connected;
  }, [connected]);

  // --- Data ---------------------------------------------------------------
  const [allCategories, setAllCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [maxAdjustMinor, setMaxAdjustMinor] = useState(DEFAULT_MAX_ADJUST_MINOR);

  useEffect(() => subscribeCategories(setAllCategories), []);
  useEffect(() => subscribeMaxAdjust(setMaxAdjustMinor), []);
  useEffect(
    () =>
      subscribeMenu(
        (next) => {
          setItems(next);
          setMenuError(null);
        },
        (e) => setMenuError(describeError(e)),
        { includeInactive: SHOW_DRAFT_MENU, categories: allCategories },
      ),
    [allCategories],
  );

  // Tabs: the owner's categories that have products, then any other category an item names.
  const tabs = useMemo((): Category[] => {
    const used = new Set((items ?? []).map((item) => item.category));
    const known = allCategories.filter((c) => used.has(c.key));
    const extra = [...used].filter((key) => !allCategories.some((c) => c.key === key)).map((key) => ({ key, name: key, nameTa: key }));
    // Others is always the last tab.
    return [...known, ...extra].sort((a, b) => Number(a.key === "other") - Number(b.key === "other"));
  }, [items, allCategories]);
  const [categoryKey, setCategoryKey] = useState<string | null>(null);
  const category = categoryKey !== null && tabs.some((c) => c.key === categoryKey) ? categoryKey : (tabs[0]?.key ?? null);
  // Items that sit in every tab (கூடுதல் / Extra: an add-on that goes with any bill), shown last in each.
  const visibleItems = useMemo(() => {
    const all = items ?? [];
    const inEveryTab = (item: MenuItem) => EVERY_TAB_GROUPS.includes(item.group);
    return [...all.filter((item) => item.category === category && !inEveryTab(item)), ...all.filter(inEveryTab)];
  }, [items, category]);

  // --- Screen state -------------------------------------------------------
  const [view, setView] = useState<View>("sell");
  /** True while the owner is signed in only to set the rates; the till then signs back in as the counter. */
  const elevated = useRef(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  /** Repeated equal weights stay packs (2 × 250 g), as the bill is read. Always on unless the cashier unticks it. */
  const [keepPacks, setKeepPacks] = useState(true);
  const [adminOpen, setAdminOpen] = useState(false);
  const [printerOpen, setPrinterOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  // Split and credit each need a little more than a tap: the GPay amount, or who owes.
  const [splitOpen, setSplitOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);
  const [khataOpen, setKhataOpen] = useState(false);
  const [splitUpiMinor, setSplitUpiMinor] = useState(0);
  const [creditName, setCreditName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** A bill on the screen: after a sale that could not be printed (with why), or an earlier bill opened to print as a copy. */
  const [billView, setBillView] = useState<{ bill: BillInput; problem: PrinterProblem | null } | null>(null);
  const [reprinting, setReprinting] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const recentBills = useRecentBills();
  const deletedBills = useDeletedBills();
  const [testOutcome, setTestOutcome] = useState<"ok" | PrinterProblem | null>(null);
  const [testing, setTesting] = useState(false);

  // One id per sale, kept across a failed save so a retry cannot save the sale twice. Any change to what is
  // being sold or how it is paid makes it a different sale, so it starts a new id.
  const attemptId = useRef<string | null>(null);
  const newSale = () => {
    // A sale that was never saved gives its bill number back (a saved sale has none to give: it was settled).
    if (attemptId.current !== null) abandonOrder(attemptId.current);
    attemptId.current = null;
  };

  const rateNeeded = items !== null && items.some((item) => isRateStale(item));
  const canEditRates = items !== null && items.length > 0;

  // --- Printing -----------------------------------------------------------
  /** Prints a bill. Never throws: says whether it came out and, if not, why. */
  const tryPrint = useCallback(
    async (bill: BillInput): Promise<PrintResult> => {
      if (printer.status !== "ready") return { ok: false, problem: "no-printer" };
      try {
        const { bytes, timing } = await prepareReceiptRaster(bill);
        return await printer.print(bytes, timing);
      } catch (err) {
        console.error("Receipt rendering failed", err);
        return { ok: false, problem: "unreachable" };
      }
    },
    [printer],
  );

  // Bills are printed one after another in the background, so the cashier can start the next customer straight away
  // (a slow or switched-off printer must never freeze the counter). A bill that did not print stays on a red strip.
  const tryPrintRef = useRef(tryPrint);
  tryPrintRef.current = tryPrint;
  const printChain = useRef<Promise<void>>(Promise.resolve());
  const [unprinted, setUnprinted] = useState<{ bill: BillInput; problem: PrinterProblem }[]>([]);
  const queuePrint = (bill: BillInput, online: boolean) => {
    setNotice({ text: t.printingBill(bill.billNo), tone: "info" });
    printChain.current = printChain.current.then(async () => {
      const result = await tryPrintRef.current(bill);
      if (result.ok) {
        setUnprinted((list) => list.filter((u) => u.bill.orderId !== bill.orderId));
        setNotice({ text: online ? t.printed(bill.billNo) : t.printedOffline(bill.billNo), tone: "info" });
      } else {
        setUnprinted((list) => [...list.filter((u) => u.bill.orderId !== bill.orderId), { bill, problem: result.problem }]);
      }
    });
  };

  // --- Actions ------------------------------------------------------------
  const confirmSheet = (line: OrderLineInput) => {
    if (!sheet) return;
    if (sheet.editing) {
      cart.replace(sheet.editing.key, line);
    } else if (!canAddLine(cart.lines, line)) {
      setNotice({ text: t.tooManyLines, tone: "error" });
      setSheet(null);
      return;
    } else {
      cart.add(line);
    }
    newSale();
    setNotice(null);
    setSheet(null);
  };

  /** A one-tap weight, amount or count from the picker goes straight onto the bill. */
  // The same preset tapped twice within a moment is one tap that bounced (wet or shaking fingers), not two packs.
  const lastPreset = useRef({ sig: "", at: 0 });
  const addPreset = (line: OrderLineInput) => {
    const sig = JSON.stringify(line);
    const now = Date.now();
    if (lastPreset.current.sig === sig && now - lastPreset.current.at < 350) return;
    lastPreset.current = { sig, at: now };
    if (!canAddLine(cart.lines, line)) {
      setNotice({ text: t.tooManyLines, tone: "error" });
      return;
    }
    cart.add(line);
    newSale();
    setNotice(null);
  };

  const editLine = (key: string) => {
    const line = cart.lines.find((l) => l.key === key);
    if (!line) return;
    setSheet({ item: items?.find((i) => i.id === line.itemId) ?? itemFromLine(line), editing: line });
  };

  /** Saves the sale. `print` false: kept without printing (it can still be printed later from Recent bills). */
  const charge = async (print = true) => {
    if (submitting || cart.lines.length === 0) return;
    // A split with nothing on one side, or a credit bill with nobody on it, is not ready: ask first.
    if (paymentMethod === "split" && !isRealSplit(cart.totalMinor, splitUpiMinor)) {
      setNotice({ text: t.splitNeeded, tone: "error" });
      setSplitOpen(true);
      return;
    }
    if (paymentMethod === "credit") {
      // A credit bill changes the customer's balance, which only the server can check: it needs the internet.
      if (!connected) return setNotice({ text: t.creditNeedsInternet, tone: "error" });
      if (!creditName) {
        setNotice({ text: t.creditNeeded, tone: "error" });
        setCreditOpen(true);
        return;
      }
    }
    primeSound();
    setSubmitting(true);
    setNotice(null);
    try {
      const lines = cart.lines;
      attemptId.current ??= newOrderId();
      const upiMinor = paymentMethod === "split" ? splitPayment(cart.totalMinor, splitUpiMinor).upiMinor : 0;
      const created = await createOrder({
        orderId: attemptId.current,
        lines,
        paymentMethod,
        ...(paymentMethod === "split" && { split: { upiMinor } }),
        ...(paymentMethod === "credit" && creditName && { customer: { name: creditName } }),
      });
      playSavedSound();
      const bill = toBillInput({
        orderId: created.id,
        billNo: created.label,
        createdAt: created.soldAt,
        lines,
        totalMinor: created.totalMinor,
        totalGrams: cart.totalGrams,
        totalPieces: cart.totalPieces,
        paymentMethod,
        ...(paymentMethod === "split" && { upiAmountMinor: upiMinor, cashAmountMinor: created.totalMinor - upiMinor }),
        ...(paymentMethod === "credit" && { customerName: created.customerName ?? creditName ?? "" }),
      });
      newSale();
      cart.clear();
      setPaymentMethod("cash");
      setSplitUpiMinor(0);
      setCreditName(null);
      // The sale is saved and the bill is kept in the recent list; now the paper. If the printer is missing or refuses,
      // the bill shows on screen with the reason and a Print again button, so a failed print is never a lost sale.
      rememberBill({ ...bill, restore: lines.map(({ key: _key, ...rest }) => rest) });
      if (!print) {
        setNotice({ text: connected ? t.saved(created.label) : t.savedOffline(created.label), tone: "info" });
        return;
      }
      queuePrint(bill, connected);
    } catch (e) {
      // The cart is kept, so pressing Print bill again retries the same sale (same id, never saved twice).
      setNotice({ text: t.saleError(describeError(e)), tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  /** Print again, from the bill on the screen (a bill that did not print, or an earlier bill being copied). */
  const printFromSheet = async () => {
    if (!billView) return;
    setReprinting(true);
    const result = await tryPrint(billView.bill);
    setReprinting(false);
    if (result.ok) {
      setUnprinted((list) => list.filter((u) => u.bill.orderId !== billView.bill.orderId));
      setNotice({ text: t.printed(billView.bill.billNo), tone: "info" });
      setBillView(null);
    } else {
      setBillView({ bill: billView.bill, problem: result.problem });
    }
  };

  /** The test print on the printer screen: a sample bill. */
  const testPrint = async () => {
    setTesting(true);
    setTestOutcome(null);
    try {
      const { bytes, timing } = await prepareReceiptRaster(SAMPLE_BILLS[0].bill);
      const result: PrintResult = await printer.print(bytes, timing);
      setTestOutcome(result.ok ? "ok" : result.problem);
    } catch (err) {
      console.error("Test print failed", err);
      setTestOutcome("unreachable");
    } finally {
      setTesting(false);
    }
  };

  // Changing a rate is the owner's job: the counter is asked for the owner's PIN, on the page, before the rates
  // view opens. Signing in as the owner is what lets the server accept the change.
  const leaveRates = () => {
    setView("sell");
    if (elevated.current) {
      elevated.current = false;
      // Back to the counter session. If that fails the app signs out (it must never stay signed in as the owner).
      restoreCounter().catch(() => undefined);
    }
  };
  const openRates = () => {
    setAdminOpen(false);
    if (!canEditRates) return;
    setView(role === "owner" ? "rates" : "ownerPin");
  };

  // --- Render -------------------------------------------------------------
  const split = splitPayment(cart.totalMinor, splitUpiMinor);
  const paymentDetail = {
    split: isRealSplit(cart.totalMinor, splitUpiMinor) ? t.splitChip(formatMoney(split.upiMinor), formatMoney(split.cashMinor)) : null,
    credit: creditName,
  };
  // The tabs read in Tamil letters: சிக்கன், மட்டன், மற்றவை. Any other tab uses its own Tamil name.
  const TAB_NAMES: Record<string, string> = { chicken: "சிக்கன்", mutton: "மட்டன்", other: "மற்றவை" };
  const labelFor = (c: Category) => TAB_NAMES[c.key] ?? (c.nameTa || categoryLabel(c.key, allCategories));

  const main =
    view === "ownerPin" ? (
      <PinScreen
        logoUrl="/logo.png"
        title={t.ownerPinTitle}
        subtitle={t.ownerPinSubtitle}
        onSubmit={async (pin) => {
          await signInOwner(pin);
          elevated.current = role !== "owner";
          setView("rates");
        }}
        onCancel={() => setView("sell")}
      />
    ) : view === "rates" ? (
      <RatesView items={items ?? []} onClose={leaveRates} />
    ) : menuError ? (
      <p className="ct-message">{t.menuError(menuError)}</p>
    ) : items === null ? (
      <p className="ct-message">{t.loading}</p>
    ) : items.length === 0 ? (
      <p className="ct-message">{t.menuEmpty}</p>
    ) : (
      <div className="ct-catalog">
        <CounterTabs categories={tabs} selected={category} onSelect={setCategoryKey} labelFor={labelFor} />
        {visibleItems.length === 0 ? <p className="ct-message">{t.categoryEmpty}</p> : category === "other" ? (
          <ItemCards items={visibleItems} onSelect={(item) => setSheet({ item })} />
        ) : (
          <ItemPicker items={visibleItems} keepPacks={keepPacks} onAdd={addPreset} onOther={(item, method) => setSheet({ item, startMethod: method })} />
        )}
      </div>
    );

  return (
    <div className="ct-screen">
      <SideRail logoUrl="/logo.png" rateNeeded={rateNeeded} connected={connected} waiting={waiting} stale={stale} printer={printer.status !== "ready" ? "none" : printer.problem ? "problem" : "ok"} onPrinter={() => { setTestOutcome(null); setPrinterOpen(true); }} onRecent={() => setRecentOpen(true)} onAdmin={() => (connected ? goToAdmin() : setNotice({ text: t.adminNeedsInternet, tone: "error" }))} />
      <div className="ct-body">
        <main className="ct-main">
          <SyncBanner connected={connected} outbox={outbox} stale={stale} onDismiss={dismissRefused} />
          {unprinted.map((u) => (
            <div key={u.bill.orderId} className="ct-sync__refused" role="alert">
              <div>
                <strong>{t.notPrinted(u.bill.billNo)}</strong>
              </div>
              <button type="button" className="ct-btn ct-btn--plain" onClick={() => setBillView({ bill: u.bill, problem: u.problem })}>
                {t.printAgain}
              </button>
            </div>
          ))}
          {main}
        </main>
        <BillCart
          logoUrl="/logo.png"
          lines={cart.lines}
          totalMinor={cart.totalMinor}
          totalGrams={cart.totalGrams}
          totalPieces={cart.totalPieces}
          paymentMethod={paymentMethod}
          keepPacks={keepPacks}
          onKeepPacksChange={setKeepPacks}
          paymentDetail={paymentDetail}
          onPaymentChange={(method) => {
            newSale();
            if (method === "credit" && !connected) {
              setNotice({ text: t.creditNeedsInternet, tone: "error" });
              setPaymentMethod("cash");
              return;
            }
            setPaymentMethod(method);
            if (method === "split") setSplitOpen(true);
            if (method === "credit") setCreditOpen(true);
          }}
          submitting={submitting}
          notice={notice}
          onDismissNotice={() => setNotice(null)}
          onEdit={editLine}
          onRemove={(key) => {
            newSale();
            cart.remove(key);
          }}
          onPrintBill={() => void charge(true)}
        onSaveBill={() => void charge(false)}
        />
      </div>

      {sheet && (
        <ItemSheet
          // A fresh sheet for every product or line, so it always starts from that item's own values.
          key={sheet.editing?.key ?? sheet.item.id}
          item={sheet.item}
          editing={sheet.editing}
          startMethod={sheet.startMethod}
          maxAdjustMinor={maxAdjustMinor}
          onCancel={() => setSheet(null)}
          onConfirm={confirmSheet}
        />
      )}

      {splitOpen && (
        <SplitModal
          totalMinor={cart.totalMinor}
          upiMinor={splitUpiMinor}
          onCancel={() => {
            setSplitOpen(false);
            // Backing out of the amounts means no split was really chosen.
            if (!isRealSplit(cart.totalMinor, splitUpiMinor)) setPaymentMethod("cash");
          }}
          onDone={(upiMinor) => {
            newSale();
            setSplitUpiMinor(upiMinor);
            setSplitOpen(false);
          }}
        />
      )}

      {creditOpen && (
        <CreditModal
          totalMinor={cart.totalMinor}
          current={creditName}
          onCancel={() => {
            setCreditOpen(false);
            if (!creditName) setPaymentMethod("cash");
          }}
          onChoose={(name) => {
            newSale();
            setCreditName(name);
            setCreditOpen(false);
          }}
        />
      )}

      {khataOpen && <KhataModal connected={connected} onClose={() => setKhataOpen(false)} />}

      {adminOpen && (
        <AdminMenu
          rateNeeded={rateNeeded}
          onClose={() => setAdminOpen(false)}
          onKhata={() => {
            setAdminOpen(false);
            setKhataOpen(true);
          }}
          onRecent={() => {
            setAdminOpen(false);
            setRecentOpen(true);
          }}
          onRates={openRates}
          onPrinter={() => {
            setAdminOpen(false);
            setTestOutcome(null);
            setPrinterOpen(true);
          }}
          onLock={() => {
            setAdminOpen(false);
            onLock();
          }}
        />
      )}

      {printerOpen && (
        <PrinterSheet
          status={printer.status}
          problem={printer.problem}
          deviceName={printer.deviceName}
          platform={printer.platform}
          printerDevices={printer.printerDevices}
          testOutcome={testOutcome}
          busy={testing}
          onConnect={printer.connect}
          onSelectPrinter={printer.selectPrinter}
          onTestPrint={() => void testPrint()}
          onClose={() => setPrinterOpen(false)}
        />
      )}

      {recentOpen && (
        <RecentBillsSheet
          bills={recentBills}
          deleted={deletedBills}
          waiting={new Set(pendingEntries(outbox).map((e) => e.orderId))}
          connected={connected}
          onDelete={async (orderId) => {
            await voidOrder(orderId);
            markDeleted(orderId);
          }}
          canFix={cart.lines.length === 0}
          onFix={(restore) => {
            restore.forEach((line) => cart.add(line));
            setRecentOpen(false);
            setNotice(null);
          }}
          onOpen={(bill) => {
            setRecentOpen(false);
            setBillView({ bill: { ...bill, isCopy: true }, problem: null });
          }}
          onClose={() => setRecentOpen(false)}
        />
      )}

      {billView && (
        <BillSheet
          bill={billView.bill}
          problem={billView.problem}
          printing={reprinting}
          onPrint={() => void printFromSheet()}
          onPrinterSetup={() => {
            setBillView(null);
            setTestOutcome(null);
            setPrinterOpen(true);
          }}
          onClose={() => setBillView(null)}
        />
      )}
    </div>
  );
}
