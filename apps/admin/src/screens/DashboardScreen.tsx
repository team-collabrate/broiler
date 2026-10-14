import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  categoryLabel,
  formatMoney,
  formatQty,
  formatWeight,
  PAYMENT_LABELS,
  PAYMENT_METHODS,
  summarizeOrders,
  type Order,
} from '@broiler/shared';
import { t } from '../strings';
import { colors, spacing } from '../theme';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function DashboardScreen({ orders }: { orders: Order[] }) {
  const summary = useMemo(() => summarizeOrders(orders), [orders]);

  if (summary.orderCount === 0) {
    return <Text style={styles.empty}>{t.noSales}</Text>;
  }

  const average = Math.round(summary.totalMinor / summary.orderCount);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>{t.totalSales}</Text>
        <Text style={styles.heroValue}>{formatMoney(summary.totalMinor)}</Text>
      </View>

      <View style={styles.statRow}>
        <Stat label={t.orders} value={String(summary.orderCount)} />
        {summary.totalGrams > 0 && <Stat label={t.weightSold} value={formatWeight(summary.totalGrams)} />}
        {summary.totalPieces > 0 && <Stat label={t.piecesSold} value={formatQty(summary.totalPieces)} />}
        <Stat label={t.avgOrder} value={formatMoney(average)} />
      </View>

      <Text style={styles.sectionTitle}>{t.byPayment}</Text>
      <View style={styles.card}>
        {PAYMENT_METHODS.map((method) => (
          <View key={method} style={styles.row}>
            <Text style={styles.rowLabel}>{PAYMENT_LABELS[method]}</Text>
            <Text style={styles.rowValue}>{formatMoney(summary.byPayment[method])}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>{t.byCategory}</Text>
      <View style={styles.card}>
        {summary.byCategory.map((c) => (
          <View key={c.category} style={styles.row}>
            <Text style={styles.rowLabel}>{categoryLabel(c.category)}</Text>
            <Text style={styles.rowValue}>{formatMoney(c.totalMinor)}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>{t.itemsSold}</Text>
      <View style={styles.card}>
        {summary.byItem.map((item) => (
          <View key={item.itemId} style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.rowHint}>{item.unit === 'piece' ? formatQty(item.qty) : formatWeight(item.grams)}</Text>
            </View>
            <Text style={styles.rowValue}>{formatMoney(item.totalMinor)}</Text>
          </View>
        ))}
      </View>

      {summary.adjustedLines > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t.priceChanges}</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t.adjustedLines(summary.adjustedLines)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t.adjustedEffect(formatMoney(summary.adjustmentTotalMinor))}</Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  empty: { margin: spacing.xl, textAlign: 'center', fontSize: 15, lineHeight: 24, color: colors.muted },
  hero: { padding: spacing.xl, borderRadius: 18, backgroundColor: colors.primary },
  heroLabel: { fontSize: 14, lineHeight: 22, color: colors.primarySoft },
  heroValue: { fontSize: 38, fontWeight: '800', color: colors.onPrimary },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: { fontSize: 13, lineHeight: 20, color: colors.muted },
  statValue: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  sectionTitle: { fontSize: 16, lineHeight: 26, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  card: { borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowInfo: { flex: 1 },
  rowLabel: { flex: 1, fontSize: 15, lineHeight: 24, fontWeight: '600', color: colors.text },
  rowHint: { fontSize: 13, color: colors.muted },
  rowValue: { fontSize: 15, fontWeight: '600', color: colors.text },
});
