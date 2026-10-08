import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { startFirebase } from './src/firebase';
import { AdminHome } from './src/screens/AdminHome';
import { colors, spacing } from './src/theme';

type Boot = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

export default function App() {
  const [boot, setBoot] = useState<Boot>({ status: 'loading' });

  const start = useCallback(() => {
    setBoot({ status: 'loading' });
    startFirebase().then(
      () => setBoot({ status: 'ready' }),
      (e) => setBoot({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
    );
  }, []);

  useEffect(start, [start]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {boot.status === 'ready' ? (
        <AdminHome />
      ) : (
        <View style={styles.center}>
          {boot.status === 'loading' ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <>
              <Text style={styles.errorTitle}>Can’t connect</Text>
              <Text style={styles.errorMessage}>{boot.message}</Text>
              <Pressable accessibilityRole="button" onPress={start} style={styles.retry}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  errorTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
  errorMessage: { fontSize: 15, lineHeight: 22, textAlign: 'center', color: colors.muted },
  retry: {
    height: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  retryText: { fontSize: 16, fontWeight: '700', color: colors.onPrimary },
});
