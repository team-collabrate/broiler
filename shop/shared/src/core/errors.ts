// Turns a Firebase or app error into a short Tamil message for staff. The wording follows the
// Kumbakonam POS's own error messages so both shops' apps read the same.

const NO_ACCESS = 'இந்தத் தரவை அணுக அனுமதி இல்லை.';
const NO_NETWORK = 'சர்வரை அணுக முடியவில்லை. உங்கள் இணைப்பைச் சரிபார்க்கவும்.';
const WRONG_PIN = 'பின் எண் தவறு.';
const TOO_MANY = 'பல முறை தவறான பின் எண் உள்ளிடப்பட்டது. சிறிது நேரம் கழித்து முயற்சிக்கவும்.';
const BAD_PIN_FORMAT = 'பின் எண் 4 முதல் 6 இலக்கங்களாக இருக்க வேண்டும்.';
const NEEDS_CONNECTION = 'கடன் பில்லுக்கு இணைய இணைப்பு தேவை. இணைப்பு வந்ததும் மீண்டும் முயற்சிக்கவும்.';
const GENERIC = 'ஏதோ தவறு ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.';

/** Firestore codes look like `unavailable`; Auth codes look like `auth/network-request-failed`. */
export function describeError(error: unknown): string {
  const code = String((error as { code?: unknown } | null)?.code ?? '');
  if (code === 'permission-denied' || code.endsWith('/permission-denied')) return NO_ACCESS;
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'auth/network-request-failed') return NO_NETWORK;
  // Sign-in: a wrong PIN and a missing account look the same on purpose, so nobody can probe which exist.
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-login-credentials'].includes(code)) return WRONG_PIN;
  if (code === 'auth/too-many-requests') return TOO_MANY;
  if (code === 'app/invalid-pin') return BAD_PIN_FORMAT;
  if (code === 'app/needs-connection') return NEEDS_CONNECTION;
  if (code === 'app/too-many-attempts') return TOO_MANY;
  // Messages we wrote ourselves (checks inside createOrder, setMenuRates) are already Tamil.
  const message = error instanceof Error ? error.message : '';
  if (/[\u0B80-\u0BFF]/.test(message)) return message;
  return GENERIC;
}
