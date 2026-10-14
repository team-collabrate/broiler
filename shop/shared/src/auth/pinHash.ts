/**
 * SHA-256 hash of a PIN, hex-encoded, via the Web Crypto API.
 * Per TDD §5 — PINs are never stored or compared in plaintext.
 */
export async function hashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
