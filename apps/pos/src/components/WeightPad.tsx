import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatMoney, isValidKgInput, lineTotalMinor, parseKgInput, type MenuItem } from '@broiler/shared';
import { colors, spacing } from '../theme';

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

interface Props {
  /** The item being weighed; the pad is shown while this is set. */
  item: MenuItem | null;
  onAdd: (item: MenuItem, grams: number) => void;
  onCancel: () => void;
}

export function WeightPad({ item, onAdd, onCancel }: Props) {
  const [text, setText] = useState('');

  useEffect(() => setText(''), [item]);

  const grams = parseKgInput(text);

  const press = (key: string) =>
    setText((prev) => {
      if (key === '⌫') return prev.slice(0, -1);
      if (key === '.') {
        if (prev.includes('.')) return prev;
        return prev === '' ? '0.' : `${prev}.`;
      }
      if (prev === '0') return key === '0' ? prev : key; // no stacked leading zeros
      const next = prev + key;
      return isValidKgInput(next) ? next : prev;
    });

  return (
    <Modal visible={item !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        {item && (
          <View style={styles.card}>
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.rate}>{formatMoney(item.pricePerKgMinor)} per kg</Text>

            <View style={styles.display}>
              <Text style={styles.weight} accessibilityLabel={`${text || '0'} kilograms`}>
                {text || '0'} <Text style={styles.weightUnit}>kg</Text>
              </Text>
              <Text style={styles.amount}>
                {formatMoney(grams ? lineTotalMinor(item.pricePerKgMinor, grams) : 0)}
              </Text>
            </View>

            {KEYS.map((row) => (
              <View key={row.join('')} style={styles.keyRow}>
                {row.map((key) => (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={key === '⌫' ? 'Delete' : key === '.' ? 'Decimal point' : key}
                    onPress={() => press(key)}
                    style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                  >
                    <Text style={styles.keyText}>{key}</Text>
                  </Pressable>
                ))}
              </View>
            ))}

            <View style={styles.actions}>
              <Pressable accessibilityRole="button" onPress={onCancel} style={[styles.action, styles.cancel]}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: grams === null }}
                disabled={grams === null}
                onPress={() => grams !== null && onAdd(item, grams)}
                style={[styles.action, styles.add, grams === null && styles.addDisabled]}
              >
                <Text style={styles.addText}>Add to cart</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  rate: { fontSize: 14, color: colors.muted },
  display: {
    marginVertical: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.bg,
    alignItems: 'flex-end',
  },
  weight: { fontSize: 40, fontWeight: '700', color: colors.text },
  weightUnit: { fontSize: 20, fontWeight: '500', color: colors.muted },
  amount: { fontSize: 18, fontWeight: '600', color: colors.primary },
  keyRow: { flexDirection: 'row', gap: spacing.sm },
  key: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  keyPressed: { backgroundColor: colors.primarySoft },
  keyText: { fontSize: 24, fontWeight: '600', color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  action: { flex: 1, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancel: { borderWidth: 1, borderColor: colors.border },
  cancelText: { fontSize: 16, fontWeight: '600', color: colors.text },
  add: { backgroundColor: colors.primary },
  addDisabled: { backgroundColor: colors.disabled },
  addText: { fontSize: 16, fontWeight: '700', color: colors.onPrimary },
});
