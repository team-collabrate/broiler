import { useCallback, useEffect, useState } from "react";
import {
  findOrCreateCustomer,
  useLanguage,
  useOnlineStatus,
  type PaymentMethod,
  type SessionUser,
  type SyncStatus,
} from "@kumbakonam/shared";
import { Sidebar } from "../components/Sidebar";
import { MenuGrid } from "../components/MenuGrid";
import { CategoryTabs } from "../components/CategoryTabs";
import { CartPanel } from "../components/CartPanel";
import { PrinterSetupModal } from "../components/PrinterSetupModal";
import { PrintDiagnosticsOverlay } from "../components/PrintDiagnosticsOverlay";
import { BillView } from "../components/BillView";
import { SplitPaymentModal } from "../components/SplitPaymentModal";
import { ExpenseModal } from "../components/ExpenseModal";
import { CreditCustomerModal } from "../components/CreditCustomerModal";
import { KhataModal } from "../components/KhataModal";
import { RecentBillsModal } from "../components/RecentBillsModal";
import { useMenu } from "../hooks/useMenu";
import { useMenuCategories } from "../hooks/useMenuCategories";
import { useActiveWorkerName } from "../hooks/useActiveWorkerName";
import { useCart } from "../hooks/useCart";
import { useOrderSubmit } from "../hooks/useOrderSubmit";
import { usePrinter } from "../hooks/usePrinter";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useOutstandingCustomers } from "../hooks/useOutstandingCustomers";
import { useRecentOrders } from "../hooks/useRecentOrders";
import type { BillInput } from "../printing/receipt";
import { prepareReceiptRaster } from "../printing/receiptCanvas";
import "./WorkerHome.css";

const EXPENSE_FAILED = {
  en: "That didn't save. Check the amount and try again.",
  ta: "அது சேமிக்கப்படவில்லை. தொகையைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.",
};

export interface WorkerHomeProps {
  sessionUser: SessionUser;
  onLogout: () => void;
}

export function WorkerHome({ sessionUser, onLogout }: WorkerHomeProps) {
  const { language } = useLanguage();
  const { items, loading, error: menuError } = useMenu();
  const { categories, activeCategory, setActiveCategory, cycleCategory, visibleItems } = useMenuCategories(items);
  const [activeWorkerName, setActiveWorkerName] = useActiveWorkerName();
  const cart = useCart();
  const printer = usePrinter();
  const online = useOnlineStatus();
  const [printerSetupOpen, setPrinterSetupOpen] = useState(false);
  const [billToShow, setBillToShow] = useState<BillInput | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [expensesOpen, setExpensesOpen] = useState(false);
  // Values carried back into the form when a write is refused after the
  // dialog has already closed, so a rejected expense isn't lost in a log.
  const [expenseRetry, setExpenseRetry] = useState<{ name: string; amount: string } | null>(null);
  const [creditOpen, setCreditOpen] = useState(false);
  const [khataOpen, setKhataOpen] = useState(false);
  const [recentBillsOpen, setRecentBillsOpen] = useState(false);
  const outstanding = useOutstandingCustomers();
  const recentOrders = useRecentOrders(3);

  // PrintDiagnosticsOverlay stays up for a few seconds after a print
  // finishes (so the final KB/s reading is actually readable) rather than
  // vanishing the instant printProgress reports complete, but shouldn't
  // linger indefinitely as a stale readout once the counter's moved on.
  const [diagnosticsVisible, setDiagnosticsVisible] = useState(false);
  useEffect(() => {
    if (!printer.printProgress) return;
    setDiagnosticsVisible(true);
    if (printer.printProgress.bytesSent < printer.printProgress.totalBytes) return;
    const timer = setTimeout(() => setDiagnosticsVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [printer.printProgress]);

  const handleOrderSaved = useCallback(
    async (bill: BillInput, print: boolean) => {
      // Save was pressed, not Print — the order is already written by this
      // point (see useOrderSubmit), there's just no receipt to produce.
      if (!print) return;
      if (printer.status === "ready") {
        try {
          const { bytes, timing } = await prepareReceiptRaster(bill);
          if (await printer.print(bytes, timing)) return;
        } catch (err) {
          console.error("Receipt rendering failed", err);
        }
      }
      // Printer missing, refusing, or the render failed — hand the worker the
      // on-screen bill, which is the same artwork.
      setBillToShow(bill);
    },
    [printer],
  );

  // workerId still comes from the signed-in account (orders.workerId must
  // reference a real, active user per firestore.rules); workerName is just
  // what prints on the bill, and that's the pickable one — see
  // useActiveWorkerName.
  const orderSubmit = useOrderSubmit(cart, sessionUser.userId, activeWorkerName, handleOrderSaved);

  const syncStatus: SyncStatus = !online ? "offline" : orderSubmit.pendingCount > 0 ? "pending" : "online";

  const retryPrint = useCallback(async () => {
    if (!billToShow) return;
    const { bytes, timing } = await prepareReceiptRaster(billToShow);
    if (await printer.print(bytes, timing)) {
      setBillToShow(null);
    }
  }, [billToShow, printer]);

  const openPrinterSetup = useCallback(() => setPrinterSetupOpen(true), []);
  const openExpenses = useCallback(() => {
    setExpenseRetry(null);
    setExpensesOpen(true);
  }, []);

  const onExpenseFailed = useCallback((values: { name: string; amount: string }) => {
    setExpenseRetry(values);
    setExpensesOpen(true);
  }, []);
  // Refetches right as the picker actually opens — see
  // useOutstandingCustomers's own comment on why this isn't live anymore.
  const openKhata = useCallback(() => {
    setKhataOpen(true);
    outstanding.refresh();
  }, [outstanding]);
  const openRecentBills = useCallback(() => {
    setRecentBillsOpen(true);
    recentOrders.refresh();
  }, [recentOrders]);

  // Choosing Split is only half the decision — the amounts still have to be
  // entered, so the dialog opens straight away whether the method came from
  // the button or the S key.
  const selectPayment = useCallback(
    (method: PaymentMethod) => {
      cart.setPaymentMethod(method);
      if (method === "split") setSplitOpen(true);
      if (method === "credit") {
        setCreditOpen(true);
        outstanding.refresh();
      }
    },
    [cart, outstanding],
  );

  // A name typed for the first time becomes a customer record here, so the
  // same person is matched rather than duplicated on their next order.
  const chooseCreditCustomer = useCallback(
    async (choice: { customer?: { customerId: string; name: string }; name?: string }) => {
      if (choice.customer) {
        cart.setCreditCustomer({ customerId: choice.customer.customerId, name: choice.customer.name });
        setCreditOpen(false);
        return;
      }
      if (!choice.name) return;
      try {
        const { customerId } = await findOrCreateCustomer(choice.name);
        cart.setCreditCustomer({ customerId, name: choice.name.trim() });
        setCreditOpen(false);
      } catch (err) {
        // Looking up an existing customer needs the network. Rather than
        // invent a duplicate record offline, back out of credit entirely so
        // the worker picks a method that can't lose the debt.
        console.error("Could not open a credit account", err);
        setCreditOpen(false);
        cart.setPaymentMethod(null);
      }
    },
    [cart],
  );

  const cancelCredit = useCallback(() => {
    setCreditOpen(false);
    if (!cart.creditCustomer) cart.setPaymentMethod(null);
  }, [cart]);

  const cancelSplit = useCallback(() => {
    setSplitOpen(false);
    // Backing out of the amounts means no method was really chosen.
    cart.setPaymentMethod(null);
  }, [cart]);

  useKeyboardShortcuts({
    visibleItems,
    cart,
    orderSubmit,
    onSelectPayment: selectPayment,
    onCycleCategory: cycleCategory,
    onRequestClearCart: () => setConfirmingClear(true),
    onOpenPrinterSetup: openPrinterSetup,
    onOpenExpenses: openExpenses,
    onOpenKhata: openKhata,
  });

  return (
    <div className="worker-home" data-theme="dark">
      <Sidebar
        syncStatus={syncStatus}
        activeWorkerName={activeWorkerName}
        onChangeWorkerName={setActiveWorkerName}
        onOpenKhata={openKhata}
        onOpenExpenses={openExpenses}
        onOpenPrinterSetup={openPrinterSetup}
        onOpenRecentBills={openRecentBills}
        onLogout={onLogout}
      />

      <div className="worker-home__menu">
        {/* Logo and category tabs — one row, the row's whole width. The app
            name, the signed-in worker and the shortcut crib came off
            entirely; the tabs moved up from the grid so the menu starts at
            the top of its own scroll area with nothing floating over the
            cards. The sync status now lives at the top of the sidebar,
            where the "K" mark used to be, rather than floating over this
            row or a fixed viewport corner. */}
        <div className="worker-home__menu-header">
          <img
            className="worker-home__logo"
            src="/logo.png"
            alt="Kumbakonam Cafe"
            width={120}
            height={108}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <CategoryTabs
            categories={categories}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        </div>

        <MenuGrid
          activeCategory={activeCategory}
          visibleItems={visibleItems}
          totalItemCount={items.length}
          loading={loading}
          error={menuError}
          cartLines={cart.lines}
          onAddItem={cart.addItem}
          onIncrementItem={cart.incrementQty}
          onDecrementItem={cart.decrementQty}
        />
      </div>

      <div className="worker-home__cart">
        <CartPanel
          cart={cart}
          orderSubmit={orderSubmit}
          confirmingClear={confirmingClear}
          onCancelClear={() => setConfirmingClear(false)}
          onSelectPayment={selectPayment}
        />
      </div>

      {splitOpen && (
        <SplitPaymentModal
          total={cart.total}
          upiAmount={cart.splitUpiAmount}
          cashAmount={cart.splitCashAmount}
          onUpiAmountChange={cart.setSplitUpiAmount}
          onConfirm={() => setSplitOpen(false)}
          onCancel={cancelSplit}
        />
      )}

      {creditOpen && (
        <CreditCustomerModal
          total={cart.total}
          customers={outstanding.customers}
          loading={outstanding.loading}
          onChoose={chooseCreditCustomer}
          onCancel={cancelCredit}
        />
      )}

      {khataOpen && (
        <KhataModal
          customers={outstanding.customers}
          loading={outstanding.loading}
          workerId={sessionUser.userId}
          onClose={() => setKhataOpen(false)}
          onChanged={outstanding.refresh}
        />
      )}

      {recentBillsOpen && (
        <RecentBillsModal
          orders={recentOrders.orders}
          loading={recentOrders.loading}
          workerId={sessionUser.userId}
          onClose={() => setRecentBillsOpen(false)}
          onVoided={recentOrders.refresh}
        />
      )}

      {expensesOpen && (
        <ExpenseModal
          workerId={sessionUser.userId}
          initialName={expenseRetry?.name ?? ""}
          initialAmount={expenseRetry?.amount ?? ""}
          initialError={expenseRetry ? EXPENSE_FAILED[language] : null}
          onClose={() => {
            setExpensesOpen(false);
            setExpenseRetry(null);
          }}
          onSaved={() => {
            setExpensesOpen(false);
            setExpenseRetry(null);
          }}
          onFailed={onExpenseFailed}
        />
      )}

      {printerSetupOpen && (
        <PrinterSetupModal
          status={printer.status}
          error={printer.error}
          deviceName={printer.deviceName}
          platform={printer.platform}
          printerDevices={printer.printerDevices}
          onConnect={printer.connect}
          onSelectPrinter={printer.selectPrinter}
          onClose={() => setPrinterSetupOpen(false)}
        />
      )}

      {billToShow && (
        <BillView
          bill={billToShow}
          canRetryPrint={printer.status === "ready"}
          onRetryPrint={retryPrint}
          onClose={() => setBillToShow(null)}
        />
      )}

      {diagnosticsVisible && printer.printProgress && (
        <PrintDiagnosticsOverlay progress={printer.printProgress} logs={printer.printLogs} />
      )}
    </div>
  );
}
