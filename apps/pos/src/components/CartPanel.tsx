import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatMoney,
  formatWeight,
  lineTotalMinor,
  PAYMENT_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
} from '@broiler/shared';
import type { CartLine } from '../hooks/useCart';
import { colors, spacing } from '../theme';

interface Props {
  lines: CartLine[];
  totalMinor: number;
  totalGrams: number;
  paymentMethod: PaymentMethod;
  submitting: boolean;
  onPaymentChange: (method: PaymentMethod) => void;
  onRemove: (itemId: string) => void;
  onCharge: () => void;
}

export function CartPanel({
  lines,
  totalMinor,
  totalGrams,
  paymentMethod,
  submitting,
  onPaymentChange,
  onRemove,
  onCharge,
}: Props) {
  const canCharge = lines.length > 0 && !submitting;

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Current sale</Text>

      <FlatList
        style={styles.list}
        data={lines}
        keyExtractor={(l) => l.itemId}
        ListEmptyComponent={<Text style={styles.empty}>Tap an item to weigh it.</Text>}
        renderItem={({ item }) => (
          <View style={styles.line}>
            <View style={styles.lineInfo}>
              <Text style={styles.lineName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.lineDetail}>
                {formatWeight(item.grams)} × {formatMoney(item.pricePerKgMinor)}/kg
              </Text>
            </View>
            <Text style={styles.lineTotal}>{formatMoney(lineTotalMinor(item.pricePerKgMinor, item.grams))}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.name}`}
              disabled={submitting}
              hitSlop={8}
              onPress={() => onRemove(item.itemId)}
              style={styles.remove}
            >
              <Text style={styles.removeText}>✕</Text>
            </Pressable>
          </View>
        )}
      />

      <View style={styles.payments}>
        {PAYMENT_METHODS.map((method) => {
          const selected = method === paymentMethod;
          return (
            <Pressable
              key={method}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              disabled={submitting}
              onPress={() => onPaymentChange(method)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{PAYMENT_LABELS[method]}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total · {formatWeight(totalGrams)}</Text>
        <Text style={styles.total}>{formatMoney(totalMinor)}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canCharge }}
        disabled={!canCharge}
        onPress={onCharge}
        style={[styles.charge, !canCharge && styles.chargeDisabled]}
      >
        <Text style={styles.chargeText}>{submitting ? 'Saving…' : `Charge ${formatMoney(totalMinor)}`}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md },
  heading: { fontSize: 18, fontWeight: '700', color: colors.text },
  list: { flex: 1 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: spacing.xl },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lineInfo: { flex: 1 },
  lineName: { fontSize: 16, fontWeight: '600', color: colors.text },
  lineDetail: { fontSize: 13, color: colors.muted },
  lineTotal: { fontSize: 16, fontWeight: '600', color: colors.text },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  removeText: { fontSize: 16, color: colors.muted },
  payments: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { fontSize: 15, fontWeight: '600', color: colors.muted },
  chipTextSelected: { color: colors.primary },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  totalLabel: { fontSize: 15, color: colors.muted },
  total: { fontSize: 28, fontWeight: '800', color: colors.text },
  charge: {
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  chargeDisabled: { backgroundColor: colors.disabled },
  chargeText: { fontSize: 18, fontWeight: '700', color: colors.onPrimary },
});
