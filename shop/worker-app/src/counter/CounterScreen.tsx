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
  type OrderLineInput,
  type PaymentMethod,
  type Role,
  categoryLabel,
  DEFAULT_CATEGORIES,
} from "@kumbakonam/shared/core";
import {
  abandonOrder,
  createOrder,
  dismissRefused,
  getDeviceLetter,
  newOrderId,
  resumeOutbox,
  seedBillNumbers,
  setDeviceLetter,
  subscribeCategories,
  subscribeMaxAdjust,
  subscribeMenu,
  useOutbox,
  useServerConnection,
} from "@kumbakonam/shared/shop";
import { DEFAULT_MAX_ADJUST_MINOR } from "@kumbakonam/shared/core";
import { BillView } from "../components/BillView";
import { PrintDiagnosticsOverlay } from "../components/PrintDiagnosticsOverlay";
import { PrinterSetupModal } from "../components/PrinterSetupModal";
import { usePrinter } from "../hooks/usePrinter";
import type { BillInput } from "../printing/receipt";
import { prepareReceiptRaster } from "../printing/receiptCanvas";
import { SAMPLE_BILLS } from "../printing/sampleBills";
import { AdminMenu } from "./AdminMenu";
import { toBillInput } from "./bill";
import { BillCart } from "./BillCart";
import { useCounterCart } from "./cart";
import { CreditModal } from "./CreditModal";
import { ItemSheet } from "./ItemSheet";
import { KhataModal } from "./KhataModal";
import { PinScreen } from "./PinScreen";
import { CounterTabs, ProductGrid } from "./ProductGrid";
import { isRateStale, RatesView } from "./RatesView";
import { SideRail } from "./SideRail";
import { SplitModal } from "./SplitModal";
import { SyncBanner } from "./SyncBanner";
import { t } from "./strings";

/** Lets a catalog still being checked (items not switched on) show at the counter. Development only; never set in production. */
const SHOW_DRAFT_MENU = import.meta.env.VITE_SHOW_DRAFT_MENU === "1";

type View = "sell" | "ownerPin" | "rates";
type Sheet = { item: MenuItem; editing?: CartLine };

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
  const [device, setDevice] = useState(getDeviceLetter);
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
    return [...known, ...extra];
  }, [items, allCategories]);
  const [categoryKey, setCategoryKey] = useState<string | null>(null);
  const category = categoryKey !== null && tabs.some((c) => c.key === categoryKey) ? categoryKey : (tabs[0]?.key ?? null);
  const visibleItems = useMemo(() => (items ?? []).filter((item) => item.category === category), [items, category]);

  // --- Screen state -------------------------------------------------------
  const [view, setView] = useState<View>("sell");
  /** True while the owner is signed in only to set the rates; the till then signs back in as the counter. */
  const elevated = useRef(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
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
  const [billToShow, setBillToShow] = useState<BillInput | null>(null);

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
  const [diagnosticsVisible, setDiagnosticsVisible] = useState(false);
  useEffect(() => {
    if (!printer.printProgress) return;
    setDiagnosticsVisible(true);
    if (printer.printProgress.bytesSent < printer.printProgress.totalBytes) return;
    const timer = setTimeout(() => setDiagnosticsVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [printer.printProgress]);

  /** Prints the bill if the printer is ready; true when it came out. */
  const tryPrint = useCallback(
    async (bill: BillInput): Promise<boolean> => {
      if (printer.status !== "ready") return false;
      try {
        const { bytes, timing } = await prepareReceiptRaster(bill);
        return await printer.print(bytes, timing);
      } catch (err) {
        console.error("Receipt rendering failed", err);
        return false;
      }
    },
    [printer],
  );

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

  const editLine = (key: string) => {
    const line = cart.lines.find((l) => l.key === key);
    if (!line) return;
    setSheet({ item: items?.find((i) => i.id === line.itemId) ?? itemFromLine(line), editing: line });
  };

  const charge = async () => {
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
      const bill = toBillInput({
        orderId: created.id,
        orderNo: created.orderNo,
        device: created.device,
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
      // The sale is saved; now the paper. If the printer is missing or refuses, the bill shows on screen with a
      // Print again button, so a failed print is never a lost sale.
      if (await tryPrint(bill)) setNotice({ text: connected ? t.printed(created.label) : t.printedOffline(created.label), tone: "info" });
      else setBillToShow(bill);
    } catch (e) {
      // The cart is kept, so pressing Print bill again retries the same sale (same id, never saved twice).
      setNotice({ text: t.saleError(describeError(e)), tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const retryPrint = async () => {
    if (billToShow && (await tryPrint(billToShow))) setBillToShow(null);
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
  const labelFor = (c: Category) => categoryLabel(c.key, allCategories);

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
        {visibleItems.length === 0 ? <p className="ct-message">{t.categoryEmpty}</p> : <ProductGrid items={visibleItems} onSelect={(item) => setSheet({ item })} />}
      </div>
    );

  return (
    <div className="ct-screen">
      <SideRail logoUrl="/logo.png" rateNeeded={rateNeeded} connected={connected} waiting={waiting} stale={stale} onAdmin={() => setAdminOpen(true)} />
      <main className="ct-main">
        <SyncBanner connected={connected} outbox={outbox} stale={stale} onDismiss={dismissRefused} />
        {main}
      </main>
      <BillCart
        logoUrl="/logo.png"
        lines={cart.lines}
        totalMinor={cart.totalMinor}
        totalGrams={cart.totalGrams}
        totalPieces={cart.totalPieces}
        paymentMethod={paymentMethod}
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
        onPrintBill={charge}
      />

      {sheet && (
        <ItemSheet
          // A fresh sheet for every product or line, so it always starts from that item's own values.
          key={sheet.editing?.key ?? sheet.item.id}
          item={sheet.item}
          editing={sheet.editing}
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
          device={device}
          canSetDevice={role === "owner"}
          onDevice={(letter) => {
            setDeviceLetter(letter);
            setDevice(letter);
          }}
          onClose={() => setAdminOpen(false)}
          onKhata={() => {
            setAdminOpen(false);
            setKhataOpen(true);
          }}
          onRates={openRates}
          onPrinter={() => {
            setAdminOpen(false);
            setPrinterOpen(true);
          }}
          onLock={() => {
            setAdminOpen(false);
            onLock();
          }}
        />
      )}

      {printerOpen && (
        <PrinterSetupModal
          status={printer.status}
          error={printer.error}
          deviceName={printer.deviceName}
          platform={printer.platform}
          printerDevices={printer.printerDevices}
          onConnect={printer.connect}
          onSelectPrinter={printer.selectPrinter}
          onTestPrint={async () => {
            const { bytes, timing } = await prepareReceiptRaster(SAMPLE_BILLS[0].bill);
            await printer.print(bytes, timing);
          }}
          onClose={() => setPrinterOpen(false)}
        />
      )}

      {billToShow && <BillView bill={billToShow} canRetryPrint={printer.status === "ready"} onRetryPrint={retryPrint} onClose={() => setBillToShow(null)} />}

      {diagnosticsVisible && printer.printProgress && <PrintDiagnosticsOverlay progress={printer.printProgress} logs={printer.printLogs} />}
    </div>
  );
}
