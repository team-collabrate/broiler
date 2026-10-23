// Pure role and PIN helpers. No imports, so the unit tests can load this file directly under Node.

/**
 * Who is using the app. The role is decided by the account's sign-in email, which the Firestore
 * rules also check, so the app and the server agree on who may do what. Each account's password is
 * its PIN (see `pinPassword`). The `.invalid` domain can never receive mail, so nobody can reset
 * these accounts through an email link.
 */
export type Role = 'owner' | 'counter';

export const ROLE_EMAILS: Record<Role, string> = {
  owner: 'owner@broiler-pos.invalid',
  counter: 'counter@broiler-pos.invalid',
};

export const MIN_PIN_LENGTH = 4;
export const MAX_PIN_LENGTH = 6;

/** The PIN the apps ask for: six digits. The PIN screens sign in by themselves as the last digit is typed. */
export const PIN_LENGTH = 6;

/** True for 4 to 6 digits. */
export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

/**
 * The account password for a PIN. Firebase wants at least 6 characters and a PIN can be 4, so a
 * fixed prefix pads it. The prefix is not a secret; the PIN is the only thing an attacker has to
 * guess, and Firebase slows down repeated wrong guesses.
 */
export function pinPassword(pin: string): string {
  return `broiler-${pin}`;
}

/** The role an account's email stands for, or null for any other account. */
export function roleOfEmail(email: string | null | undefined): Role | null {
  const lower = email?.toLowerCase();
  if (lower === ROLE_EMAILS.owner) return 'owner';
  if (lower === ROLE_EMAILS.counter) return 'counter';
  return null;
}

/** Applies one keypad press to a PIN entry (digits only, up to the maximum length). */
export function applyPinKey(prev: string, key: string): string {
  if (key === '⌫') return prev.slice(0, -1);
  if (!/^\d$/.test(key)) return prev;
  return prev.length < MAX_PIN_LENGTH ? prev + key : prev;
}
