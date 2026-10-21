// The screen lock. After 30 minutes without a touch the till hides the sales screen and asks for the PIN, but the
// tablet stays signed in: signing out would stop queued sales from uploading and, with no internet, nobody could sign
// back in to keep selling. So the PIN is checked here on the tablet when the server cannot be reached, against a
// salted, slow hash kept from the last time the same PIN was accepted by the server.
//
// This is a screen lock, not the security boundary. The server's rules decide what each account may do; this only
// stops a passer-by from using a till that was left open. A 4-digit PIN has 10,000 possibilities, so anyone who can
// read the tablet's storage could find it, but the same person could already use the tablet's signed-in session.

export interface PinVerifier {
  /** Hex of 16 random bytes. */
  salt: string;
  /** Hex of the PBKDF2-SHA-256 result. */
  hash: string;
  iterations: number;
}

export const PIN_ITERATIONS = 100_000;

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const fromHex = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
};

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  // `slice` hands the browser a plain ArrayBuffer view of exactly the salt's bytes.
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt.slice(), iterations }, key, 256);
  return toHex(new Uint8Array(bits));
}

export async function makePinVerifier(pin: string, iterations = PIN_ITERATIONS): Promise<PinVerifier> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: toHex(salt), hash: await derive(pin, salt, iterations), iterations };
}

/** True when the PIN is the one the verifier was made from. A damaged verifier never matches. */
export async function checkPinVerifier(pin: string, verifier: PinVerifier): Promise<boolean> {
  if (!/^[0-9a-f]{32}$/.test(verifier.salt) || !/^[0-9a-f]{64}$/.test(verifier.hash)) return false;
  if (!Number.isInteger(verifier.iterations) || verifier.iterations < 1) return false;
  const attempt = await derive(pin, fromHex(verifier.salt), verifier.iterations);
  // Same length by construction; compare every character so the time taken does not reveal where it differs.
  let different = 0;
  for (let i = 0; i < attempt.length; i += 1) different |= attempt.charCodeAt(i) ^ verifier.hash.charCodeAt(i);
  return different === 0;
}

export function isPinVerifier(value: unknown): value is PinVerifier {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.salt === 'string' && typeof v.hash === 'string' && typeof v.iterations === 'number';
}

// --- Slowing down guesses -------------------------------------------------------------------------------------------

export interface AttemptState {
  failures: number;
  /** Time (milliseconds since 1970) until which no attempt is accepted; 0 when not blocked. */
  blockedUntil: number;
}

export const FREE_ATTEMPTS = 5;
export const BLOCK_MS = 30_000;
export const NO_ATTEMPTS: AttemptState = { failures: 0, blockedUntil: 0 };

/** After the free attempts are used, each wrong PIN blocks the next try for 30 seconds. */
export function afterWrongPin(state: AttemptState, now: number): AttemptState {
  const failures = state.failures + 1;
  return failures >= FREE_ATTEMPTS ? { failures, blockedUntil: now + BLOCK_MS } : { failures, blockedUntil: 0 };
}

/** Milliseconds still to wait before another try; 0 when a try is allowed. */
export function blockedForMs(state: AttemptState, now: number): number {
  return Math.max(0, state.blockedUntil - now);
}

export function parseAttempts(raw: string | null): AttemptState {
  try {
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      const { failures, blockedUntil } = parsed as Record<string, unknown>;
      if (typeof failures === 'number' && typeof blockedUntil === 'number' && failures >= 0 && blockedUntil >= 0) {
        return { failures, blockedUntil };
      }
    }
  } catch {
    /* fall through to a clean state */
  }
  return NO_ATTEMPTS;
}
