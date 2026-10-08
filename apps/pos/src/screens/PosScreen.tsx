import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createOrder, formatMoney, type MenuItem, type PaymentMethod } from '@broiler/shared';
import { CartPanel, type Notice } from '../components/CartPanel';
import { MenuGrid } from '../components/MenuGrid';
import { isRateStale, RatesPanel } from '../components/RatesPanel';
import { SalePanel, type SaleChoice } from '../components/SalePanel';
import { useCart } from '../hooks/useCart';
import { useMenu } from '../hooks/useMenu';
import { colors, spacing } from '../theme';

/** Items and sale panel beside the cart from tablet widths up; one scrolling page below that. */
const WIDE_BREAKPOINT = 720;
/** How long the "Order saved" banner stays before it clears itself. */
const SAVED_NOTICE_MS = 6000;

type Screen = 'sell' | 'rates';

export function PosScreen() {
  const { items, error } = useMenu();
  const cart = useCart();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  const [view, setView] = useState<Screen>('sell');
  // Keep only the id and look the item up each render, so a rate change shows in the open panel.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items?.find((item) => item.id === selectedId) ?? null;
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Always have an item selected, so the three sale controls are on screen and never empty.
  useEffect(() => {
    if (items && items.length > 0 && !items.some((item) => item.id === selectedId)) setSelectedId(items[0].id);
  }, [items, selectedId]);

  // A saved-order banner clears itself; an error stays until dismissed or retried.
  useEffect(() => {
    if (notice?.kind !== 'saved') return;
    const timer = setTimeout(() => setNotice(null), SAVED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // Prompt for the daily rate until every type has been set (or confirmed) today.
  const rateNeeded = items !== null && items.some((item) => isRateStale(item));
  const canEditRates = items !== null && items.length > 0;

  const addToCart = (item: MenuItem, sale: SaleChoice) => {
    cart.add({ itemId: item.id, name: item.name, pricePerKgMinor: item.pricePerKgMinor, ...sale });
  };

  const charge = async () => {
    if (submitting || cart.lines.length === 0) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const created = await createOrder({ lines: cart.lines, paymentMethod });
      cart.clear();
      setPaymentMethod('cash');
      setNotice({ kind: 'saved', text: `Order #${created.orderNo} saved · ${formatMoney(created.totalMinor)}` });
    } catch (e) {
      // The cart is kept, so the sale can be retried once the problem is fixed.
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const menu = error ? (
    <Text style={styles.message}>Could not load the menu: {error}</Text>
  ) : items === null ? (
    <ActivityIndicator style={styles.loading} color={colors.primary} />
  ) : items.length === 0 ? (
    <Text style={styles.message}>
      No menu items yet. Add them in Firestore (collection “menu”) or run the seed script. See the README.
    </Text>
  ) : (
    <MenuGrid items={items} columns={wide ? 5 : 2} selectedId={selectedId} onSelect={(item) => setSelectedId(item.id)} />
  );

  const salePanel = selected && <SalePanel key={selected.id} item={selected} wide={wide} onAdd={addToCart} />;

  const cartPanel = (
    <CartPanel
      lines={cart.lines}
      totalMinor={cart.totalMinor}
      totalGrams={cart.totalGrams}
      paymentMethod={paymentMethod}
      submitting={submitting}
      notice={notice}
      onDismissNotice={() => setNotice(null)}
      onPaymentChange={setPaymentMethod}
      onRemove={cart.remove}
      onCharge={charge}
    />
  );

  const ratesActive = rateNeeded || view === 'rates';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Broiler POS</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={rateNeeded ? 'Set today’s rate. Not set yet today' : 'Set today’s rate'}
          disabled={!canEditRates}
          onPress={() => setView((v) => (v === 'rates' ? 'sell' : 'rates'))}
          style={({ pressed }) => [
            styles.rateButton,
            ratesActive && styles.rateButtonNeeded,
            !canEditRates && styles.rateButtonDisabled,
            pressed && styles.rateButtonPressed,
          ]}
        >
          <Text style={[styles.rateButtonText, ratesActive && styles.rateButtonTextNeeded]}>Today’s rate</Text>
          {rateNeeded && <View style={styles.rateDot} />}
        </Pressable>
      </View>

      {wide ? (
        <View style={styles.bodyWide}>
          <View style={styles.mainWide}>
            {view === 'rates' ? (
              <RatesPanel items={items ?? []} onClose={() => setView('sell')} />
            ) : (
              <>
                {/* At most two rows of items show here; more scroll, so the panel keeps its room. */}
                <ScrollView style={styles.menuWide} contentContainerStyle={styles.menuWideContent}>
                  {menu}
                </ScrollView>
                {salePanel}
              </>
            )}
          </View>
          <View style={[styles.cartWide, { width: Math.min(400, Math.max(340, Math.round(width * 0.32))) }]}>{cartPanel}</View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.page}>
          {view === 'rates' ? (
            <View style={styles.ratesNarrow}>
              <RatesPanel items={items ?? []} onClose={() => setView('sell')} />
            </View>
          ) : (
            <>
              <View style={styles.menuNarrow}>{menu}</View>
              <View style={styles.saleNarrow}>{salePanel}</View>
            </>
          )}
          <View style={styles.cartNarrow}>{cartPanel}</View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.primary },
  rateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rateButtonNeeded: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  rateButtonDisabled: { opacity: 0.5 },
  rateButtonPressed: { backgroundColor: colors.primarySoft },
  rateButtonText: { fontSize: 15, fontWeight: '700', color: colors.text },
  rateButtonTextNeeded: { color: colors.primary },
  rateDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },

  bodyWide: { flex: 1, flexDirection: 'row' },
  mainWide: { flex: 1 },
  menuWide: { flexGrow: 0, flexShrink: 1, maxHeight: 184 },
  menuWideContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xs },
  cartWide: { borderLeftWidth: 1, borderLeftColor: colors.border },

  page: { paddingBottom: spacing.lg },
  menuNarrow: { padding: spacing.lg },
  saleNarrow: { minHeight: 700 },
  ratesNarrow: { minHeight: 640 },
  cartNarrow: { height: 440, borderTopWidth: 1, borderTopColor: colors.border },

  loading: { marginTop: spacing.xl },
  message: { margin: spacing.lg, fontSize: 15, lineHeight: 22, color: colors.muted },
});
