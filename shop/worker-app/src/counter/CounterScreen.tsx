import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  canAddLine,
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
import { createOrder, newOrderId, subscribeCategories, subscribeMaxAdjust, subscribeMenu } from "@kumbakonam/shared/shop";
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
import { ItemSheet } from "./ItemSheet";
import { PinScreen } from "./PinScreen";
import { CounterTabs, ProductGrid } from "./ProductGrid";
import { isRateStale, RatesView } from "./RatesView";
import { SideRail } from "./SideRail";
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
  /** Signs back in as the counter after the owner is done. */
  restoreCounter: () => Promise<void>;
  /** Locks the till: back to the PIN screen. */
  onLock: () => void;
}

export function CounterScreen({ role, signInOwner, restoreCounter, onLock }: Props) {
  const cart = useCounterCart();
  const printer = usePrinter();

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
  const [submitting, setSubmitting] = useState(false);
  const [billToShow, setBillToShow] = useState<BillInput | null>(null);

  // One id per sale, kept across a failed save so a retry cannot save the sale twice. Any change to what is
  // being sold or how it is paid makes it a different sale, so it starts a new id.
  const attemptId = useRef<string | null>(null);
  const newSale = () => {
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
    setSubmitting(true);
    setNotice(null);
    try {
      const lines = cart.lines;
      attemptId.current ??= newOrderId();
      const created = await createOrder({ orderId: attemptId.current, lines, paymentMethod });
      const bill = toBillInput({
        orderId: created.id,
        orderNo: created.orderNo,
        createdAt: new Date(),
        lines,
        totalMinor: created.totalMinor,
        totalGrams: cart.totalGrams,
        totalPieces: cart.totalPieces,
        paymentMethod,
      });
      newSale();
      cart.clear();
      setPaymentMethod("cash");
      // The sale is saved; now the paper. If the printer is missing or refuses, the bill shows on screen with a
      // Print again button, so a failed print is never a lost sale.
      if (await tryPrint(bill)) setNotice({ text: t.printed(created.orderNo), tone: "info" });
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
      // Back to the counter session. If that fails (no connection), lock: the PIN screen takes over.
      restoreCounter().catch(onLock);
    }
  };
  const openRates = () => {
    setAdminOpen(false);
    if (!canEditRates) return;
    setView(role === "owner" ? "rates" : "ownerPin");
  };

  // --- Render -------------------------------------------------------------
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
      <SideRail logoUrl="/logo.png" rateNeeded={rateNeeded} onAdmin={() => setAdminOpen(true)} />
      <main className="ct-main">{main}</main>
      <BillCart
        logoUrl="/logo.png"
        lines={cart.lines}
        totalMinor={cart.totalMinor}
        totalGrams={cart.totalGrams}
        totalPieces={cart.totalPieces}
        paymentMethod={paymentMethod}
        onPaymentChange={(method) => {
          newSale();
          setPaymentMethod(method);
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

      {adminOpen && (
        <AdminMenu
          rateNeeded={rateNeeded}
          onClose={() => setAdminOpen(false)}
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
