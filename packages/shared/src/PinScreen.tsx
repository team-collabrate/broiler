import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { describeError } from './errors';
import { applyPinKey, isValidPin, MAX_PIN_LENGTH, MIN_PIN_LENGTH } from './roles';
import { colors, spacing } from './theme';

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
];

interface Props {
  title: string;
  subtitle: string;
  /** Called with the PIN. Throw to show the failure under the dots; resolve to finish (the screen is then replaced). */
  onSubmit: (pin: string) => Promise<void>;
  /** An optional way back, for a PIN view that sits inside the app (for example the owner PIN before today's rates). */
  onCancel?: () => void;
}

/**
 * A full-page PIN entry: dots, a keypad and a sign-in button. A page, not a popup. The PIN is
 * kept only in this component's state and is cleared after a wrong attempt.
 */
export function PinScreen({ title, subtitle, onSubmit, onCancel }: Props) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const press = (key: string) => {
    if (busy) return;
    setError(null);
    setPin((prev) => applyPinKey(prev, key));
  };

  const submit = async () => {
    if (busy || !isValidPin(pin)) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(pin);
    } catch (e) {
      setError(describeError(e));
      setPin('');
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.dots} accessibilityLabel={`${pin.length} / ${MAX_PIN_LENGTH}`} accessibilityLiveRegion="polite">
          {Array.from({ length: Math.max(MIN_PIN_LENGTH, pin.length) }, (_, i) => (
            <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
          ))}
        </View>

        <View style={styles.errorBox} accessibilityRole="alert">
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        <View style={styles.pad}>
          {KEYS.map((row, i) => (
            <View key={i} style={styles.row}>
              {row.map((key, j) =>
                key === '' ? (
                  <View key={j} style={styles.spacer} />
                ) : (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={key === '⌫' ? 'அழி' : key}
                    disabled={busy}
                    onPress={() => press(key)}
                    style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
                  >
                    <Text style={styles.keyText}>{key}</Text>
                  </Pressable>
                ),
              )}
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          {onCancel && (
            <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={[styles.action, styles.secondary]}>
              <Text style={styles.secondaryText}>பின்செல்</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy || !isValidPin(pin) }}
            disabled={busy || !isValidPin(pin)}
            onPress={submit}
            style={[styles.action, styles.primary, (busy || !isValidPin(pin)) && styles.primaryDisabled]}
          >
            {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryText}>உள்நுழை</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.bg },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: { fontSize: 22, lineHeight: 32, fontWeight: '800', textAlign: 'center', color: colors.primary },
  subtitle: { fontSize: 15, lineHeight: 24, textAlign: 'center', color: colors.muted },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, minHeight: 20 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.primary },
  dotFilled: { backgroundColor: colors.primary },
  errorBox: { minHeight: 24, alignItems: 'center' },
  errorText: { fontSize: 15, lineHeight: 24, fontWeight: '600', textAlign: 'center', color: colors.danger },
  pad: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  spacer: { flex: 1 },
  key: {
    flex: 1,
    height: 60,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  keyPressed: { backgroundColor: colors.primarySoft },
  keyText: { fontSize: 26, fontWeight: '600', color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.primary },
  primaryDisabled: { backgroundColor: colors.disabled },
  primaryText: { fontSize: 18, lineHeight: 28, fontWeight: '800', color: colors.onPrimary },
  secondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  secondaryText: { fontSize: 16, fontWeight: '600', color: colors.text },
});
