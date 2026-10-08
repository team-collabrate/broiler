import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  applyRupeesKey,
  CLEAR_KEY,
  CURRENCY_SYMBOL,
  formatMoney,
  formatWeight,
  gramsForAmount,
  parseRupeesInput,
} from '@broiler/shared';
import { AMOUNT_PRESETS_MINOR } from '../presets';
import { colors, spacing } from '../theme';
import { Keypad } from './Keypad';

interface Props {
  pricePerKgMinor: number;
  /** The amount typed so far, in whole rupees ("" for none). */
  text: string;
  onTextChange: (text: string) => void;
}

/**
 * "Give me ₹100 worth": a big ₹ display, the weight it buys at the current rate, a keypad,
 * and quick amounts beside it. Always visible; typing here makes it the live entry.
 */
export function AmountPad({ pricePerKgMinor, text, onTextChange }: Props) {
  const amountMinor = parseRupeesInput(text);
  const weight = amountMinor === null ? null : gramsForAmount(amountMinor, pricePerKgMinor);

  const press = (key: string) => onTextChange(key === CLEAR_KEY ? '' : applyRupeesKey(text, key));

  return (
    <View style={styles.wrap}>
      <View style={styles.display}>
        <Text style={styles.amount} accessibilityLabel={`${text || '0'} rupees`}>
          {CURRENCY_SYMBOL}
          {text || '0'}
        </Text>
        <Text style={styles.weight} accessibilityLiveRegion="polite">
          {weight === null ? '—' : `≈ ${formatWeight(weight)}`}
        </Text>
      </View>

      <View style={styles.entry}>
        <View style={styles.keypad}>
          <Keypad leftKey={CLEAR_KEY} keyHeight={48} onKey={press} />
        </View>
        <View style={styles.quick}>
          {AMOUNT_PRESETS_MINOR.map((preset) => {
            const rupees = String(preset / 100);
            const selected = text === rupees;
            return (
              <Pressable
                key={preset}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${formatMoney(preset)} worth`}
                onPress={() => onTextChange(rupees)}
                style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {CURRENCY_SYMBOL}
                  {rupees}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  display: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: colors.bg,
  },
  amount: { fontSize: 32, fontWeight: '800', color: colors.text },
  weight: { fontSize: 22, fontWeight: '700', color: colors.primary },
  entry: { flexDirection: 'row', gap: spacing.md },
  keypad: { flex: 3 },
  quick: { flex: 1, minWidth: 84, gap: spacing.sm },
  chip: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primarySoft },
  chipPressed: { backgroundColor: colors.primarySoft },
  chipText: { fontSize: 20, fontWeight: '700', color: colors.primary },
  chipTextSelected: { color: colors.primary },
});
