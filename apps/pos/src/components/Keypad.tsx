import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BACKSPACE_KEY } from '@broiler/shared';
import { t } from '../strings';
import { colors, spacing } from '../theme';

interface Props {
  /** The bottom-left key: `.` for rates, `C` (clear) for rupee amounts, or `''` for none. */
  leftKey: '.' | 'C' | '';
  /** Key height in dp; keep it at 48 or more for a finger. */
  keyHeight?: number;
  onKey: (key: string) => void;
}

const LABELS: Record<string, string> = { [BACKSPACE_KEY]: t.keyDelete, '.': t.keyDecimal, C: t.keyClear };

export function Keypad({ leftKey, keyHeight = 56, onKey }: Props) {
  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [leftKey, '0', BACKSPACE_KEY],
  ];

  return (
    <View style={styles.pad}>
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((key, j) =>
            key === '' ? (
              <View key={j} style={styles.spacer} />
            ) : (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={LABELS[key] ?? key}
                onPress={() => onKey(key)}
                style={({ pressed }) => [styles.key, { height: keyHeight }, pressed && styles.keyPressed]}
              >
                <Text style={styles.keyText}>{key}</Text>
              </Pressable>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  spacer: { flex: 1 },
  key: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  keyPressed: { backgroundColor: colors.primarySoft },
  keyText: { fontSize: 24, fontWeight: '600', color: colors.text },
});
