import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatMoney, formatWeight, PAYMENT_LABELS, type Order } from '@broiler/shared';
import { formatDateTime } from '../format';
import { colors, spacing } from '../theme';

interface Props {
  order: Order | null;
  onClose: () => void;
}

export function OrderDetailModal({ order, onClose }: Props) {
  return (
    <Modal visible={order !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {order && (
          <View style={styles.card}>
            <Text style={styles.title}>Order #{order.orderNo}</Text>
            <Text style={styles.meta}>
              {formatDateTime(order.createdAt)} · {PAYMENT_LABELS[order.paymentMethod]}
            </Text>

            <ScrollView style={styles.lines}>
              {order.lines.map((line) => (
                <View key={line.itemId} style={styles.line}>
                  <View style={styles.lineInfo}>
                    <Text style={styles.lineName}>{line.name}</Text>
                    <Text style={styles.lineDetail}>
                      {formatWeight(line.grams)} × {formatMoney(line.pricePerKgMinor)}/kg
                    </Text>
                  </View>
                  <Text style={styles.lineTotal}>{formatMoney(line.lineTotalMinor)}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total · {formatWeight(order.totalGrams)}</Text>
              <Text style={styles.total}>{formatMoney(order.totalMinor)}</Text>
            </View>

            <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  meta: { fontSize: 14, color: colors.muted, marginBottom: spacing.sm },
  lines: { flexGrow: 0 },
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
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.sm },
  totalLabel: { fontSize: 15, color: colors.muted },
  total: { fontSize: 26, fontWeight: '800', color: colors.text },
  close: {
    height: 48,
    marginTop: spacing.sm,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  closeText: { fontSize: 16, fontWeight: '700', color: colors.onPrimary },
});
