import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  applyRupeesKey,
  adjustmentMinor,
  ADJUST_STEP_MINOR,
  CLEAR_KEY,
  clampRate,
  CURRENCY_SYMBOL,
  formatMoney,
  formatQty,
  formatRate,
  formatWeight,
  gramsForAmount,
  itemName,
  lineTotalMinor,
  MAX_QTY,
  MIN_GRAMS,
  parseRupeesInput,
  pieceTotalMinor,
  splitGrams,
  WEIGHT_STEP_GRAMS,
  type CartLine,
  type MenuItem,
  type Method,
  type OrderLineInput,
} from '@broiler/shared';
import { t } from '../strings';
import { colors, spacing } from '../theme';
import { Keypad } from './Keypad';
import { StepButton } from './StepButton';
import { WheelPicker } from './WheelPicker';

const MAX_KG = 30;
const KG_VALUES = Array.from({ length: MAX_KG + 1 }, (_, i) => String(i));
const GRAM_VALUES = Array.from({ length: 1000 / WEIGHT_STEP_GRAMS }, (_, i) => String(i * WEIGHT_STEP_GRAMS).padStart(3, '0'));
const QTY_VALUES = Array.from({ length: MAX_QTY }, (_, i) => String(i + 1));
const QUICK_AMOUNTS = [100, 200, 500];

const METHOD_LABEL: Record<Method, string> = { weight: t.methodWeight, amount: t.methodAmount, qty: t.methodQty };

interface Props {
  item: MenuItem;
  /** When editing a cart line: its current values fill the sheet. */
  editing?: CartLine;
  /** How far the counter may move the rate from the list rate, in paise. */
  maxAdjustMinor: number;
  onCancel: () => void;
  /** The finished line. For an edit, the caller replaces the old line with it. */
  onConfirm: (line: OrderLineInput) => void;
}

/** Which method an existing line was billed by. */
function methodOf(line: CartLine): Method {
  if (line.amountMinor !== undefined) return 'amount';
  return line.unit === 'piece' ? 'qty' : 'weight';
}

/**
 * The popup for one product. Pick how to bill it (weight-wise, rate-wise, or by count, whichever
 * the owner switched on for this product), enter the values, check the summary, then Add to Bill.
 * Only the methods configured for the product show; a product with one method shows no choice.
 */
export function ItemSheet({ item, editing, maxAdjustMinor, onCancel, onConfirm }: Props) {
  const { height } = useWindowDimensions();
  const isPiece = item.unit === 'piece';
  const [method, setMethod] = useState<Method>(() => (editing && item.methods.includes(methodOf(editing)) ? methodOf(editing) : item.methods[0]));

  const [grams, setGrams] = useState(() => {
    const start = editing && editing.unit === 'kg' && editing.amountMinor === undefined ? editing.grams : item.defaultGrams;
    return splitGrams(start, MAX_KG) ? Math.round(start / WEIGHT_STEP_GRAMS) * WEIGHT_STEP_GRAMS : MAX_KG * 1000;
  });
  const [qty, setQty] = useState(() => (editing && editing.unit === 'piece' && editing.amountMinor === undefined ? editing.qty : item.defaultQty));
  const [amountText, setAmountText] = useState(() => (editing?.amountMinor !== undefined ? String(editing.amountMinor / 100) : ''));
  // Pieces billed by amount carry an optional count (1 when not set).
  const [amountQty, setAmountQty] = useState(() => (editing?.amountMinor !== undefined && editing.unit === 'piece' ? editing.qty : 1));
  const [rate, setRate] = useState(() => (editing ? clampRate(editing.rateMinor, item.rateMinor, maxAdjustMinor) : item.rateMinor));

  const list = item.rateMinor;
  const parts = splitGrams(grams, MAX_KG) ?? { kg: MAX_KG, gramsPart: 0 };
  const amountMinor = parseRupeesInput(amountText);

  // What this entry will add, or null while it is not yet valid.
  const line = useMemo((): OrderLineInput | null => {
    const base = { itemId: item.id, name: itemName(item), category: item.category, unit: item.unit, listRateMinor: list };
    if (method === 'weight') {
      return grams >= MIN_GRAMS ? { ...base, rateMinor: rate, grams, qty: 0 } : null;
    }
    if (method === 'qty') {
      return qty >= 1 ? { ...base, rateMinor: rate, grams: 0, qty } : null;
    }
    if (amountMinor === null) return null;
    if (isPiece) return { ...base, rateMinor: list, grams: 0, qty: amountQty, amountMinor };
    const weighed = gramsForAmount(amountMinor, list);
    return weighed >= 1 ? { ...base, rateMinor: list, grams: weighed, qty: 0, amountMinor } : null;
  }, [method, item, list, rate, grams, qty, amountMinor, amountQty, isPiece]);

  const total = line === null ? 0 : method === 'weight' ? lineTotalMinor(rate, grams) : method === 'qty' ? pieceTotalMinor(rate, qty) : (amountMinor ?? 0);

  const detail =
    method === 'weight'
      ? `${formatWeight(grams)} × ${formatRate(rate, 'kg')}`
      : method === 'qty'
        ? `${formatQty(qty)} × ${formatRate(rate, 'piece')}`
        : isPiece
          ? `${formatQty(amountQty)}`
          : line
            ? `≈ ${formatWeight(line.grams)}`
            : '—';

  const showRate = method !== 'amount';
  const adjusted = adjustmentMinor({ rateMinor: rate, listRateMinor: list });
  const canAdjust = maxAdjustMinor > 0;

  const setGramsParts = (kg: number, g: number) => setGrams(kg * 1000 + g);

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { maxHeight: Math.max(height - 24, 360) }]} accessibilityViewIsModal>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={2}>
                {itemName(item)}
              </Text>
              <Text style={styles.subtitle}>{formatRate(list, item.unit)}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t.cancel} onPress={onCancel} hitSlop={8} style={styles.close}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
            {item.methods.length > 1 && (
              <View style={styles.methods} accessibilityRole="radiogroup">
                {item.methods.map((m) => {
                  const selected = m === method;
                  return (
                    <Pressable
                      key={m}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setMethod(m)}
                      style={[styles.method, selected && styles.methodSelected]}
                    >
                      <Text style={[styles.methodText, selected && styles.methodTextSelected]}>{METHOD_LABEL[m]}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {method === 'weight' && (
              <View style={styles.wheels}>
                <WheelPicker
                  values={KG_VALUES}
                  index={parts.kg}
                  onChange={(kg) => setGramsParts(kg, parts.gramsPart)}
                  caption={t.kg}
                  accessibilityLabel={t.kg}
                />
                <Text style={styles.wheelDot}>.</Text>
                <WheelPicker
                  values={GRAM_VALUES}
                  index={parts.gramsPart / WEIGHT_STEP_GRAMS}
                  onChange={(i) => setGramsParts(parts.kg, i * WEIGHT_STEP_GRAMS)}
                  caption={t.gramsUnit}
                  accessibilityLabel={t.gramsUnit}
                />
              </View>
            )}

            {method === 'qty' && (
              <View style={styles.wheels}>
                <WheelPicker values={QTY_VALUES} index={Math.min(Math.max(qty, 1), MAX_QTY) - 1} onChange={(i) => setQty(i + 1)} caption={t.quantity} accessibilityLabel={t.quantity} />
              </View>
            )}

            {method === 'amount' && (
              <View style={styles.amountBox}>
                <View style={styles.amountDisplay}>
                  <Text style={styles.amountValue} accessibilityLabel={t.amountDisplayAria(amountText || '0')}>
                    {CURRENCY_SYMBOL}
                    {amountText || '0'}
                  </Text>
                  <Text style={styles.amountHint}>{isPiece ? '' : line ? `≈ ${formatWeight(line.grams)}` : '—'}</Text>
                </View>
                <View style={styles.amountEntry}>
                  <View style={styles.keypad}>
                    <Keypad leftKey={CLEAR_KEY} keyHeight={48} onKey={(k) => setAmountText((prev) => (k === CLEAR_KEY ? '' : applyRupeesKey(prev, k)))} />
                  </View>
                  <View style={styles.quick}>
                    {QUICK_AMOUNTS.map((rupees) => (
                      <Pressable
                        key={rupees}
                        accessibilityRole="button"
                        accessibilityLabel={t.amountAria(formatMoney(rupees * 100))}
                        onPress={() => setAmountText(String(rupees))}
                        style={({ pressed }) => [styles.chip, (pressed || amountText === String(rupees)) && styles.chipOn]}
                      >
                        <Text style={styles.chipText}>
                          {CURRENCY_SYMBOL}
                          {rupees}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                {isPiece && (
                  <View style={styles.optionalQty}>
                    <Text style={styles.optionalLabel}>{t.qtyOptional}</Text>
                    <View style={styles.optionalSteppers}>
                      <StepButton size={48} label="−" accessibilityLabel={t.decreaseQty} disabled={amountQty <= 1} onStep={() => setAmountQty((q) => Math.max(q - 1, 1))} />
                      <Text style={styles.optionalValue}>{amountQty}</Text>
                      <StepButton size={48} label="+" accessibilityLabel={t.increaseQty} disabled={amountQty >= MAX_QTY} onStep={() => setAmountQty((q) => Math.min(q + 1, MAX_QTY))} />
                    </View>
                  </View>
                )}
              </View>
            )}

            {showRate && (
              <View style={styles.rateRow}>
                <Text style={styles.rateLabel}>{t.rate}</Text>
                <StepButton
                  size={48}
                  label="−"
                  accessibilityLabel={t.adjustDown(formatMoney(ADJUST_STEP_MINOR))}
                  disabled={!canAdjust || rate - list <= -maxAdjustMinor || rate <= ADJUST_STEP_MINOR}
                  onStep={() => setRate((r) => clampRate(r - ADJUST_STEP_MINOR, list, maxAdjustMinor))}
                />
                <View style={styles.rateValue}>
                  <Text style={styles.rateText}>{formatRate(rate, item.unit)}</Text>
                  <Text style={[styles.rateNote, adjusted !== 0 && styles.rateNoteChanged]}>
                    {!canAdjust ? t.rateLocked : adjusted !== 0 ? `${t.listRate(formatRate(list, item.unit))} · ${adjusted > 0 ? '+' : '−'}${formatMoney(Math.abs(adjusted))}` : t.adjustLimit(formatMoney(maxAdjustMinor))}
                  </Text>
                </View>
                <StepButton
                  size={48}
                  label="+"
                  accessibilityLabel={t.adjustUp(formatMoney(ADJUST_STEP_MINOR))}
                  disabled={!canAdjust || rate - list >= maxAdjustMinor}
                  onStep={() => setRate((r) => clampRate(r + ADJUST_STEP_MINOR, list, maxAdjustMinor))}
                />
              </View>
            )}
          </ScrollView>

          <View style={styles.summary} accessibilityLiveRegion="polite">
            <View style={styles.summaryText}>
              <Text style={styles.summaryMethod}>{METHOD_LABEL[method]}</Text>
              <Text style={styles.summaryDetail} numberOfLines={1}>
                {detail}
              </Text>
            </View>
            <Text style={styles.summaryTotal}>{formatMoney(total)}</Text>
          </View>

          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={[styles.action, styles.cancel]}>
              <Text style={styles.cancelText}>{t.cancel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: line === null }}
              disabled={line === null}
              onPress={() => line && onConfirm(line)}
              style={[styles.action, styles.confirm, line === null && styles.confirmDisabled]}
            >
              <Text style={styles.confirmText}>{editing ? t.updateLine : t.addToBill}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: 'rgba(8, 24, 14, 0.55)' },
  sheet: { width: '100%', maxWidth: 560, borderRadius: 22, backgroundColor: colors.bg, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerText: { flex: 1 },
  title: { fontSize: 22, lineHeight: 32, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, lineHeight: 24, fontWeight: '600', color: colors.primary },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  closeText: { fontSize: 18, color: colors.muted },
  body: { flexGrow: 0 },
  bodyContent: { gap: spacing.md, padding: spacing.lg },
  methods: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: 16, backgroundColor: colors.border },
  method: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  methodSelected: { backgroundColor: colors.primary },
  methodText: { fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.text },
  methodTextSelected: { color: colors.onPrimary },
  wheels: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  wheelDot: { fontSize: 30, fontWeight: '800', color: colors.muted, marginTop: 22 },
  amountBox: { gap: spacing.sm },
  amountDisplay: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: spacing.lg, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  amountValue: { fontSize: 36, lineHeight: 52, fontWeight: '800', color: colors.text },
  amountHint: { fontSize: 20, lineHeight: 30, fontWeight: '700', color: colors.primary },
  amountEntry: { flexDirection: 'row', gap: spacing.md },
  keypad: { flex: 3 },
  quick: { flex: 1, minWidth: 84, gap: spacing.sm },
  chip: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primarySoft },
  chipText: { fontSize: 20, fontWeight: '700', color: colors.primary },
  optionalQty: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  optionalLabel: { flex: 1, fontSize: 15, lineHeight: 24, fontWeight: '600', color: colors.text },
  optionalSteppers: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  optionalValue: { minWidth: 36, textAlign: 'center', fontSize: 22, fontWeight: '800', color: colors.text },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  rateLabel: { fontSize: 15, lineHeight: 24, fontWeight: '700', color: colors.muted, paddingLeft: spacing.xs },
  rateValue: { flex: 1, alignItems: 'center' },
  rateText: { fontSize: 20, lineHeight: 28, fontWeight: '800', color: colors.text },
  rateNote: { fontSize: 12, lineHeight: 18, color: colors.muted },
  rateNoteChanged: { fontWeight: '700', color: colors.warning },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.primarySoft, borderTopWidth: 1, borderTopColor: colors.border },
  summaryText: { flex: 1 },
  summaryMethod: { fontSize: 13, lineHeight: 20, fontWeight: '700', color: colors.primary },
  summaryDetail: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.text },
  summaryTotal: { fontSize: 30, lineHeight: 40, fontWeight: '800', color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.surface },
  action: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancel: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cancelText: { fontSize: 17, lineHeight: 26, fontWeight: '700', color: colors.text },
  confirm: { flex: 2, backgroundColor: colors.primary },
  confirmDisabled: { backgroundColor: colors.disabled },
  confirmText: { fontSize: 18, lineHeight: 28, fontWeight: '800', color: colors.onPrimary },
});
