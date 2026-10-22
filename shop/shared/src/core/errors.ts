// Turns a Firebase or app error into a short English message for the counter screen.

const NO_ACCESS = "You don't have access to this data.";
const NO_NETWORK = "Can't reach the server. Check the connection.";
const WRONG_PIN = 'Wrong PIN.';
const TOO_MANY = 'Too many wrong PINs. Try again in a little while.';
const BAD_PIN_FORMAT = 'The PIN must be 4 to 6 digits.';
const NEEDS_CONNECTION = 'A credit bill needs the internet. Try again when the connection is back.';
const GENERIC = 'Something went wrong. Please try again.';

/**
 * An error whose message was written for the person at the counter, such as a failed check inside
 * createOrder. `describeError` shows it as it is; any other error is replaced by a generic message, so
 * raw Firebase text never reaches the screen.
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}

/** Firestore codes look like `unavailable`; Auth codes look like `auth/network-request-failed`. */
export function describeError(error: unknown): string {
  if (error instanceof UserError) return error.message;
  const code = String((error as { code?: unknown } | null)?.code ?? '');
  if (code === 'permission-denied' || code.endsWith('/permission-denied')) return NO_ACCESS;
  if (code === 'unavailable' || code === 'deadline-exceeded' || code === 'auth/network-request-failed') return NO_NETWORK;
  // Sign-in: a wrong PIN and a missing account look the same on purpose, so nobody can probe which exist.
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-login-credentials'].includes(code)) return WRONG_PIN;
  if (code === 'auth/too-many-requests') return TOO_MANY;
  if (code === 'app/invalid-pin') return BAD_PIN_FORMAT;
  if (code === 'app/needs-connection') return NEEDS_CONNECTION;
  if (code === 'app/too-many-attempts') return TOO_MANY;
  return GENERIC;
}
