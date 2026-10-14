/**
 * The staff who work the counter, and the colour each one shows up as on
 * the Owner app's order history — a small dot instead of writing the full
 * name on every row (see OrderHistoryRow.tsx). One list, shared by both
 * apps: the Worker app's shift picker (useActiveWorkerName) offers these
 * names, and whichever one is picked gets saved on the order as
 * `billedByName` (see Order.billedByName) — this is what the dot's colour
 * is keyed off of.
 *
 * Three fixed names, not a Firestore-managed list — nobody's asked for
 * the ability to add or remove staff without a code change yet. If that
 * changes, this is the one place to make it dynamic.
 */
export const WORKER_NAMES = ["Gayathri", "Maari", "Ramesh"] as const;

export type WorkerName = (typeof WORKER_NAMES)[number];

/** Pink / blue / green — three hues nothing else in the theme uses (the
 *  accent is orange), and spread enough to still read apart for someone
 *  colour-blind to red/green specifically, since blue is a third anchor. */
export const WORKER_COLORS: Record<WorkerName, string> = {
  Gayathri: "#ec4899",
  Maari: "#3b82f6",
  Ramesh: "#10b981",
};

/** Neutral fallback for a name outside the current list (e.g. an order
 *  billed under a name later removed from WORKER_NAMES) — a grey dot
 *  reads as "someone, unspecified", not as a rendering bug. */
export const WORKER_COLOR_FALLBACK = "#8b8f9a";

export function colorForWorkerName(name: string | undefined): string {
  if (!name) return WORKER_COLOR_FALLBACK;
  return (WORKER_COLORS as Record<string, string>)[name] ?? WORKER_COLOR_FALLBACK;
}
