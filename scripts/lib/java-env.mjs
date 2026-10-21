// The environment for running Firebase's emulators: the project's own portable Java (in .tools/jdk21, never committed)
// when it exists, otherwise whatever Java is already on this machine. Used by run-emulators.mjs and test-rules.mjs.
import { existsSync, readdirSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

/** The emulators are started for this made-up project id: the `demo-` prefix makes them refuse to touch a real project. */
export const EMULATOR_PROJECT = 'demo-broiler';

export function emulatorEnv() {
  const jdks = join(root, '.tools', 'jdk21');
  const env = { ...process.env };
  if (existsSync(jdks)) {
    const home = readdirSync(jdks, { withFileTypes: true }).find((d) => d.isDirectory() && existsSync(join(jdks, d.name, 'bin')));
    if (home) {
      env.JAVA_HOME = join(jdks, home.name);
      env.PATH = `${join(env.JAVA_HOME, 'bin')}${delimiter}${env.PATH}`;
    }
  }
  return env;
}
