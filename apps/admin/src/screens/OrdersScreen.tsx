import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatMoney, formatWeight, PAYMENT_LABELS, type Order, type RangePreset } from '@broiler/shared';
import { OrderDetailModal } from '../components/OrderDetailModal';
import { formatDateTime, formatTime } from '../format';
import { colors, spacing } from '../theme';

interface Props {
  orders: Order[];
  preset: RangePreset;
}

export function OrdersScreen({ orders, preset }: Props) {
  const [selected, setSelected] = useState<Order | null>(null);

  return (
    <>
      <FlatList
        data={orders}
        keyExtractor={(order) => order.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={<Text style={styles.empty}>No orders in this period yet.</Text>}
        renderItem={({ item: order }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Order ${order.orderNo}, ${formatMoney(order.totalMinor)}`}
            onPress={() => setSelected(order)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.rowTop}>
              <Text style={styles.orderNo}>#{order.orderNo}</Text>
              <Text style={styles.time}>{preset === 'last7' ? formatDateTime(order.createdAt) : formatTime(order.createdAt)}</Text>
              <Text style={styles.payment}>{PAYMENT_LABELS[order.paymentMethod]}</Text>
              <Text style={styles.total}>{formatMoney(order.totalMinor)}</Text>
            </View>
            <Text style={styles.items} numberOfLines={2}>
              {order.lines.map((l) => `${l.name} ${formatWeight(l.grams)}`).join(', ')}
            </Text>
          </Pressable>
        )}
      />
      <OrderDetailModal order={selected} onClose={() => setSelected(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.sm },
  empty: { margin: spacing.xl, textAlign: 'center', fontSize: 15, color: colors.muted },
  row: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.primarySoft },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  orderNo: { fontSize: 16, fontWeight: '700', color: colors.text },
  time: { flex: 1, fontSize: 13, color: colors.muted },
  payment: { fontSize: 12, fontWeight: '600', color: colors.primary },
  total: { fontSize: 16, fontWeight: '700', color: colors.text },
  items: { fontSize: 13, color: colors.muted },
});
