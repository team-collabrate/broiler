import { useState } from "react";
import { WORKER_NAMES } from "@kumbakonam/shared";

/**
 * The staff actually on shift, saved on the order as `billedByName` and
 * printed on the bill as `workerName` — separate from `sessionUser.name`,
 * which is just whoever's PIN unlocked the tablet. One shared PIN,
 * multiple people working the counter across a day, so the account name
 * alone ("worker") was showing up on every receipt (and every order
 * record) regardless of who actually rang it up.
 *
 * The name list itself (WORKER_NAMES) is shared with the Owner app, which
 * colours each order's history row by whichever name billed it — see
 * shared/src/utils/workerNames.ts.
 *
 * Persisted per device (not per session) so picking a name once at the
 * start of a shift sticks across reloads and re-logins until someone
 * changes it — there's no server record of shifts to key this off of.
 */
export { WORKER_NAMES };

const STORAGE_KEY = "kumbakonam.activeWorkerName";

function readStored(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && (WORKER_NAMES as readonly string[]).includes(stored) ? stored : WORKER_NAMES[0];
  } catch {
    return WORKER_NAMES[0];
  }
}

export function useActiveWorkerName(): [string, (name: string) => void] {
  const [name, setName] = useState<string>(readStored);

  const update = (next: string) => {
    setName(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Falls back to in-memory-only for this load — not worth surfacing.
    }
  };

  return [name, update];
}
