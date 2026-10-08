import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RANGE_PRESETS, rangeFor, type RangePreset } from '@broiler/shared';
import { colors, spacing } from '../theme';

interface Props {
  value: RangePreset;
  onChange: (preset: RangePreset) => void;
}

export function RangePicker({ value, onChange }: Props) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {RANGE_PRESETS.map((preset) => {
        const selected = preset === value;
        return (
          <Pressable
            key={preset}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(preset)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{rangeFor(preset).label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  chip: {
    height: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  chipTextSelected: { color: colors.onPrimary },
});
