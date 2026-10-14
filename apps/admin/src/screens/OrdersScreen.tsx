import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  adjustmentMinor,
  describeLine,
  formatLineQuantity,
  formatMoney,
  formatRate,
  formatTotals,
  PAYMENT_LABELS,
  type Order,
  type RangePreset,
} from '@broiler/shared';
import { formatDateTime, formatTime } from '../format';
import { t } from '../strings';
import { colors, spacing } from '../theme';

interface Props {
  orders: Order[];
  preset: RangePreset;
}

/** Orders newest first. Tapping one opens its lines right under it (no popup); tap again to close. */
export function OrdersScreen({ orders, preset }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <FlatList
      data={orders}
      extraData={expandedId}
      keyExtractor={(order) => order.id}
      contentContainerStyle={styles.content}
      ListEmptyComponent={<Text style={styles.empty}>{t.noOrders}</Text>}
      renderItem={({ item: order }) => {
        const expanded = order.id === expandedId;
        return (
          <View style={[styles.card, expanded && styles.cardExpanded]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={t.orderAria(order.orderNo, formatMoney(order.totalMinor))}
              onPress={() => setExpandedId(expanded ? null : order.id)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowTop}>
                <Text style={styles.orderNo}>#{order.orderNo}</Text>
                <Text style={styles.time}>
                  {preset === 'last7' ? formatDateTime(order.createdAt) : formatTime(order.createdAt)}
                </Text>
                <Text style={styles.payment}>{PAYMENT_LABELS[order.paymentMethod]}</Text>
                <Text style={styles.total}>{formatMoney(order.totalMinor)}</Text>
              </View>
              {!expanded && (
                <Text style={styles.items} numberOfLines={2}>
                  {order.lines.map((l) => `${l.name} ${formatLineQuantity(l)}`).join(', ')}
                </Text>
              )}
            </Pressable>

            {expanded && (
              <View style={styles.detail}>
                <Text style={styles.detailMeta}>
                  {formatDateTime(order.createdAt)} · {PAYMENT_LABELS[order.paymentMethod]}
                </Text>
                {order.lines.map((line, index) => (
                  <View key={`${line.itemId}-${index}`} style={styles.line}>
                    <View style={styles.lineInfo}>
                      <Text style={styles.lineName}>{line.name}</Text>
                      <Text style={styles.lineDetail}>{describeLine(line)}</Text>
                      {adjustmentMinor(line) !== 0 && (
                        <Text style={styles.lineAdjusted}>{t.listRate(formatRate(line.listRateMinor, line.unit))}</Text>
                      )}
                    </View>
                    <Text style={styles.lineTotal}>{formatMoney(line.lineTotalMinor)}</Text>
                  </View>
                ))}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{t.total(formatTotals(order.totalGrams, order.totalPieces))}</Text>
                  <Text style={styles.detailTotal}>{formatMoney(order.totalMinor)}</Text>
                </View>
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.sm },
  empty: { margin: spacing.xl, textAlign: 'center', fontSize: 15, lineHeight: 24, color: colors.muted },
  card: { borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardExpanded: { borderColor: colors.primary },
  row: { gap: spacing.xs, padding: spacing.md, borderRadius: 14 },
  rowPressed: { backgroundColor: colors.primarySoft },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  orderNo: { fontSize: 16, fontWeight: '700', color: colors.text },
  time: { flex: 1, fontSize: 13, color: colors.muted },
  payment: { fontSize: 12, lineHeight: 20, fontWeight: '600', color: colors.primary },
  total: { fontSize: 16, fontWeight: '700', color: colors.text },
  items: { fontSize: 13, color: colors.muted },
  detail: { gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  detailMeta: { fontSize: 13, lineHeight: 20, color: colors.muted, marginBottom: spacing.xs },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lineInfo: { flex: 1 },
  lineName: { fontSize: 16, fontWeight: '600', color: colors.text },
  lineDetail: { fontSize: 13, lineHeight: 20, color: colors.muted },
  lineAdjusted: { fontSize: 13, lineHeight: 20, fontWeight: '700', color: colors.warning },
  lineTotal: { fontSize: 16, fontWeight: '600', color: colors.text },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: { fontSize: 15, lineHeight: 24, color: colors.muted },
  detailTotal: { fontSize: 22, fontWeight: '800', color: colors.text },
});
