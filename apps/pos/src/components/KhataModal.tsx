import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  applyRupeesKey,
  CLEAR_KEY,
  CURRENCY_SYMBOL,
  describeError,
  formatMoney,
  getOutstandingCustomers,
  paymentProblem,
  parseRupeesInput,
  PAYMENT_LABELS,
  recordCustomerPayment,
  type Customer,
  type SettleMethod,
} from '@broiler/shared';
import { t } from '../strings';
import { colors, spacing } from '../theme';
import { Keypad } from './Keypad';

const METHODS: SettleMethod[] = ['cash', 'upi'];

interface Props {
  onClose: () => void;
}

/** Who owes what, and where a customer settles. A name disappears from the list once their balance is cleared. */
export function KhataModal({ onClose }: Props) {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [collecting, setCollecting] = useState<Customer | null>(null);
  const [text, setText] = useState('');
  const [method, setMethod] = useState<SettleMethod>('cash');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoadError(null);
    getOutstandingCustomers().then(setCustomers, (e) => setLoadError(describeError(e)));
  }, []);
  useEffect(load, [load]);

  const totalOwed = (customers ?? []).reduce((sum, c) => sum + c.balanceMinor, 0);
  const amountMinor = parseRupeesInput(text);

  const submit = async () => {
    if (!collecting || saving) return;
    const problem = paymentProblem(amountMinor ?? 0, collecting.balanceMinor);
    if (problem === 'zero') return setError(t.needAmount);
    if (problem === 'tooMuch') return setError(t.tooMuch);
    setSaving(true);
    setError(null);
    try {
      await recordCustomerPayment({ customerId: collecting.id, amountMinor: amountMinor as number, method });
      setNote(t.recorded(collecting.name));
      setCollecting(null);
      setText('');
      load();
    } catch (e) {
      setError(t.recordFailed(describeError(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text style={styles.title}>{t.khataTitle}</Text>
          <Text style={styles.subtitle}>{t.khataSubtitle}</Text>

          {collecting ? (
            <>
              <View style={styles.total}>
                <Text style={styles.totalLabel} numberOfLines={1}>
                  {collecting.name}
                </Text>
                <Text style={styles.totalValue}>{formatMoney(collecting.balanceMinor)}</Text>
              </View>

              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>{t.amountReceived}</Text>
                <Text style={styles.amountValue}>
                  {CURRENCY_SYMBOL}
                  {text || '0'}
                </Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setText(String(Math.floor(collecting.balanceMinor / 100)))} style={styles.payAll}>
                <Text style={styles.payAllText}>
                  {t.payAll} · {formatMoney(collecting.balanceMinor)}
                </Text>
              </Pressable>

              <Keypad leftKey={CLEAR_KEY} keyHeight={48} onKey={(k) => setText((prev) => (k === CLEAR_KEY ? '' : applyRupeesKey(prev, k)))} />

              <View style={styles.methods} accessibilityRole="radiogroup" accessibilityLabel={t.receivedBy}>
                {METHODS.map((m) => (
                  <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: m === method }} onPress={() => setMethod(m)} style={[styles.method, m === method && styles.methodOn]}>
                    <Text style={[styles.methodText, m === method && styles.methodTextOn]}>{PAYMENT_LABELS[m]}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.error} accessibilityRole="alert">
                {error ?? ' '}
              </Text>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setCollecting(null);
                    setError(null);
                  }}
                  style={[styles.action, styles.cancel]}
                >
                  <Text style={styles.cancelText}>{t.back}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={saving} onPress={submit} style={[styles.action, styles.confirm, saving && styles.confirmDisabled]}>
                  <Text style={styles.confirmText}>{saving ? t.saving : t.record}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.total}>
                <Text style={styles.totalLabel}>{t.totalOwed}</Text>
                <Text style={styles.totalValue}>{formatMoney(totalOwed)}</Text>
              </View>
              {note && <Text style={styles.note}>{note}</Text>}

              <ScrollView style={styles.list} nestedScrollEnabled>
                {loadError ? (
                  <Text style={styles.status}>{t.loadFailed(loadError)}</Text>
                ) : customers === null ? (
                  <ActivityIndicator color={colors.primary} />
                ) : customers.length === 0 ? (
                  <Text style={styles.status}>{t.nobodyOwes}</Text>
                ) : (
                  customers.map((customer) => (
                    <View key={customer.id} style={styles.row}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {customer.name}
                      </Text>
                      <Text style={styles.rowBalance}>{formatMoney(customer.balanceMinor)}</Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setCollecting(customer);
                          setText('');
                          setNote(null);
                          setError(null);
                        }}
                        style={styles.collect}
                      >
                        <Text style={styles.collectText}>{t.takePayment}</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </ScrollView>

              <Pressable accessibilityRole="button" onPress={onClose} style={[styles.action, styles.cancel]}>
                <Text style={styles.cancelText}>{t.close}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: 'rgba(31, 21, 18, 0.55)' },
  sheet: { width: '100%', maxWidth: 500, maxHeight: '96%', gap: spacing.sm, padding: spacing.xl, borderRadius: 22, backgroundColor: colors.surface },
  title: { fontSize: 22, lineHeight: 32, fontWeight: '800', color: colors.primary },
  subtitle: { fontSize: 14, lineHeight: 22, color: colors.muted },
  total: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md, padding: spacing.md, borderRadius: 14, backgroundColor: colors.primarySoft },
  totalLabel: { flexShrink: 1, fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 26, lineHeight: 36, fontWeight: '800', color: colors.text },
  note: { fontSize: 15, lineHeight: 24, fontWeight: '700', color: colors.primaryDark },
  list: { maxHeight: 320, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  status: { padding: spacing.md, fontSize: 15, lineHeight: 24, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 60, paddingLeft: spacing.md, paddingRight: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowName: { flex: 1, fontSize: 17, lineHeight: 26, fontWeight: '700', color: colors.text },
  rowBalance: { fontSize: 16, fontWeight: '800', color: colors.primary },
  collect: { height: 44, paddingHorizontal: spacing.md, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  collectText: { fontSize: 15, lineHeight: 24, fontWeight: '700', color: colors.onPrimary },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: spacing.md },
  amountLabel: { fontSize: 14, lineHeight: 22, color: colors.muted },
  amountValue: { fontSize: 32, lineHeight: 44, fontWeight: '800', color: colors.text },
  payAll: { alignSelf: 'flex-start', height: 40, paddingHorizontal: spacing.md, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary },
  payAllText: { fontSize: 14, lineHeight: 22, fontWeight: '700', color: colors.primary },
  methods: { flexDirection: 'row', gap: spacing.sm },
  method: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border },
  methodOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  methodText: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.muted },
  methodTextOn: { color: colors.primary },
  error: { minHeight: 22, fontSize: 14, lineHeight: 22, fontWeight: '600', color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancel: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cancelText: { fontSize: 17, lineHeight: 26, fontWeight: '700', color: colors.text },
  confirm: { flex: 2, backgroundColor: colors.primary },
  confirmDisabled: { backgroundColor: colors.disabled },
  confirmText: { fontSize: 18, lineHeight: 28, fontWeight: '800', color: colors.onPrimary },
});
