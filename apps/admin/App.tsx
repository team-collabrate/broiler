import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { describeError, PinScreen, useSession } from '@broiler/shared';
import { startFirebase } from './src/firebase';

const LOGO = require('./assets/brand/logo.jpeg');
import { AdminHome } from './src/screens/AdminHome';
import { t } from './src/strings';
import { colors, spacing } from './src/theme';

type Boot = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string; detail: string };

/** Dev only: false in a built app. See the POS app's App.tsx. */
const DEV_SIGN_IN = __DEV__ && process.env.EXPO_PUBLIC_DEV_ANON === '1';

/** Shows the PIN screen until the owner is signed in. The counter's account is refused here. */
function Gate() {
  const { session, signIn, signOut, touch } = useSession({ developmentSignIn: DEV_SIGN_IN });
  const notOwner = session.status === 'in' && session.role !== 'owner' && !DEV_SIGN_IN;

  // The counter account signed in on this device: it has no business in the admin app.
  useEffect(() => {
    if (notOwner) void signOut();
  }, [notOwner, signOut]);

  if (session.status === 'loading' || notOwner) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (session.status === 'out') {
    return <PinScreen logo={LOGO} title={t.appTitle} subtitle={t.signInSubtitle} onSubmit={(pin) => signIn('owner', pin)} />;
  }
  return (
    <View style={styles.root} onStartShouldSetResponderCapture={() => { touch(); return false; }}>
      <AdminHome onLock={() => void signOut()} />
    </View>
  );
}

export default function App() {
  const [boot, setBoot] = useState<Boot>({ status: 'loading' });

  const start = useCallback(() => {
    setBoot({ status: 'loading' });
    try {
      startFirebase();
      setBoot({ status: 'ready' });
    } catch (e) {
      setBoot({ status: 'error', message: describeError(e), detail: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(start, [start]);

  // On the web, tell the browser the page is Tamil and name the tab.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.lang = 'ta';
    document.title = t.appTitle;
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {boot.status === 'ready' ? (
        <Gate />
      ) : (
        <View style={styles.center}>
          {boot.status === 'loading' ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <>
              <Text style={styles.errorTitle}>{t.cantConnect}</Text>
              <Text style={styles.errorMessage}>{boot.message}</Text>
              {/* The raw reason, small, so a developer can still see what went wrong. */}
              <Text style={styles.errorDetail}>{boot.detail}</Text>
              <Pressable accessibilityRole="button" onPress={start} style={styles.retry}>
                <Text style={styles.retryText}>{t.tryAgain}</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  errorTitle: { fontSize: 20, lineHeight: 30, fontWeight: '700', color: colors.text },
  errorDetail: { fontSize: 12, lineHeight: 18, textAlign: 'center', color: colors.border },
  errorMessage: { fontSize: 15, lineHeight: 24, textAlign: 'center', color: colors.muted },
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
