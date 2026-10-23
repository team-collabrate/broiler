// Fills the local emulators (npm run emulators) with test accounts and the catalog, so the counter can be tried for real:
//
//   npm run emulators:seed
//
// Test PINs, valid only inside the emulator: owner and counter 121323. The data is in memory and is gone when the
// emulators stop. Nothing here touches the live project (USE_EMULATOR=1 forces the throwaway project id).
import { spawnSync } from 'node:child_process';
import { root } from './lib/java-env.mjs';

const env = { ...process.env, USE_EMULATOR: '1', OWNER_PIN: '121323', COUNTER_PIN: '121323' };
for (const args of [['scripts/seed-users.mjs'], ['scripts/seed-menu.mjs', '--go-live']]) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('\nEmulator ready. Owner and counter PIN 121323. Open the counter with: npm run dev:emulator -w shop');
