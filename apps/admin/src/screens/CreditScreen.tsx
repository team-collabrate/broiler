import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatMoney, PAYMENT_LABELS, type RangePreset } from '@broiler/shared';
import { formatDateTime } from '../format';
import { useCredit } from '../hooks/useCredit';
import { t } from '../strings';
import { colors, spacing } from '../theme';

/** Who owes what right now, and the money that came back in the chosen period. Owner only: the rules refuse anyone else. */
export function CreditScreen({ preset }: { preset: RangePreset }) {
  const { customers, payments, error } = useCredit(preset);

  if (error) return <Text style={styles.message}>{t.loadError(error)}</Text>;
  if (customers === null || payments === null) return <ActivityIndicator style={styles.loading} color={colors.primary} />;

  const totalOwed = customers.reduce((sum, c) => sum + c.balanceMinor, 0);
  const received = payments.reduce((sum, p) => sum + p.amountMinor, 0);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>{t.totalOwed}</Text>
        <Text style={styles.heroValue}>{formatMoney(totalOwed)}</Text>
      </View>

      <Text style={styles.sectionTitle}>{t.owingNow}</Text>
      <View style={styles.card}>
        {customers.length === 0 ? (
          <Text style={styles.empty}>{t.nobodyOwes}</Text>
        ) : (
          customers.map((c) => (
            <View key={c.id} style={styles.row}>
              <Text style={styles.rowLabel} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={styles.rowValue}>{formatMoney(c.balanceMinor)}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>
        {t.paymentsReceived} · {formatMoney(received)}
      </Text>
      <View style={styles.card}>
        {payments.length === 0 ? (
          <Text style={styles.empty}>{t.noPayments}</Text>
        ) : (
          payments.map((p) => (
            <View key={p.id} style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {p.customerName}
                </Text>
                <Text style={styles.rowHint}>
                  {formatDateTime(p.createdAt)} · {PAYMENT_LABELS[p.method]}
                </Text>
              </View>
              <Text style={styles.rowValue}>{formatMoney(p.amountMinor)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  message: { margin: spacing.lg, fontSize: 15, lineHeight: 22, color: colors.muted },
  loading: { marginTop: spacing.xl },
  hero: { padding: spacing.xl, borderRadius: 18, backgroundColor: colors.primary },
  heroLabel: { fontSize: 14, lineHeight: 22, color: colors.primarySoft },
  heroValue: { fontSize: 38, fontWeight: '800', color: colors.onPrimary },
  sectionTitle: { fontSize: 16, lineHeight: 26, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  card: { borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  empty: { padding: spacing.md, fontSize: 15, lineHeight: 24, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowInfo: { flex: 1 },
  rowLabel: { flex: 1, fontSize: 15, lineHeight: 24, fontWeight: '600', color: colors.text },
  rowHint: { fontSize: 13, color: colors.muted },
  rowValue: { fontSize: 15, fontWeight: '700', color: colors.text },
});
