import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatMoney, formatWeight, lineTotalMinor } from '@broiler/shared';
import { WEIGHT_PRESETS_GRAMS } from '../presets';
import { colors, spacing } from '../theme';

interface Props {
  /** The weight currently chosen; the matching preset is highlighted. */
  grams: number;
  pricePerKgMinor: number;
  onSelect: (grams: number) => void;
}

/** Fixed weights as big buttons, each showing its price for the selected item. */
export function PresetGrid({ grams, pricePerKgMinor, onSelect }: Props) {
  // Two buttons per row.
  const rows: number[][] = [];
  for (let i = 0; i < WEIGHT_PRESETS_GRAMS.length; i += 2) rows.push(WEIGHT_PRESETS_GRAMS.slice(i, i + 2));

  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0]} style={styles.row}>
          {row.map((preset) => {
            const selected = preset === grams;
            const price = formatMoney(lineTotalMinor(pricePerKgMinor, preset));
            return (
              <Pressable
                key={preset}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${formatWeight(preset)}, ${price}`}
                onPress={() => onSelect(preset)}
                style={({ pressed }) => [styles.button, selected && styles.selected, pressed && styles.pressed]}
              >
                <Text style={[styles.weight, selected && styles.weightSelected]}>{formatWeight(preset)}</Text>
                <Text style={[styles.price, selected && styles.priceSelected]}>{price}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  button: {
    flex: 1,
    height: 72,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  pressed: { backgroundColor: colors.primarySoft },
  weight: { fontSize: 22, fontWeight: '800', color: colors.text },
  weightSelected: { color: colors.primary },
  price: { fontSize: 15, fontWeight: '600', color: colors.muted },
  priceSelected: { color: colors.primary },
});
