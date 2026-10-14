import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  adjustmentMinor,
  describeLine,
  formatMoney,
  formatRate,
  formatTotals,
  orderLineTotalMinor,
  PAYMENT_LABELS,
  type CartLine,
  type PaymentMethod,
} from '@broiler/shared';
import { t } from '../strings';
import { colors, spacing } from '../theme';

/**
 * The four payment buttons in the order of the counter sketch: cash and UPI, then kadan (credit)
 * and split. Cash and UPI work today; kadan and split need customer accounts and a two-way amount
 * entry that are not built yet, so they are drawn but switched off.
 */
const PAYMENT_GRID: { method: PaymentMethod | null; label: string }[] = [
  { method: 'cash', label: PAYMENT_LABELS.cash },
  { method: 'upi', label: PAYMENT_LABELS.upi },
  { method: null, label: t.payCredit },
  { method: null, label: t.paySplit },
];

interface Props {
  lines: CartLine[];
  totalMinor: number;
  totalGrams: number;
  totalPieces: number;
  paymentMethod: PaymentMethod;
  onPaymentChange: (method: PaymentMethod) => void;
  submitting: boolean;
  /** A short message above the list: the order is full, or the last save failed. */
  notice: string | null;
  onDismissNotice: () => void;
  onEdit: (key: string) => void;
  onRemove: (key: string) => void;
  /** Saves the sale, then shows the bill to print. */
  onPrintBill: () => void;
}

/**
 * The cart column, laid out as the counter sketch: the bill so far on top, then Print bill, then
 * the payment buttons. Each line shows what was sold, its rate and total, with Edit (reopens the
 * product sheet with the line's values) and Remove.
 */
export function CartPanel({
  lines,
  totalMinor,
  totalGrams,
  totalPieces,
  paymentMethod,
  onPaymentChange,
  submitting,
  notice,
  onDismissNotice,
  onEdit,
  onRemove,
  onPrintBill,
}: Props) {
  const canPrint = lines.length > 0 && !submitting;

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>{t.currentSale}</Text>

      {notice && (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t.dismiss} hitSlop={8} onPress={onDismissNotice} style={styles.noticeClose}>
            <Text style={styles.noticeCloseText}>✕</Text>
          </Pressable>
        </View>
      )}

      <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {lines.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t.cartEmpty}</Text>
            <Text style={styles.emptyHint}>{t.cartEmptyHint}</Text>
          </View>
        ) : (
          lines.map((line) => {
            const adjusted = adjustmentMinor(line);
            return (
              <View key={line.key} style={styles.line}>
                <View style={styles.lineInfo}>
                  <Text style={styles.lineName} numberOfLines={2}>
                    {line.name}
                  </Text>
                  <Text style={styles.lineDetail}>{describeLine(line)}</Text>
                  {adjusted !== 0 && (
                    <Text style={styles.lineAdjusted}>
                      {t.listRate(formatRate(line.listRateMinor, line.unit))} · {adjusted > 0 ? '+' : '−'}
                      {formatMoney(Math.abs(adjusted))}
                    </Text>
                  )}
                </View>
                <Text style={styles.lineTotal}>{formatMoney(orderLineTotalMinor(line))}</Text>
                <View style={styles.lineActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel={t.edit(line.name)} disabled={submitting} onPress={() => onEdit(line.key)} style={styles.iconButton}>
                    <Text style={styles.editText}>✎</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t.remove(line.name)} disabled={submitting} onPress={() => onRemove(line.key)} style={styles.iconButton}>
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>{t.total(formatTotals(totalGrams, totalPieces))}</Text>
        <Text style={styles.total}>{formatMoney(totalMinor)}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canPrint }}
        disabled={!canPrint}
        onPress={onPrintBill}
        style={[styles.printBill, !canPrint && styles.printBillDisabled]}
      >
        <Text style={styles.printBillText}>{submitting ? t.saving : t.printBill(formatMoney(totalMinor))}</Text>
      </Pressable>

      <View style={styles.payments} accessibilityRole="radiogroup" accessibilityLabel={t.payWith}>
        {PAYMENT_GRID.map(({ method, label }) => {
          const available = method !== null;
          const selected = available && method === paymentMethod;
          return (
            <Pressable
              key={label}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: !available || submitting }}
              disabled={!available || submitting}
              onPress={() => method && onPaymentChange(method)}
              style={[styles.chip, selected && styles.chipSelected, !available && styles.chipOff]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
              {!available && <Text style={styles.chipSoon}>{t.comingSoon}</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md },
  heading: { fontSize: 22, lineHeight: 32, fontWeight: '800', color: colors.primary },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 12, backgroundColor: colors.warningSoft },
  noticeText: { flex: 1, fontSize: 15, lineHeight: 24, fontWeight: '600', color: colors.text },
  noticeClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  noticeCloseText: { fontSize: 16, color: colors.muted },
  list: { flex: 1 },
  empty: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.xl },
  emptyTitle: { fontSize: 17, lineHeight: 26, fontWeight: '700', color: colors.text },
  emptyHint: { fontSize: 14, lineHeight: 22, color: colors.muted },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  lineInfo: { flex: 1 },
  lineName: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.text },
  lineDetail: { fontSize: 13, lineHeight: 20, color: colors.muted },
  lineAdjusted: { fontSize: 13, lineHeight: 20, fontWeight: '700', color: colors.warning },
  lineTotal: { fontSize: 16, fontWeight: '800', color: colors.text },
  lineActions: { flexDirection: 'row' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  editText: { fontSize: 20, color: colors.primary },
  removeText: { fontSize: 18, color: colors.muted },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  totalLabel: { flexShrink: 1, fontSize: 15, lineHeight: 24, color: colors.muted },
  total: { fontSize: 30, lineHeight: 40, fontWeight: '800', color: colors.text },
  printBill: { height: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  printBillDisabled: { backgroundColor: colors.disabled },
  printBillText: { fontSize: 19, lineHeight: 28, fontWeight: '800', color: colors.onPrimary },
  payments: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexBasis: '47%', flexGrow: 1, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipOff: { opacity: 0.5 },
  chipText: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: colors.muted },
  chipTextSelected: { color: colors.primary },
  chipSoon: { fontSize: 11, lineHeight: 14, color: colors.muted },
});
