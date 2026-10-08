import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RangePreset } from '@broiler/shared';
import { RangePicker } from '../components/RangePicker';
import { useOrders } from '../hooks/useOrders';
import { colors, spacing } from '../theme';
import { DashboardScreen } from './DashboardScreen';
import { OrdersScreen } from './OrdersScreen';

type Tab = 'dashboard' | 'orders';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'orders', label: 'Orders' },
];

export function AdminHome() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [preset, setPreset] = useState<RangePreset>('today');
  // One live subscription feeds both tabs, so switching tabs never refetches.
  const { orders, error } = useOrders(preset);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Broiler Admin</Text>
      </View>

      <RangePicker value={preset} onChange={setPreset} />

      <View style={styles.body}>
        {error ? (
          <Text style={styles.message}>Could not load sales: {error}</Text>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.primary },
  body: { flex: 1 },
  loading: { marginTop: spacing.xl },
  message: { margin: spacing.lg, fontSize: 15, lineHeight: 22, color: colors.muted },
  tabBar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  tab: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 15, fontWeight: '600', color: colors.muted },
  tabTextSelected: { color: colors.primary },
  tabIndicator: { position: 'absolute', top: 0, width: 40, height: 3, borderRadius: 2, backgroundColor: colors.primary },
});
