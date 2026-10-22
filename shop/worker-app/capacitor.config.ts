import type { CapacitorConfig } from '@capacitor/cli';

// The app loads from the hosted counter site, so a change to the web app reaches the tablet with a deploy
// (`npm run deploy:counter`), not a reinstall. The service worker keeps a copy on the tablet, so selling still works
// with no internet after the first load. The Android part (Bluetooth, permissions) still needs a new APK when it changes.
// Set CAP_LOCAL=1 when building to bundle the web app inside the APK instead (no hosted site needed).
const hosted = process.env.CAP_LOCAL !== '1';

const config: CapacitorConfig = {
  appId: 'com.broiler.pos',
  appName: 'Broiler POS',
  webDir: 'dist',
  ...(hosted && { server: { url: 'https://broiler-pos.web.app', androidScheme: 'https' } }),
};

export default config;
