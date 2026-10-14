import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { describeError, PinScreen, useSession, type Role } from '@broiler/shared';
import { startFirebase } from './src/firebase';
import { PosScreen } from './src/screens/PosScreen';
import { t } from './src/strings';
import { colors, spacing } from './src/theme';

type Boot = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string; detail: string };

/**
 * Dev only: `__DEV__` is false in a built app, so this can never switch on in production. It lets
 * the screens be checked before the PIN accounts exist (it needs rules that allow anonymous users).
 */
const DEV_SIGN_IN = __DEV__ && process.env.EXPO_PUBLIC_DEV_ANON === '1';

/** Shows the PIN screen until a counter (or the owner) is signed in, then the till. */
function Gate() {
  const { session, signIn, signOut, touch } = useSession({ developmentSignIn: DEV_SIGN_IN });
  // The counter's PIN, kept in memory only, so the till can sign back in as the counter after the
  // owner has been in to set today's rates.
  const counterPin = useRef<string | null>(null);

  if (session.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (session.status === 'out') {
    return (
      <PinScreen
        title={t.signInTitle}
        subtitle={t.signInSubtitle}
        onSubmit={async (pin) => {
          await signIn('counter', pin);
          counterPin.current = pin;
        }}
      />
    );
  }

  const restoreCounter = async () => {
    if (counterPin.current === null) return;
    await signIn('counter', counterPin.current);
  };
  const lock = () => {
    counterPin.current = null;
    void signOut();
  };

  return (
    // Any touch counts as activity; the till locks itself after 30 minutes of none.
    <View style={styles.root} onStartShouldSetResponderCapture={() => { touch(); return false; }}>
      <PosScreen role={session.role as Role} signInOwner={(pin) => signIn('owner', pin)} restoreCounter={restoreCounter} onLock={lock} />
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

  // On the web, tell the browser the page is Tamil (right font, right hyphenation) and name the tab.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.documentElement.lang = 'ta';
    document.title = t.appTitle;
    // A mouse drag on the weight meter must not highlight text, and a double-tap must not zoom.
    document.body.style.userSelect = 'none';
    document.documentElement.style.touchAction = 'manipulation';
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
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
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, backgroundColor: colors.bg },
  errorTitle: { fontSize: 20, lineHeight: 30, fontWeight: '700', color: colors.text },
  errorDetail: { fontSize: 12, lineHeight: 18, textAlign: 'center', color: colors.disabled },
  errorMessage: { fontSize: 15, lineHeight: 24, textAlign: 'center', color: colors.muted },
  retry: { height: 48, paddingHorizontal: spacing.xl, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  retryText: { fontSize: 16, fontWeight: '700', color: colors.onPrimary },
});
