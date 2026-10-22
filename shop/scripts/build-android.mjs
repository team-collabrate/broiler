// Builds the Android app: a debug-signed APK that can be installed on the tablet.
//
//   npm run android:apk
//
// Steps: build the web app, copy it into the Android project (Capacitor), run Gradle, report where the APK is.
// It finds Java and the Android SDK by itself: JAVA_HOME if set, else the project's own Java in .tools/jdk21, else the
// one inside Android Studio; ANDROID_HOME / ANDROID_SDK_ROOT if set, else the usual per-user folder.
//
// The app talks to the Firebase project named in worker-app/.env at the moment it is built.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const shopRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const repoRoot = resolve(shopRoot, '..');
const androidDir = join(shopRoot, 'worker-app', 'android');
const isWindows = process.platform === 'win32';

const hasJava = (home) => existsSync(join(home, 'bin', isWindows ? 'java.exe' : 'java'));

function findJdk() {
  if (process.env.JAVA_HOME && hasJava(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
  const own = join(repoRoot, '.tools', 'jdk21');
  if (existsSync(own)) {
    const dir = readdirSync(own, { withFileTypes: true }).find((d) => d.isDirectory() && hasJava(join(own, d.name)));
    if (dir) return join(own, dir.name);
  }
  for (const studio of ['C:\\Program Files\\Android\\Android Studio\\jbr', '/Applications/Android Studio.app/Contents/jbr/Contents/Home']) {
    if (hasJava(studio)) return studio;
  }
  return null;
}

function findSdk() {
  const candidates = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Android', 'Sdk'), process.env.HOME && join(process.env.HOME, 'Android', 'Sdk'), process.env.HOME && join(process.env.HOME, 'Library', 'Android', 'sdk')];
  return candidates.find((p) => p && existsSync(join(p, 'platforms'))) ?? null;
}

const jdk = findJdk();
const sdk = findSdk();
if (!jdk) {
  console.error('No Java found. Set JAVA_HOME, put a JDK 21 in .tools/jdk21, or install Android Studio (see TESTING.md).');
  process.exit(1);
}
if (!sdk) {
  console.error('No Android SDK found. Install Android Studio, or set ANDROID_HOME to the SDK folder.');
  process.exit(1);
}
console.log(`Java: ${jdk}\nAndroid SDK: ${sdk}\n`);

const env = { ...process.env, JAVA_HOME: jdk, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, PATH: `${join(jdk, 'bin')}${delimiter}${process.env.PATH}` };

function run(label, command, args, cwd) {
  console.log(`\n== ${label}`);
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(`\n${label} failed (exit ${result.status}).`);
    process.exit(result.status ?? 1);
  }
}

run('Build the web app and copy it into the Android project', 'npm', ['run', 'android:sync', '-w', 'worker-app'], shopRoot);

// Tells Gradle where the SDK is (this file is for this computer only and is never committed).
writeFileSync(join(androidDir, 'local.properties'), `sdk.dir=${sdk.replace(/\\/g, '\\\\').replace(/:/g, '\\:')}\n`);

// The full path, quoted: a bare name is not found on Windows when the folder has spaces or the current folder is not searched.
run('Build the app with Gradle (the first time this downloads Gradle and the Android libraries: several minutes)', `"${join(androidDir, isWindows ? 'gradlew.bat' : 'gradlew')}"`, ['assembleDebug'], androidDir);

const apk = join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!existsSync(apk)) {
  console.error('Gradle finished but the APK is not where it was expected:', apk);
  process.exit(1);
}
console.log(`\nDone. The app is at:\n  ${apk}  (${(statSync(apk).size / 1048576).toFixed(1)} MB)\n`);
console.log('Install it on a tablet plugged in with USB debugging on:  adb install -r "' + apk + '"');
