import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { CURRENCY_SYMBOL, formatMoney, formatWeight, type MenuItem } from '@broiler/shared';
import { colors, spacing } from '../theme';

/** `₹260` for a whole-rupee rate, `₹260.50` when it has paise: short enough for a compact card. */
const shortRate = (minor: number) => (minor % 100 === 0 ? `${CURRENCY_SYMBOL}${minor / 100}` : formatMoney(minor));

interface Props {
  items: MenuItem[];
  columns: number;
  /** The item whose sale panel is open, highlighted on its card. */
  selectedId: string | null;
  onSelect: (item: MenuItem) => void;
}

/**
 * The items as compact cards. Plain wrapped views rather than a list, so it can sit inside the
 * page's own scroll view without nesting scrollers; a menu is only a handful of items.
 */
export function MenuGrid({ items, columns, selectedId, onSelect }: Props) {
  const [width, setWidth] = useState(0);
  const gap = spacing.sm;
  // 1dp spare: onLayout rounds the width, and cards that add up to exactly the rounded width wrap
  // onto a new row when the real width is a fraction smaller (seen at 1032 vs 1031.65).
  const cardWidth = width > 0 ? Math.floor((width - 1 - gap * (columns - 1)) / columns) : undefined;

  return (
    <View style={styles.grid} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {cardWidth !== undefined &&
        items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${item.name}, ${formatMoney(item.pricePerKgMinor)} per kilo, usual weight ${formatWeight(item.defaultGrams)}`}
              onPress={() => onSelect(item)}
              style={({ pressed }) => [styles.card, { width: cardWidth }, (selected || pressed) && styles.cardActive]}
            >
              <Text style={styles.name} numberOfLines={2}>
                {item.name}
              </Text>
              <View style={styles.bottom}>
                <Text style={styles.price} numberOfLines={1}>{shortRate(item.pricePerKgMinor)}</Text>
                <Text style={[styles.usual, selected && styles.usualActive]} numberOfLines={1}>{formatWeight(item.defaultGrams)}</Text>
              </View>
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    minHeight: 76,
    justifyContent: 'space-between',
    gap: spacing.xs,
    padding: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  cardActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  name: { fontSize: 14, lineHeight: 18, fontWeight: '700', color: colors.text },
  bottom: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.xs },
  price: { flexShrink: 1, fontSize: 15, fontWeight: '800', color: colors.primary },
  // The item's usual sale weight, where its panel starts. Never wraps.
  usual: { flexShrink: 0, fontSize: 17, fontWeight: '800', color: colors.muted },
  usualActive: { color: colors.primary },
});
