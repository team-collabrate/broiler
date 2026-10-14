import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { billLine, billTotals, formatBillDate, type BillData } from '../bill';
import { SHOP_LINES, SHOP_NAME } from '../config';
import { t } from '../strings';
import { colors, spacing } from '../theme';
import { canPrint, printBill } from './BillPrint';

interface Props {
  bill: BillData;
  /** Dismiss the bill and go back to an empty cart for the next customer. */
  onNew: () => void;
}

/**
 * The bill, in Tamil, shown on the page in the cart column after a sale is saved (no popup).
 * On the web a Print button prints it; on a phone or tablet app, printing arrives with the
 * Bluetooth printer work.
 */
export function Bill({ bill, onNew }: Props) {
  const totals = billTotals(bill);

  return (
    <View style={styles.panel}>
      <Text style={styles.saved} accessibilityRole="alert">
        ✓ {t.billSaved}
      </Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.paper} nestedScrollEnabled>
        <Text style={styles.shop}>{SHOP_NAME}</Text>
        {SHOP_LINES.map((line) => (
          <Text key={line} style={styles.shopLine}>
            {line}
          </Text>
        ))}
        <View style={styles.rule} />
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            {t.billNo}: <Text style={styles.metaStrong}>{bill.orderNo}</Text>
          </Text>
          <Text style={styles.metaText}>{formatBillDate(bill.createdAt)}</Text>
        </View>
        <View style={styles.rule} />

        <View style={styles.row}>
          <Text style={[styles.head, styles.colName]}>{t.billItem}</Text>
          <Text style={[styles.head, styles.colAmount]}>{t.billAmount}</Text>
        </View>
        {bill.lines.map((line) => {
          const l = billLine(line);
          return (
            <View key={line.key} style={styles.item}>
              <View style={styles.row}>
                <Text style={[styles.itemName, styles.colName]}>{l.name}</Text>
                <Text style={[styles.itemAmount, styles.colAmount]}>{l.amount}</Text>
              </View>
              <Text style={styles.itemDetail}>
                {l.quantity} × {l.rate}
                {l.listRate ? `  (${l.listRate})` : ''}
              </Text>
            </View>
          );
        })}

        <View style={styles.rule} />
        {totals.weight && (
          <View style={styles.row}>
            <Text style={styles.sumLabel}>{t.billTotalWeight}</Text>
            <Text style={styles.sumValue}>{totals.weight}</Text>
          </View>
        )}
        {totals.pieces && (
          <View style={styles.row}>
            <Text style={styles.sumLabel}>{t.billTotalPieces}</Text>
            <Text style={styles.sumValue}>{totals.pieces}</Text>
          </View>
        )}
        <View style={styles.row}>
          <Text style={styles.totalLabel}>{t.billTotal}</Text>
          <Text style={styles.totalValue}>{totals.total}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.sumLabel}>{t.billPaid}</Text>
          <Text style={styles.sumValue}>{totals.payment}</Text>
        </View>
        {totals.paymentDetail && <Text style={styles.paymentDetail}>{totals.paymentDetail}</Text>}
        <View style={styles.rule} />
        <Text style={styles.thanks}>{t.billThanks}</Text>
      </ScrollView>

      <View style={styles.actions}>
        {canPrint && (
          <Pressable accessibilityRole="button" onPress={printBill} style={[styles.action, styles.secondary]}>
            <Text style={styles.secondaryText}>{t.print}</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={onNew} style={[styles.action, styles.primary]}>
          <Text style={styles.primaryText}>{t.newBill}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md },
  saved: { fontSize: 16, fontWeight: '700', color: colors.success },
  scroll: { flex: 1 },
  paper: { gap: spacing.xs, padding: spacing.md, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  shop: { fontSize: 20, lineHeight: 30, fontWeight: '800', textAlign: 'center', color: colors.text },
  shopLine: { fontSize: 14, lineHeight: 22, textAlign: 'center', color: colors.muted },
  rule: { height: 1, marginVertical: spacing.xs, backgroundColor: colors.border },
  meta: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  metaText: { fontSize: 14, lineHeight: 22, color: colors.muted },
  metaStrong: { fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  colName: { flex: 1 },
  colAmount: { textAlign: 'right' },
  head: { fontSize: 13, lineHeight: 20, fontWeight: '800', color: colors.muted },
  item: { paddingVertical: 2 },
  itemName: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.text },
  itemAmount: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.text },
  itemDetail: { fontSize: 13, lineHeight: 20, color: colors.muted },
  paymentDetail: { fontSize: 14, lineHeight: 22, fontWeight: '600', textAlign: 'right', color: colors.text },
  sumLabel: { fontSize: 15, lineHeight: 24, color: colors.muted },
  sumValue: { fontSize: 15, lineHeight: 24, fontWeight: '700', color: colors.text },
  totalLabel: { fontSize: 18, lineHeight: 28, fontWeight: '800', color: colors.text },
  totalValue: { fontSize: 22, lineHeight: 30, fontWeight: '800', color: colors.text },
  thanks: { fontSize: 15, lineHeight: 24, fontWeight: '700', textAlign: 'center', color: colors.primary },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  secondary: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
  secondaryText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  primary: { backgroundColor: colors.primary },
  primaryText: { fontSize: 16, fontWeight: '800', color: colors.onPrimary },
});
