import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CURRENCY_SYMBOL, formatMoney, itemName, unitSuffix, type MenuItem } from '@broiler/shared';
import { t } from '../strings';
import { colors, spacing } from '../theme';
import { imageSource, ProductImage } from './ProductImage';

/** `₹260` for a whole-rupee rate, `₹260.50` when it has paise: short enough for a card. */
const shortRate = (minor: number) => (minor % 100 === 0 ? `${CURRENCY_SYMBOL}${minor / 100}` : formatMoney(minor));

/** A card is never narrower than this, which is what decides how many columns fit. */
export const CARD_MIN_WIDTH = 190;
export const GRID_GAP = spacing.md;

/**
 * How many columns fit in `availableWidth`. Callers pass the window width less the cart column and
 * padding, never a measured width of the grid itself: a scrollbar appearing would shrink a measured
 * width, change the count, change the height, and flip the scrollbar back (the layout flickers).
 */
export function gridColumns(availableWidth: number, maxColumns: number): number {
  return Math.max(2, Math.min(maxColumns, Math.floor((availableWidth + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP))));
}

interface Props {
  items: MenuItem[];
  columns: number;
  onSelect: (item: MenuItem) => void;
}

/**
 * The product catalog: image cards in a 4:3 grid, as in the Kumbakonam POS. Each card is the photo
 * filling the card, a dark band along the bottom carrying the name (left) and the price (right), and
 * a "+" chip that says the card can be tapped. A product with no photo yet is a plain green card.
 * Tapping opens that product's configuration sheet.
 */
export function ProductGrid({ items, columns, onSelect }: Props) {
  // Each cell takes an equal share of the row by percentage, so it always fills the width whatever the
  // scrollbar does. Rounded down a hair so the cells can never add up to more than the row and wrap.
  const cellWidth = `${Math.floor(10000 / columns) / 100}%` as const;

  return (
    <View style={styles.grid}>
      {items.map((item) => {
          const source = imageSource(item.image, item.id);
          const rate = item.rateMinor > 0 ? `${shortRate(item.rateMinor)}${unitSuffix(item.unit)}` : t.setRate;
          return (
            <View key={item.id} style={[styles.cell, { width: cellWidth }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.cardAria(itemName(item), rate)}
              onPress={() => onSelect(item)}
              style={({ pressed }) => [styles.card, !source && styles.cardPlain, pressed && styles.cardPressed]}
            >
              {source && <ProductImage source={source} />}
              {source && <View style={styles.scrim} />}

              <View style={styles.plus}>
                <Text style={styles.plusText}>+</Text>
              </View>

              <View style={styles.info}>
                <Text style={[styles.name, !source && styles.nameOnPlain]} numberOfLines={2}>
                  {itemName(item)}
                </Text>
                <Text style={[styles.price, !source && styles.priceOnPlain]} numberOfLines={1}>
                  {rate}
                </Text>
              </View>
            </Pressable>
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  // The cells carry half a gap of padding on every side and the row pulls the same amount back out.
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -GRID_GAP / 2 },
  cell: { padding: GRID_GAP / 2 },
  card: {
    width: '100%',
    aspectRatio: 4 / 3,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primary,
  },
  cardPlain: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  // The darkening under the text. Only drawn over a photo, so white text stays readable on any picture.
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '58%', backgroundColor: 'rgba(8, 24, 14, 0.62)' },
  plus: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  plusText: { fontSize: 24, lineHeight: 28, fontWeight: '700', color: colors.onPrimary },
  info: { gap: 2, padding: spacing.md },
  name: { fontSize: 17, lineHeight: 26, fontWeight: '800', color: '#FFFFFF' },
  nameOnPlain: { color: colors.text },
  price: { alignSelf: 'flex-end', fontSize: 16, lineHeight: 24, fontWeight: '800', color: '#FFFFFF' },
  priceOnPlain: { color: colors.primary },
});
