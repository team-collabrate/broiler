import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

const HOLD_DELAY_MS = 350;
const HOLD_REPEAT_MS = 80;

interface Props {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onStep: () => void;
  /** Diameter in dp: 64 beside the weight meter, 48 (the touch minimum) inside the cart. */
  size?: number;
}

/** A round −/+ button. Tap for one step; press and hold to keep stepping. */
export function StepButton({ label, accessibilityLabel, disabled, onStep, size = 64 }: Props) {
  const repeat = useRef<ReturnType<typeof setInterval>>(undefined);

  const stop = useCallback(() => clearInterval(repeat.current), []);
  useEffect(() => stop, [stop]);

  // A tap steps once (onPress, on release). Holding past the delay is a long press: it steps
  // and then keeps stepping until the finger lifts, and no extra tap step follows.
  const startRepeating = () => {
    stop();
    onStep();
    repeat.current = setInterval(onStep, HOLD_REPEAT_MS);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onStep}
      onLongPress={startRepeating}
      delayLongPress={HOLD_DELAY_MS}
      onPressOut={stop}
      style={({ pressed }) => [
        styles.step,
        { width: size, height: size, borderRadius: size / 2 },
        disabled && styles.stepDisabled,
        pressed && styles.stepPressed,
      ]}
    >
      <Text style={[styles.stepText, { fontSize: size >= 64 ? 34 : 28, lineHeight: size >= 64 ? 38 : 32 }, disabled && styles.stepTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  step: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  stepPressed: { backgroundColor: colors.primarySoft },
  stepDisabled: { borderColor: colors.border },
  stepText: { fontWeight: '500', color: colors.primary },
  stepTextDisabled: { color: colors.disabled },
});
