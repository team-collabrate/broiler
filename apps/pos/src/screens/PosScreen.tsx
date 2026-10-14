import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  canAddLine,
  createOrder,
  describeError,
  newOrderId,
  normalizeMethods,
  PinScreen,
  type Category,
  type CartLine,
  type MenuItem,
  type OrderLineInput,
  type PaymentMethod,
  type Role,
} from '@broiler/shared';
import type { BillData } from '../bill';
import { BillPrint } from '../components/BillPrint';
import { CartPanel } from '../components/CartPanel';
import { CategoryTabs } from '../components/CategoryTabs';
import { AdminMenu } from '../components/AdminMenu';
import { BillModal } from '../components/BillModal';
import { ItemSheet } from '../components/ItemSheet';
import { SideRail, RAIL_WIDTH } from '../components/SideRail';
import { gridColumns, ProductGrid } from '../components/ProductGrid';
import { isRateStale, RatesPanel } from '../components/RatesPanel';
import { useCart } from '../hooks/useCart';
import { useMaxAdjust } from '../hooks/useMaxAdjust';
import { useCategories, useMenu } from '../hooks/useMenu';
import { LOGO } from '../images.generated';
import { t } from '../strings';
import { colors, spacing } from '../theme';

/** Catalog beside the cart from tablet widths up; one scrolling page below that. */
const WIDE_BREAKPOINT = 720;

/** Four products per row on a tablet, however wide the screen: big enough to tap, and the same on every screen. */
const MAX_COLUMNS = 4;

/** Lets a catalog still being drafted (items not switched on) show at the counter, for checking. Never set in production. */
const SHOW_DRAFT_MENU = process.env.EXPO_PUBLIC_SHOW_DRAFT_MENU === '1';

type Screen = 'sell' | 'ownerPin' | 'rates';

interface Props {
  role: Role;
  /** Signs in as the owner (to set today's rates). Rejects on a wrong PIN. */
  signInOwner: (pin: string) => Promise<void>;
  /** Signs back in as the counter after the owner is done. */
  restoreCounter: () => Promise<void>;
  /** Locks the till: back to the PIN screen. */
  onLock: () => void;
}

/** What the product sheet is open for: a product to add, or a cart line to edit. */
type SheetTarget = { item: MenuItem; editing?: CartLine };

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

export function PosScreen({ role, signInOwner, restoreCounter, onLock }: Props) {
  const allCategories = useCategories();
  const { items, error } = useMenu(allCategories, SHOW_DRAFT_MENU);
  const maxAdjustMinor = useMaxAdjust();
  const cart = useCart();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  // Columns come from the window width less the cart column and the page padding, so they never depend on
  // whether a scrollbar is showing (see gridColumns).
  const cartWidth = Math.min(420, Math.max(340, Math.round(width * 0.3)));
  const columns = wide ? gridColumns(width - RAIL_WIDTH - cartWidth - 2 * spacing.lg, MAX_COLUMNS) : 2;

  const [view, setView] = useState<Screen>('sell');
  // True while the owner is signed in only to set the rates; the till then signs back in as the counter.
  const elevated = useRef(false);

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

  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [adminOpen, setAdminOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [submitting, setSubmitting] = useState(false);
  /** The bill of the sale just saved; the checkout popup shows it. */
  const [bill, setBill] = useState<BillData | null>(null);

  // One id per sale, kept across a failed save so a retry cannot save the sale twice. Any change to
  // what is being sold or how it is paid makes it a different sale, so it starts a new id.
  const attemptId = useRef<string | null>(null);
  const newSale = () => {
    attemptId.current = null;
  };

  // Prompt for the daily rate until every item has been set (or confirmed) today.
  const rateNeeded = items !== null && items.some((item) => isRateStale(item));
  const canEditRates = items !== null && items.length > 0;

  const confirmSheet = (line: OrderLineInput) => {
    if (!sheet) return;
    if (sheet.editing) {
      cart.replace(sheet.editing.key, line);
    } else if (!canAddLine(cart.lines, line)) {
      setNotice(t.tooManyLines);
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
      setBill({
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
    } catch (e) {
      // The cart is kept, so pressing Print bill again retries the same sale (same id, never twice).
      setNotice(t.saleError(describeError(e)));
    } finally {
      setSubmitting(false);
    }
  };

  const closeBill = () => {
    setBill(null);
    setPaymentMethod('cash');
  };

  const catalog = error ? (
    <Text style={styles.message}>{t.menuError(error)}</Text>
  ) : items === null ? (
    <ActivityIndicator style={styles.loading} color={colors.primary} />
  ) : items.length === 0 ? (
    <Text style={styles.message}>{t.menuEmpty}</Text>
  ) : (
    <View style={styles.catalog}>
      <CategoryTabs categories={tabs} selected={category} onSelect={setCategoryKey} />
      {visibleItems.length === 0 ? (
        <Text style={styles.message}>{t.categoryEmpty}</Text>
      ) : (
        <ProductGrid items={visibleItems} columns={columns} onSelect={(item) => setSheet({ item })} />
      )}
    </View>
  );

  const cartPanel = (
    <CartPanel
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
  );

  // Changing a rate is the owner's job: the counter is asked for the owner's PIN, on the page, before
  // the rates view opens. Signing in as the owner is what lets the server accept the change.
  const ownerPin = (
    <PinScreen
      logo={LOGO}
      title={t.ownerPinTitle}
      subtitle={t.ownerPinSubtitle}
      onSubmit={async (pin) => {
        await signInOwner(pin);
        elevated.current = role !== 'owner';
        setView('rates');
      }}
      onCancel={() => setView('sell')}
    />
  );

  const leaveRates = () => {
    setView('sell');
    if (elevated.current) {
      elevated.current = false;
      // Back to the counter session. If that fails (no connection), lock: the PIN screen takes over.
      restoreCounter().catch(onLock);
    }
  };

  const toggleRates = () => {
    if (view !== 'sell') return leaveRates();
    if (role === 'owner') return setView('rates');
    setView('ownerPin');
  };

  const ratesActive = rateNeeded || view !== 'sell';

  const main =
    view === 'ownerPin' ? (
      ownerPin
    ) : view === 'rates' ? (
      <RatesPanel items={items ?? []} onClose={leaveRates} />
    ) : (
      <ScrollView contentContainerStyle={styles.mainContent}>{catalog}</ScrollView>
    );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      {wide ? (
        <View style={styles.bodyWide}>
          <SideRail rateNeeded={rateNeeded} onAdmin={() => setAdminOpen(true)} />
          <View style={styles.mainWide}>{main}</View>
          <View style={[styles.cartWide, { width: cartWidth }]}>{cartPanel}</View>
        </View>
      ) : (
        <View style={styles.bodyNarrow}>
          {/* On a phone the rail becomes a slim bar across the top. */}
          <View style={styles.topBar}>
            {LOGO ? <Image source={LOGO} style={styles.topLogo} resizeMode="contain" accessibilityLabel={t.appTitle} /> : null}
            <Text style={styles.topTitle} numberOfLines={1}>
              {t.appTitle}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t.admin} onPress={() => setAdminOpen(true)} style={styles.topAdmin}>
              <Text style={styles.adminText}>{t.adminShort}</Text>
              {rateNeeded && <View style={styles.topDot} />}
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.page}>
            {view === 'sell' ? <View style={styles.mainContent}>{catalog}</View> : <View style={styles.pageOverlay}>{main}</View>}
            <View style={styles.cartNarrow}>{cartPanel}</View>
          </ScrollView>
        </View>
      )}

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

      {bill && <BillModal bill={bill} onDone={closeBill} />}

      {adminOpen && (
        <AdminMenu
          rateNeeded={rateNeeded}
          onClose={() => setAdminOpen(false)}
          onLock={() => {
            setAdminOpen(false);
            onLock();
          }}
          onRates={() => {
            setAdminOpen(false);
            if (canEditRates) toggleRates();
          }}
        />
      )}

      {/* The print-only copy of the bill (web only; renders nothing on the tablet app). */}
      <BillPrint bill={bill} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  bodyWide: { flex: 1, flexDirection: 'row' },
  bodyNarrow: { flex: 1 },
  mainWide: { flex: 1 },
  mainContent: { padding: spacing.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  topLogo: { width: 36, height: 44 },
  topTitle: { flex: 1, fontSize: 18, lineHeight: 28, fontWeight: '800', color: colors.primary },
  topAdmin: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.primary },
  topDot: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.warning, borderWidth: 2, borderColor: colors.surface },
  catalog: { gap: spacing.md },
  cartWide: { borderLeftWidth: 1, borderLeftColor: colors.border },

  page: { paddingBottom: spacing.lg },
  pageOverlay: { minHeight: 640 },
  cartNarrow: { height: 480, borderTopWidth: 1, borderTopColor: colors.border },

  adminText: { fontSize: 15, lineHeight: 24, fontWeight: '800', color: colors.primary },
  loading: { marginTop: spacing.xl },
  message: { margin: spacing.lg, fontSize: 15, lineHeight: 24, color: colors.muted },
});
