import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  formatMoney,
  formatWeight,
  gramsForAmount,
  lineTotalMinor,
  MAX_LINE_GRAMS,
  MIN_GRAMS,
  parseRupeesInput,
  type MenuItem,
} from '@broiler/shared';
import { colors, spacing } from '../theme';
import { AmountPad } from './AmountPad';
import { PresetGrid } from './PresetGrid';
import { WeightMeter } from './WeightMeter';

/** What the cashier chose. `amountMinor` is set only when the sale was by amount. */
export interface SaleChoice {
  grams: number;
  amountMinor?: number;
}

type Mode = 'weight' | 'amount';

const FLASH_MS = 600;

interface Props {
  item: MenuItem;
  /** Tablet width: presets and the ₹ box sit side by side under the meter. Narrow: stacked. */
  wide: boolean;
  onAdd: (item: MenuItem, sale: SaleChoice) => void;
}

/**
 * Sells one item three ways, all on screen at once: a Custom weight meter, fixed Presets, and
 * By amount (₹). The meter and presets share one weight; the ₹ box has its own amount. The
 * side touched last is the live one (outlined) and is what Add adds. Mount it with
 * `key={item.id}` so it starts at the item's default weight whenever a different item is picked.
 */
export function SalePanel({ item, wide, onAdd }: Props) {
  const price = item.pricePerKgMinor;
  const startGrams = Math.max(item.defaultGrams, MIN_GRAMS);
  const [grams, setGrams] = useState(startGrams);
  const [amountText, setAmountText] = useState('');
  const [active, setActive] = useState<Mode>('weight');
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const amountMinor = parseRupeesInput(amountText);
  const amountGrams = amountMinor === null ? 0 : gramsForAmount(amountMinor, price);
  const canAdd = active === 'weight' ? grams > 0 : amountGrams > 0 && amountGrams <= MAX_LINE_GRAMS;

  const chooseWeight = (next: number) => {
    setGrams(next);
    setActive('weight');
  };
  const chooseAmount = (next: string) => {
    setAmountText(next);
    setActive('amount');
  };

  const add = () => {
    if (!canAdd) return;
    onAdd(item, active === 'weight' ? { grams } : { grams: amountGrams, amountMinor: amountMinor as number });
    // Stay on the same item, ready for the next sale, and confirm briefly on the button.
    setGrams(startGrams);
    setAmountText('');
    setActive('weight');
    setFlash(true);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), FLASH_MS);
  };

  const addLabel = flash
    ? 'Added ✓'
    : active === 'weight'
      ? `Add ${formatWeight(grams)} · ${formatMoney(lineTotalMinor(price, grams))}`
      : amountMinor === null
        ? 'Enter an amount'
        : `Add ${formatMoney(amountMinor)} · ≈ ${formatWeight(amountGrams)}`;

  const weightLive = active === 'weight';
  const amountLive = active === 'amount';

  return (
    <View style={styles.panel}>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, weightLive && styles.cardLive]}>
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, weightLive && styles.cardTitleLive]}>Custom weight</Text>
            <Text style={styles.itemInfo} numberOfLines={1}>
              {item.name} · {formatMoney(price)} per kg
            </Text>
          </View>
          <WeightMeter grams={grams} pricePerKgMinor={price} onChange={chooseWeight} />
        </View>

        <View style={wide ? styles.bottomRow : styles.bottomColumn}>
          <View style={[styles.card, styles.cell, weightLive && styles.cardLive]}>
            <Text style={[styles.cardTitle, weightLive && styles.cardTitleLive]}>Presets</Text>
            <PresetGrid grams={grams} pricePerKgMinor={price} onSelect={chooseWeight} />
          </View>
          <View style={[styles.card, styles.cell, amountLive && styles.cardLive, price <= 0 && styles.unavailable]}>
            <Text style={[styles.cardTitle, amountLive && styles.cardTitleLive]}>By amount (₹)</Text>
            <AmountPad pricePerKgMinor={price} text={amountText} onTextChange={chooseAmount} />
          </View>
        </View>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canAdd }}
        disabled={!canAdd}
        onPress={add}
        style={({ pressed }) => [
          styles.add,
          flash && styles.addDone,
          !canAdd && !flash && styles.addDisabled,
          pressed && styles.addPressed,
        ]}
      >
        <Text style={styles.addText}>{addLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, backgroundColor: colors.bg },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.md },
  // Which item the three boxes are selling, so the panel is self-explanatory.
  itemInfo: { flexShrink: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  body: { flex: 1 },
  bodyContent: { gap: spacing.sm },
  card: {
    gap: spacing.sm,
    padding: 10,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  // The live side: what Add will add. Outlined rather than dimming the other side, so all
  // three boxes stay fully readable.
  cardLive: { borderColor: colors.primary },
  cardTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.muted },
  cardTitleLive: { color: colors.primary },
  bottomRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  bottomColumn: { gap: spacing.sm },
  cell: { flex: 1 },
  unavailable: { opacity: 0.4, pointerEvents: 'none' },
  add: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  addPressed: { opacity: 0.9 },
  addDone: { backgroundColor: colors.success },
  addDisabled: { backgroundColor: colors.disabled },
  addText: { fontSize: 18, fontWeight: '800', color: colors.onPrimary },
});
