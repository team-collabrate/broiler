// Runs the rules tests (scripts/rules) against a Firestore emulator that it starts and stops itself:
//
//   npm run test:rules
//
// If `npm run emulators` is already running, stop it first (both want the same ports), or run the tests directly
// with `node --test scripts/rules/*.test.mjs`. Needs Java: see scripts/lib/java-env.mjs.
import { spawnSync } from 'node:child_process';
import { EMULATOR_PROJECT, emulatorEnv, root } from './lib/java-env.mjs';

const result = spawnSync('npx', ['--yes', 'firebase-tools', 'emulators:exec', '--only', 'firestore', '--project', EMULATOR_PROJECT, '"node --test scripts/rules/*.test.mjs"'], {
  cwd: root,
  env: emulatorEnv(),
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
