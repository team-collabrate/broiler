import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  applyRateKey,
  CURRENCY_SYMBOL,
  dayKey,
  categoryLabel,
  describeError,
  formatRateInput,
  itemName,
  unitSuffix,
  parseRateInput,
  setMenuRates,
  type MenuItem,
} from '@broiler/shared';
import { t } from '../strings';
import { colors, spacing } from '../theme';
import { Keypad } from './Keypad';

interface Props {
  items: MenuItem[];
  /** Leave the rates view (after saving, or on Back). */
  onClose: () => void;
}

/** True when this item's rate hasn't been set (or confirmed) today. */
export function isRateStale(item: MenuItem, now: Date = new Date()): boolean {
  return item.rateUpdatedAt === null || dayKey(item.rateUpdatedAt) !== dayKey(now);
}

function hint(item: MenuItem): string {
  if (item.rateUpdatedAt === null) return t.rateNever;
  return isRateStale(item) ? t.rateNotToday : t.rateToday;
}

/**
 * Today's rate for each item (per kg, or per piece for items sold by count), grouped by category and
 * shown on the page in place of the items and sale panel (no popup). Pick a type, type its rate on the keypad. Saving confirms every rate shown,
 * so "same as yesterday" is one tap.
 */
export function RatesPanel({ items, onClose }: Props) {
  const [texts, setTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((i) => [i.id, formatRateInput(i.rateMinor)])),
  );
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null);
  // The first key after picking a type replaces its rate, like selecting the whole field.
  const [fresh, setFresh] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = items.map((i) => ({ item: i, minor: parseRateInput(texts[i.id] ?? '') }));
  const allValid = parsed.length > 0 && parsed.every((p) => p.minor !== null);

  const select = (id: string) => {
    setActiveId(id);
    setFresh(true);
  };

  const press = (key: string) => {
    if (activeId === null) return;
    setTexts((prev) => ({ ...prev, [activeId]: applyRateKey(fresh ? '' : (prev[activeId] ?? ''), key) }));
    setFresh(false);
  };

  const save = async () => {
    if (!allValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await setMenuRates(parsed.map((p) => ({ id: p.item.id, rateMinor: p.minor as number })));
      onClose();
    } catch (e) {
      setError(describeError(e));
      setSaving(false);
    }
  };

  const today = new Date().toLocaleDateString('ta-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.todaysRate}</Text>
        <Text style={styles.subtitle}>{t.ratesSubtitle(today)}</Text>
      </View>

      <View style={styles.body}>
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {parsed.map(({ item, minor }, index) => {
            const active = item.id === activeId;
            const invalid = minor === null;
            const newGroup = index === 0 || parsed[index - 1].item.category !== item.category;
            return (
              <View key={item.id}>
                {newGroup && <Text style={styles.group}>{categoryLabel(item.category)}</Text>}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.rateAria(itemName(item), texts[item.id] || '–', item.unit === 'piece' ? 'எண்' : 'கிலோ')}
                accessibilityState={{ selected: active }}
                disabled={saving}
                onPress={() => select(item.id)}
                style={[styles.row, active && styles.rowActive, invalid && styles.rowInvalid]}
              >
                <View style={styles.rowInfo}>
                  <Text style={styles.name} numberOfLines={1}>
                    {itemName(item)}
                  </Text>
                  <Text style={[styles.hint, !isRateStale(item) && styles.hintOk]}>{hint(item)}</Text>
                </View>
                <Text style={[styles.value, invalid && styles.valueInvalid]}>
                  {CURRENCY_SYMBOL}
                  {texts[item.id] || '–'}
                  <Text style={styles.unit}> {unitSuffix(item.unit)}</Text>
                </Text>
              </Pressable>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.keys}>
          <Keypad leftKey="." keyHeight={60} onKey={press} />
        </View>
      </View>

      {error && (
        <View accessibilityRole="alert" style={styles.error}>
          <Text style={styles.errorText}>{t.ratesError(error)}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={saving} onPress={onClose} style={[styles.action, styles.secondary]}>
          <Text style={styles.secondaryText}>{t.back}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !allValid || saving }}
          disabled={!allValid || saving}
          onPress={save}
          style={[styles.action, styles.primary, (!allValid || saving) && styles.primaryDisabled]}
        >
          <Text style={styles.primaryText}>{saving ? t.saving : error ? t.retrySave : t.saveRates}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, gap: spacing.md, padding: spacing.lg, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  title: { fontSize: 22, lineHeight: 32, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted },
  body: { flex: 1, flexDirection: 'row', gap: spacing.lg },
  list: { flex: 3 },
  keys: { flex: 2, maxWidth: 360, justifyContent: 'flex-start' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 64,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  rowInvalid: { borderColor: colors.danger },
  rowInfo: { flex: 1 },
  group: { marginTop: spacing.xs, marginBottom: spacing.xs, fontSize: 14, lineHeight: 22, fontWeight: '800', color: colors.muted },
  name: { fontSize: 17, lineHeight: 26, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, lineHeight: 20, color: colors.warning },
  hintOk: { color: colors.primary },
  value: { fontSize: 26, fontWeight: '800', color: colors.text },
  valueInvalid: { color: colors.muted },
  unit: { fontSize: 15, fontWeight: '500', color: colors.muted },
  error: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.dangerSoft },
  errorText: { fontSize: 15, fontWeight: '600', color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  secondary: { paddingHorizontal: spacing.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  secondaryText: { fontSize: 16, fontWeight: '600', color: colors.text },
  primary: { flex: 1, backgroundColor: colors.primary },
  primaryDisabled: { backgroundColor: colors.disabled },
  primaryText: { fontSize: 17, fontWeight: '800', color: colors.onPrimary },
});
