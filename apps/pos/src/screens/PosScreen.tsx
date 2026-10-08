import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createOrder, formatMoney, type CreatedOrder, type MenuItem, type PaymentMethod } from '@broiler/shared';
import { CartPanel } from '../components/CartPanel';
import { MenuGrid } from '../components/MenuGrid';
import { WeightPad } from '../components/WeightPad';
import { useCart } from '../hooks/useCart';
import { useMenu } from '../hooks/useMenu';
import { colors, spacing } from '../theme';

/** Side-by-side menu and cart from tablet widths up; stacked on a phone. */
const WIDE_BREAKPOINT = 720;

export function PosScreen() {
  const { items, error } = useMenu();
  const cart = useCart();
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState<CreatedOrder | null>(null);

  const addToCart = (item: MenuItem, grams: number) => {
    cart.add({ itemId: item.id, name: item.name, pricePerKgMinor: item.pricePerKgMinor, grams });
    setSelected(null);
  };

  const charge = async () => {
    if (submitting || cart.lines.length === 0) return;
    setSubmitting(true);
    try {
      const created = await createOrder({ lines: cart.lines, paymentMethod });
      cart.clear();
      setPaymentMethod('cash');
      setSaved(created);
    } catch (e) {
      // The cart is kept so the sale can be retried once the problem is fixed.
      Alert.alert('Could not save the sale', e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Broiler POS</Text>
      </View>

      <View style={[styles.body, wide && styles.bodyWide]}>
        <View style={wide ? styles.menuWide : styles.menu}>
          {error ? (
            <Text style={styles.message}>Could not load the menu: {error}</Text>
          ) : items === null ? (
            <ActivityIndicator style={styles.loading} color={colors.primary} />
          ) : items.length === 0 ? (
            <Text style={styles.message}>
              No menu items yet. Add them in Firestore (collection “menu”) or run the seed script. See the README.
            </Text>
          ) : (
            <MenuGrid items={items} columns={wide ? 3 : 2} onSelect={setSelected} />
          )}
        </View>

        <View style={wide ? styles.cartWide : styles.cart}>
          <CartPanel
            lines={cart.lines}
            totalMinor={cart.totalMinor}
            totalGrams={cart.totalGrams}
            paymentMethod={paymentMethod}
            submitting={submitting}
            onPaymentChange={setPaymentMethod}
            onRemove={cart.remove}
            onCharge={charge}
          />
        </View>
      </View>

      <WeightPad item={selected} onAdd={addToCart} onCancel={() => setSelected(null)} />

      <Modal visible={saved !== null} transparent animationType="fade" onRequestClose={() => setSaved(null)}>
        <View style={styles.backdrop}>
          {saved && (
            <View style={styles.receipt}>
              <Text style={styles.receiptCheck}>✓</Text>
              <Text style={styles.receiptTitle}>Sale saved</Text>
              <Text style={styles.receiptOrder}>Order #{saved.orderNo}</Text>
              <Text style={styles.receiptTotal}>{formatMoney(saved.totalMinor)}</Text>
              <Pressable accessibilityRole="button" onPress={() => setSaved(null)} style={styles.receiptButton}>
                <Text style={styles.receiptButtonText}>New sale</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.primary },
  body: { flex: 1 },
  bodyWide: { flexDirection: 'row' },
  menu: { flex: 3 },
  menuWide: { flex: 3 },
  cart: { flex: 2, borderTopWidth: 1, borderTopColor: colors.border },
  cartWide: { flex: 2, maxWidth: 420, borderLeftWidth: 1, borderLeftColor: colors.border },
  loading: { marginTop: spacing.xl },
  message: { margin: spacing.lg, fontSize: 15, lineHeight: 22, color: colors.muted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  receipt: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  receiptCheck: { fontSize: 40, fontWeight: '800', color: colors.success },
  receiptTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  receiptOrder: { fontSize: 16, color: colors.muted },
  receiptTotal: { fontSize: 32, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  receiptButton: {
    alignSelf: 'stretch',
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  receiptButtonText: { fontSize: 16, fontWeight: '700', color: colors.onPrimary },
});
