import type { KeyValueStore } from "../core";

/**
 * The browser's `localStorage` when it works. When storage is blocked or full (a private window, a locked-down
 * WebView) it falls back to a copy kept in memory, so the till still sells for this launch instead of crashing.
 */
export function browserStore(): KeyValueStore {
  const memory = new Map<string, string>();
  return {
    getItem(key) {
      try {
        const stored = localStorage.getItem(key);
        if (stored !== null) return stored;
      } catch {
        /* fall back to memory */
      }
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, value);
      try {
        localStorage.setItem(key, value);
      } catch {
        /* kept in memory only */
      }
    },
  };
}
