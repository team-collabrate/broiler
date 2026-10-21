// Shared by the account scripts: Firebase config from the environment, and PINs read from a hidden
// prompt (or from OWNER_PIN / COUNTER_PIN when there is no terminal), so a PIN never sits in shell
// history or in a file.
import readline from 'node:readline';

export function firebaseConfig() {
  const env = process.env;
  if (env.USE_EMULATOR === '1') {
    return { apiKey: 'demo-key', authDomain: 'localhost', projectId: 'demo-broiler', storageBucket: 'demo-broiler.appspot.com', messagingSenderId: '0', appId: '1:0:web:0' };
  }
  const config = {
    apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };
  if (!config.apiKey || !config.projectId || !config.appId) {
    console.error('Missing EXPO_PUBLIC_FIREBASE_* values. Run with: node --env-file=apps/pos/.env <script>');
    process.exit(1);
  }
  return config;
}

/** Reads a PIN without echoing it. `envName` (for example OWNER_PIN) is used instead when it is set. */
export function askPin(label, envName) {
  if (process.env[envName]) return Promise.resolve(process.env[envName]);
  if (!process.stdin.isTTY) {
    console.error(`No terminal to ask for the ${label}. Set ${envName} in the environment instead.`);
    process.exit(1);
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = rl._writeToOutput;
    rl._writeToOutput = (text) => {
      // Show the prompt, but print nothing for the characters typed.
      if (text.startsWith(label)) write.call(rl, text);
    };
    rl.question(`${label}: `, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}
