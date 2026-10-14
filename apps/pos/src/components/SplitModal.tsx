import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { applyRupeesKey, CLEAR_KEY, formatMoney, isRealSplit, parseRupeesInput, splitPayment } from '@broiler/shared';
import { t } from '../strings';
import { colors, spacing } from '../theme';
import { Keypad } from './Keypad';

interface Props {
  totalMinor: number;
  /** The GPay half so far, in paise (0 for a fresh split). */
  upiMinor: number;
  onDone: (upiMinor: number) => void;
  onCancel: () => void;
}

type Side = 'upi' | 'cash';

/**
 * Divides one bill between GPay and cash. Only the GPay half is kept; cash is the remainder. Tap a
 * box, type a rupee amount, and the other box fills in so the two always add up to the bill.
 */
export function SplitModal({ totalMinor, upiMinor, onDone, onCancel }: Props) {
  const [upi, setUpi] = useState(splitPayment(totalMinor, upiMinor).upiMinor);
  const [side, setSide] = useState<Side>('upi');
  const [text, setText] = useState('');

  const { cashMinor } = splitPayment(totalMinor, upi);
  const valid = isRealSplit(totalMinor, upi);

  const choose = (next: Side) => {
    setSide(next);
    setText('');
  };
  const press = (key: string) => {
    const nextText = key === CLEAR_KEY ? '' : applyRupeesKey(text, key);
    setText(nextText);
    const typed = nextText === '' ? 0 : (parseRupeesInput(nextText) ?? 0);
    // Typing in the cash box sets GPay to what is left of the bill.
    setUpi(splitPayment(totalMinor, side === 'upi' ? typed : totalMinor - typed).upiMinor);
  };

  const box = (which: Side, label: string, minor: number) => {
    const active = which === side;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
        onPress={() => choose(which)}
        style={[styles.box, active && styles.boxActive]}
      >
        <Text style={styles.boxLabel}>{label}</Text>
        <Text style={styles.boxValue}>{formatMoney(minor)}</Text>
      </Pressable>
    );
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <Text style={styles.title}>{t.splitTitle}</Text>
          <View style={styles.total}>
            <Text style={styles.totalLabel}>{t.billTotal}</Text>
            <Text style={styles.totalValue}>{formatMoney(totalMinor)}</Text>
          </View>

          <View style={styles.boxes}>
            {box('upi', t.gpay, upi)}
            <Text style={styles.plus}>+</Text>
            {box('cash', t.cashHalf, cashMinor)}
          </View>
          <Text style={styles.hint}>{t.splitHint}</Text>

          <Keypad leftKey={CLEAR_KEY} keyHeight={52} onKey={press} />

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={[styles.action, styles.cancel]}>
              <Text style={styles.cancelText}>{t.cancel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !valid }}
              disabled={!valid}
              onPress={() => onDone(upi)}
              style={[styles.action, styles.confirm, !valid && styles.confirmDisabled]}
            >
              <Text style={styles.confirmText}>{t.done}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: 'rgba(31, 21, 18, 0.55)' },
  sheet: { width: '100%', maxWidth: 460, gap: spacing.md, padding: spacing.xl, borderRadius: 22, backgroundColor: colors.surface },
  title: { fontSize: 22, lineHeight: 32, fontWeight: '800', color: colors.primary },
  total: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', padding: spacing.md, borderRadius: 14, backgroundColor: colors.primarySoft },
  totalLabel: { fontSize: 15, lineHeight: 24, color: colors.muted },
  totalValue: { fontSize: 30, lineHeight: 40, fontWeight: '800', color: colors.text },
  boxes: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  box: { flex: 1, padding: spacing.md, borderRadius: 14, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  boxActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  boxLabel: { fontSize: 14, lineHeight: 22, fontWeight: '700', color: colors.muted },
  boxValue: { fontSize: 26, lineHeight: 36, fontWeight: '800', color: colors.text },
  plus: { fontSize: 26, fontWeight: '800', color: colors.muted },
  hint: { fontSize: 13, lineHeight: 20, color: colors.muted },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancel: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cancelText: { fontSize: 17, lineHeight: 26, fontWeight: '700', color: colors.text },
  confirm: { flex: 2, backgroundColor: colors.primary },
  confirmDisabled: { backgroundColor: colors.disabled },
  confirmText: { fontSize: 18, lineHeight: 28, fontWeight: '800', color: colors.onPrimary },
});
