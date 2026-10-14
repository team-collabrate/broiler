import { memo, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { wheelIndexFromOffset, wheelMaxOffset } from '@broiler/shared';
import { colors } from '../theme';

/** Rows showing at once, like the iOS alarm picker: the middle one is the value. */
const VISIBLE_ROWS = 5;
/**
 * How soft the wheel feels. A flick carries at this fraction of the finger's speed, and it
 * slows down faster than a normal list, so a flick moves a few rows and a gentle drag moves
 * exactly as far as the finger. Raise these for a livelier wheel, lower them for a stiffer one.
 */
const FLICK_SPEED = 0.45;
const FLICK_DECELERATION = 0.99;

interface RowProps {
  index: number;
  label: string;
  offset: SharedValue<number>;
  rowHeight: number;
  fontSize: number;
}

/** One row. It sits at its place in the list, and shrinks and fades the further it is from the middle. */
const Row = memo(function Row({ index, label, offset, rowHeight, fontSize }: RowProps) {
  const style = useAnimatedStyle(() => {
    const distance = (index * rowHeight - offset.value) / rowHeight;
    const far = Math.abs(distance);
    return {
      opacity: far > 2.6 ? 0 : Math.max(0.28, 1 - far * 0.32),
      transform: [{ translateY: (VISIBLE_ROWS >> 1) * rowHeight + index * rowHeight - offset.value }, { scale: 1 - Math.min(far, 3) * 0.07 }],
    };
  });
  return (
    <Animated.View style={[styles.row, { height: rowHeight }, style]} pointerEvents="none">
      <Text style={[styles.rowText, { fontSize }]} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
});

interface Props {
  values: string[];
  /** The row in the middle. */
  index: number;
  onChange: (index: number) => void;
  /** Small caption over the wheel, such as the unit. */
  caption?: string;
  rowHeight?: number;
  fontSize?: number;
  accessibilityLabel: string;
}

/**
 * A scroll wheel like the iOS alarm picker. Drag it and the rows follow your finger exactly; let
 * go and it settles softly onto the nearest row. Tap a row to jump to it. The value is whatever
 * row sits in the highlighted middle band.
 */
export function WheelPicker({ values, index, onChange, caption, rowHeight = 48, fontSize = 26, accessibilityLabel }: Props) {
  const count = values.length;
  const max = wheelMaxOffset(rowHeight, count);
  const offset = useSharedValue(index * rowHeight);
  const start = useSharedValue(0);
  const lastIndex = useSharedValue(index);

  const emit = useCallback((next: number) => onChange(next), [onChange]);

  // Follow a value set from outside (the −/+ buttons, an edit, a reset). While a finger is moving
  // the wheel, `lastIndex` already equals the prop, so this does nothing.
  useEffect(() => {
    if (lastIndex.value !== index) {
      lastIndex.value = index;
      cancelAnimation(offset);
      offset.value = withTiming(index * rowHeight, { duration: 120 });
    }
  }, [index, rowHeight, lastIndex, offset]);

  // Tell the screen whenever the middle row changes, so the total updates while you scroll.
  useAnimatedReaction(
    () => wheelIndexFromOffset(offset.value, rowHeight, count),
    (next) => {
      if (next !== lastIndex.value) {
        lastIndex.value = next;
        scheduleOnRN(emit, next);
      }
    },
  );

  const gesture = Gesture.Race(
    Gesture.Pan()
      .onBegin(() => {
        cancelAnimation(offset);
        start.value = offset.value;
      })
      .onUpdate((e) => {
        offset.value = Math.min(Math.max(start.value - e.translationY, 0), max);
      })
      .onEnd((e) => {
        offset.value = withDecay({ velocity: -e.velocityY * FLICK_SPEED, deceleration: FLICK_DECELERATION, clamp: [0, max] }, (finished) => {
          if (finished) {
            offset.value = withTiming(wheelIndexFromOffset(offset.value, rowHeight, count) * rowHeight, { duration: 160 });
          }
        });
      }),
    Gesture.Tap().onEnd((e) => {
      const tapped = wheelIndexFromOffset(offset.value + e.y - (VISIBLE_ROWS >> 1) * rowHeight - rowHeight / 2, rowHeight, count);
      offset.value = withTiming(tapped * rowHeight, { duration: 180 });
    }),
  );

  const height = VISIBLE_ROWS * rowHeight;

  return (
    <View style={styles.wrap}>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      <GestureDetector gesture={gesture}>
        <View
          collapsable={false}
          // `touchAction: none` stops a browser or the sheet's own scrolling from stealing the drag.
          style={[styles.wheel, { height }, { touchAction: 'none' } as object]}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ text: values[index] }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => onChange(Math.min(Math.max(index + (e.nativeEvent.actionName === 'increment' ? 1 : -1), 0), count - 1))}
        >
          <View style={[styles.band, { top: (VISIBLE_ROWS >> 1) * rowHeight, height: rowHeight }]} />
          {values.map((label, i) => (
            <Row key={i} index={i} label={label} offset={offset} rowHeight={rowHeight} fontSize={fontSize} />
          ))}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, minWidth: 96 },
  caption: { marginBottom: 2, textAlign: 'center', fontSize: 14, lineHeight: 22, fontWeight: '700', color: colors.muted },
  wheel: { overflow: 'hidden', borderRadius: 14, backgroundColor: colors.surface },
  band: { position: 'absolute', left: 4, right: 4, borderRadius: 12, backgroundColor: colors.primarySoft },
  row: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  rowText: { fontWeight: '700', color: colors.text },
});
