import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { describeError, formatMoney, getOutstandingCustomers, MAX_CUSTOMER_NAME, tidyCustomerName, type Customer } from '@broiler/shared';
import { t } from '../strings';
import { colors, spacing } from '../theme';

interface Props {
  totalMinor: number;
  /** The name already chosen for this bill, if the sheet is reopened. */
  current: string | null;
  /** Called with the chosen or typed name. The same name always finds the same customer. */
  onChoose: (name: string) => void;
  onCancel: () => void;
}

/**
 * Chooses who a credit (kadan) bill is for. The list is only people who owe something right now, which
 * is the counter's whole customer list: a settled customer drops off it and returns the next time they
 * take credit. A new name makes a new customer.
 */
export function CreditModal({ totalMinor, current, onChoose, onCancel }: Props) {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState(current ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getOutstandingCustomers().then(
      (list) => alive && setCustomers(list),
      (e) => alive && setLoadError(describeError(e)),
    );
    return () => {
      alive = false;
    };
  }, []);

  const submitNew = () => {
    const tidy = tidyCustomerName(name);
    if (tidy === '') return setError(t.needName);
    onChoose(tidy.slice(0, MAX_CUSTOMER_NAME));
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text style={styles.title}>{t.creditTitle}</Text>
          <Text style={styles.subtitle}>{t.creditSubtitle}</Text>

          <View style={styles.total}>
            <Text style={styles.totalLabel}>{t.thisBill}</Text>
            <Text style={styles.totalValue}>{formatMoney(totalMinor)}</Text>
          </View>

          <Text style={styles.section}>{t.owing}</Text>
          <ScrollView style={styles.list} nestedScrollEnabled>
            {loadError ? (
              <Text style={styles.status}>{t.loadFailed(loadError)}</Text>
            ) : customers === null ? (
              <ActivityIndicator color={colors.primary} />
            ) : customers.length === 0 ? (
              <Text style={styles.status}>{t.nobodyOwes}</Text>
            ) : (
              customers.map((customer) => (
                <Pressable key={customer.id} accessibilityRole="button" onPress={() => onChoose(customer.name)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {customer.name}
                  </Text>
                  <Text style={styles.rowBalance}>{formatMoney(customer.balanceMinor)}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>

          <Text style={styles.section}>{t.newCustomer}</Text>
          <TextInput
            value={name}
            onChangeText={(v) => {
              setName(v);
              setError(null);
            }}
            placeholder={t.namePlaceholder}
            placeholderTextColor={colors.muted}
            maxLength={MAX_CUSTOMER_NAME}
            onSubmitEditing={submitNew}
            returnKeyType="done"
            style={styles.input}
          />
          <Text style={styles.error}>{error ?? ' '}</Text>

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={[styles.action, styles.cancel]}>
              <Text style={styles.cancelText}>{t.cancel}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={submitNew} style={[styles.action, styles.confirm]}>
              <Text style={styles.confirmText}>{t.useName}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: 'rgba(31, 21, 18, 0.55)' },
  sheet: { width: '100%', maxWidth: 480, maxHeight: '94%', gap: spacing.sm, padding: spacing.xl, borderRadius: 22, backgroundColor: colors.surface },
  title: { fontSize: 22, lineHeight: 32, fontWeight: '800', color: colors.primary },
  subtitle: { fontSize: 14, lineHeight: 22, color: colors.muted },
  total: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', padding: spacing.md, borderRadius: 14, backgroundColor: colors.primarySoft },
  totalLabel: { fontSize: 15, lineHeight: 24, color: colors.muted },
  totalValue: { fontSize: 26, lineHeight: 36, fontWeight: '800', color: colors.text },
  section: { marginTop: spacing.xs, fontSize: 14, lineHeight: 22, fontWeight: '800', color: colors.muted },
  list: { maxHeight: 200, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  status: { padding: spacing.md, fontSize: 15, lineHeight: 24, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowPressed: { backgroundColor: colors.primarySoft },
  rowName: { flex: 1, fontSize: 17, lineHeight: 26, fontWeight: '700', color: colors.text },
  rowBalance: { fontSize: 16, fontWeight: '800', color: colors.primary },
  input: { height: 52, paddingHorizontal: spacing.md, borderRadius: 12, borderWidth: 2, borderColor: colors.border, fontSize: 18, color: colors.text, backgroundColor: colors.surface },
  error: { minHeight: 22, fontSize: 14, lineHeight: 22, fontWeight: '600', color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancel: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cancelText: { fontSize: 17, lineHeight: 26, fontWeight: '700', color: colors.text },
  confirm: { flex: 2, backgroundColor: colors.primary },
  confirmText: { fontSize: 17, lineHeight: 26, fontWeight: '800', color: colors.onPrimary },
});
