// Starts the local Firestore and Auth emulators with the project's own security rules (firestore.rules), so split,
// credit and the rest can be tried for real without touching the live project:
//
//   npm run emulators
//
// Leave it running, then in another terminal: `npm run emulators:seed` and `npm run dev:emulator -w shop`.
// The data lives in memory and is gone when this stops. Needs Java: see scripts/lib/java-env.mjs.
import { spawn } from 'node:child_process';
import { EMULATOR_PROJECT, emulatorEnv, root } from './lib/java-env.mjs';

const child = spawn('npx', ['--yes', 'firebase-tools', 'emulators:start', '--only', 'firestore,auth', '--project', EMULATOR_PROJECT], {
  cwd: root,
  env: emulatorEnv(),
  stdio: 'inherit',
  shell: true,
});
child.on('exit', (code) => process.exit(code ?? 0));
