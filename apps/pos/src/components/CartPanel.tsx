import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  describeLine,
  formatMoney,
  formatWeight,
  orderLineTotalMinor,
  PAYMENT_LABELS,
  PAYMENT_METHODS,
  type CartLine,
  type PaymentMethod,
} from '@broiler/shared';
import { colors, spacing } from '../theme';

/** A message shown in the cart column in place of a popup. */
export interface Notice {
  kind: 'saved' | 'error';
  text: string;
}

interface Props {
  lines: CartLine[];
  totalMinor: number;
  totalGrams: number;
  paymentMethod: PaymentMethod;
  submitting: boolean;
  notice: Notice | null;
  onDismissNotice: () => void;
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
  notice,
  onDismissNotice,
  onPaymentChange,
  onRemove,
  onCharge,
}: Props) {
  const canCharge = lines.length > 0 && !submitting;

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Current sale</Text>

      {notice && (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.notice, notice.kind === 'saved' ? styles.noticeSaved : styles.noticeError]}
        >
          <Text style={styles.noticeText}>
            {notice.kind === 'saved' ? '✓ ' : 'Could not save the sale: '}
            {notice.text}
          </Text>
          {notice.kind === 'error' && (
            <Pressable accessibilityRole="button" onPress={onCharge} disabled={!canCharge} style={styles.noticeAction}>
              <Text style={styles.noticeActionText}>Retry</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={8} onPress={onDismissNotice} style={styles.noticeClose}>
            <Text style={styles.noticeCloseText}>✕</Text>
          </Pressable>
        </View>
      )}

      <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {lines.length === 0 ? (
          <Text style={styles.empty}>Add an item to start a sale.</Text>
        ) : (
          lines.map((line) => (
            <View key={line.itemId} style={styles.line}>
              <View style={styles.lineInfo}>
                <Text style={styles.lineName} numberOfLines={1}>
                  {line.name}
                </Text>
                <Text style={styles.lineDetail}>{describeLine(line)}</Text>
              </View>
              <Text style={styles.lineTotal}>{formatMoney(orderLineTotalMinor(line))}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${line.name}`}
                disabled={submitting}
                hitSlop={8}
                onPress={() => onRemove(line.itemId)}
                style={styles.remove}
              >
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

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
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 12 },
  noticeSaved: { backgroundColor: '#E4F3EA' },
  noticeError: { backgroundColor: colors.primarySoft },
  noticeText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  noticeAction: {
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  noticeActionText: { fontSize: 15, fontWeight: '700', color: colors.onPrimary },
  noticeClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  noticeCloseText: { fontSize: 16, color: colors.muted },
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
  remove: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  removeText: { fontSize: 18, color: colors.muted },
  payments: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    height: 48,
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
