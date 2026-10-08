/// <reference types="expo/types" />

// Expo inlines EXPO_PUBLIC_* values at bundle time. Declared here so `tsc` works
// before `expo start` has generated expo-env.d.ts.
declare const process: { env: Record<string, string | undefined> };
