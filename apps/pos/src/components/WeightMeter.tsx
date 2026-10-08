import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  formatMoney,
  formatWeight,
  lineTotalMinor,
  meterGramsFromX,
  meterXFromGrams,
  MIN_GRAMS,
  stepDownGrams,
  stepUpGrams,
  WEIGHT_STEP_GRAMS,
} from '@broiler/shared';
import { METER_MAX_GRAMS } from '../presets';
import { colors, spacing } from '../theme';

/** Handle diameter. Well above the 48dp touch minimum so a finger never has to hunt for it. */
const THUMB = 64;
/** Height of the touch strip. The whole strip is the target, not just the handle. */
const STRIP_HEIGHT = 76;
const TRACK_HEIGHT = 20;
const SCALE_KG = [0, 1, 2, 3, 4, 5];
const HOLD_DELAY_MS = 350;
const HOLD_REPEAT_MS = 80;

interface Props {
  grams: number;
  pricePerKgMinor: number;
  onChange: (grams: number) => void;
}

/** Ruler under the track: a tick every 50 g, taller at 250 g and 1 kg, labelled in kilos. Static, so memoised. */
const Ruler = memo(function Ruler() {
  const ticks = [];
  for (let g = 0; g <= METER_MAX_GRAMS; g += WEIGHT_STEP_GRAMS) {
    const height = g % 1000 === 0 ? 22 : g % 250 === 0 ? 14 : 8;
    ticks.push(<View key={g} style={[styles.tick, { left: `${(g / METER_MAX_GRAMS) * 100}%`, height }]} />);
  }
  return (
    <View style={styles.ruler} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.rulerInner}>
        {ticks}
        {SCALE_KG.map((kg) => (
          <Text key={kg} style={[styles.scaleLabel, { left: `${((kg * 1000) / METER_MAX_GRAMS) * 100}%` }]}>
            {kg === 0 ? '0' : `${kg} kg`}
          </Text>
        ))}
      </View>
    </View>
  );
});

/** A round −/+ button. Tap for one step; press and hold to keep stepping. */
function StepButton({ label, accessibilityLabel, disabled, onStep }: {
  label: string;
  accessibilityLabel: string;
  disabled: boolean;
  onStep: () => void;
}) {
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
      style={({ pressed }) => [styles.step, disabled && styles.stepDisabled, pressed && styles.stepPressed]}
    >
      <Text style={[styles.stepText, disabled && styles.stepTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

/**
 * The custom-weight meter: a big readout, −/+ for single 50 g steps, and a wide touch strip.
 * Put a finger anywhere on the strip and the handle jumps to it; drag to slide. The handle
 * follows the finger on the UI thread, and React hears about it only when the 50 g step changes.
 */
export function WeightMeter({ grams, pricePerKgMinor, onChange }: Props) {
  const width = useSharedValue(0);
  /** Centre of the handle, in dp from the strip's left edge. */
  const thumbX = useSharedValue(0);
  const pressed = useSharedValue(0);
  const lastGrams = useSharedValue(grams);

  // Latest values for code that outlives a render: the hold-to-repeat timer and the gesture.
  const gramsRef = useRef(grams);
  gramsRef.current = grams;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const emit = useCallback((next: number) => {
    gramsRef.current = next;
    onChangeRef.current(next);
  }, []);

  // Follow weights set elsewhere (a preset, −/+, a new item) with a short glide. While a finger
  // is down the handle is under it, so it is left alone.
  useEffect(() => {
    lastGrams.value = grams;
    if (pressed.value === 0) {
      thumbX.value = withTiming(meterXFromGrams(grams, width.value, THUMB, METER_MAX_GRAMS), { duration: 140 });
    }
  }, [grams, lastGrams, pressed, thumbX, width]);

  const onLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
    thumbX.value = meterXFromGrams(gramsRef.current, width.value, THUMB, METER_MAX_GRAMS);
  };

  const pan = useMemo(() => {
    const seek = (x: number) => {
      'worklet';
      // The handle sticks to the finger; the weight snaps to the 50 g grid.
      thumbX.value = Math.min(Math.max(x, THUMB / 2), Math.max(width.value - THUMB / 2, THUMB / 2));
      const next = meterGramsFromX(x, width.value, THUMB, METER_MAX_GRAMS);
      if (next !== lastGrams.value) {
        lastGrams.value = next;
        scheduleOnRN(emit, next);
      }
    };
    return Gesture.Pan()
      .minDistance(0)
      .onBegin((e) => {
        pressed.value = 1;
        seek(e.x);
      })
      .onUpdate((e) => seek(e.x))
      .onFinalize(() => {
        pressed.value = 0;
        // Settle the handle onto the snapped weight.
        thumbX.value = withTiming(meterXFromGrams(lastGrams.value, width.value, THUMB, METER_MAX_GRAMS), { duration: 100 });
      });
  }, [emit, lastGrams, pressed, thumbX, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: Math.max(thumbX.value - THUMB / 2, 0) }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value - THUMB / 2 }, { scale: withTiming(pressed.value === 1 ? 1.1 : 1, { duration: 120 }) }],
  }));

  const stepDown = () => {
    const next = stepDownGrams(gramsRef.current);
    if (next !== gramsRef.current) emit(next);
  };
  const stepUp = () => {
    const next = stepUpGrams(gramsRef.current);
    if (next !== gramsRef.current) emit(next);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.readoutRow}>
        <View style={styles.readout}>
          <Text style={styles.weight} numberOfLines={1} accessibilityLiveRegion="polite">
            {formatWeight(grams)}
          </Text>
          <Text style={styles.price}>{formatMoney(lineTotalMinor(pricePerKgMinor, grams))}</Text>
        </View>
        <View style={styles.steppers}>
          <StepButton
            label="−"
            accessibilityLabel={`Decrease by ${WEIGHT_STEP_GRAMS} grams`}
            disabled={grams <= MIN_GRAMS}
            onStep={stepDown}
          />
          <StepButton label="+" accessibilityLabel={`Increase by ${WEIGHT_STEP_GRAMS} grams`} disabled={false} onStep={stepUp} />
        </View>
      </View>

      <GestureDetector gesture={pan}>
        <View
          collapsable={false}
          style={styles.strip}
          onLayout={onLayout}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Weight"
          accessibilityValue={{ text: formatWeight(grams) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'increment' ? stepUp() : stepDown())}
        >
          <View style={styles.track} />
          <Animated.View style={[styles.fill, fillStyle]} />
          <Animated.View style={[styles.thumb, thumbStyle]}>
            <View style={styles.grip} />
            <View style={styles.grip} />
            <View style={styles.grip} />
          </Animated.View>
        </View>
      </GestureDetector>

      <Ruler />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  // Wraps on a narrow screen so the −/+ buttons drop under the readout instead of squeezing it.
  readoutRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  readout: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.lg },
  weight: { fontSize: 44, fontWeight: '800', color: colors.text },
  price: { fontSize: 24, fontWeight: '700', color: colors.primary },
  steppers: { flexDirection: 'row', gap: spacing.md },
  step: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  stepPressed: { backgroundColor: colors.primarySoft },
  stepDisabled: { borderColor: colors.border },
  stepText: { fontSize: 34, lineHeight: 38, fontWeight: '500', color: colors.primary },
  stepTextDisabled: { color: colors.disabled },
  strip: { height: STRIP_HEIGHT, justifyContent: 'center' },
  track: {
    position: 'absolute',
    left: THUMB / 2,
    right: THUMB / 2,
    top: (STRIP_HEIGHT - TRACK_HEIGHT) / 2,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.border,
  },
  fill: {
    position: 'absolute',
    left: THUMB / 2,
    top: (STRIP_HEIGHT - TRACK_HEIGHT) / 2,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.primary,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    top: (STRIP_HEIGHT - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  grip: { width: 3, height: 22, borderRadius: 2, backgroundColor: colors.onPrimary, opacity: 0.85 },
  // Pulled up under the strip: the strip's bottom margin is empty space, so the ruler tucks into it.
  ruler: { height: 34, marginTop: -12, paddingHorizontal: THUMB / 2 },
  rulerInner: { flex: 1 },
  tick: { position: 'absolute', top: 0, width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: colors.muted },
  scaleLabel: { position: 'absolute', top: 23, width: 48, marginLeft: -24, textAlign: 'center', fontSize: 13, color: colors.muted },
});
