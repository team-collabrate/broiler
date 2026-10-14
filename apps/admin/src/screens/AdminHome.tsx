import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RangePreset } from '@broiler/shared';
import { RangePicker } from '../components/RangePicker';
import { useOrders } from '../hooks/useOrders';
import { t } from '../strings';
import { colors, spacing } from '../theme';
import { DashboardScreen } from './DashboardScreen';
import { OrdersScreen } from './OrdersScreen';

type Tab = 'dashboard' | 'orders';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: t.tabDashboard },
  { id: 'orders', label: t.tabOrders },
];

export function AdminHome({ onLock }: { onLock: () => void }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [preset, setPreset] = useState<RangePreset>('today');
  // One live subscription feeds both tabs, so switching tabs never refetches.
  const { orders, error } = useOrders(preset);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.appTitle}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t.lockLabel} onPress={onLock} style={styles.lock}>
          <Text style={styles.lockText}>{t.lock}</Text>
        </Pressable>
      </View>

      {/* On a laptop or monitor the content stays in a readable column instead of stretching wide. */}
      <View style={styles.column}>
        <RangePicker value={preset} onChange={setPreset} />
      </View>

      <View style={[styles.body, styles.column]}>
        {error ? (
          <Text style={styles.message}>{t.loadError(error)}</Text>
        ) : orders === null ? (
          <ActivityIndicator style={styles.loading} color={colors.primary} />
        ) : tab === 'dashboard' ? (
          <DashboardScreen orders={orders} />
        ) : (
          <OrdersScreen orders={orders} preset={preset} />
        )}
      </View>

      <View style={styles.tabBar} accessibilityRole="tablist">
        {TABS.map(({ id, label }) => {
          const selected = id === tab;
          return (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setTab(id)}
              style={styles.tab}
            >
              <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{label}</Text>
              {selected && <View style={styles.tabIndicator} />}
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 20, lineHeight: 30, fontWeight: '800', color: colors.primary },
  lock: { height: 44, paddingHorizontal: spacing.lg, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  lockText: { fontSize: 15, lineHeight: 24, fontWeight: '700', color: colors.text },
  body: { flex: 1 },
  column: { width: '100%', maxWidth: 860, alignSelf: 'center' },
  loading: { marginTop: spacing.xl },
  message: { margin: spacing.lg, fontSize: 15, lineHeight: 22, color: colors.muted },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  tab: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 15, lineHeight: 24, fontWeight: '600', color: colors.muted },
  tabTextSelected: { color: colors.primary },
  tabIndicator: { position: 'absolute', top: 0, width: 40, height: 3, borderRadius: 2, backgroundColor: colors.primary },
});
