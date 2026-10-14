import type { BillData } from '../bill';

// The native (Android/iOS) side: nothing prints from here yet. Bluetooth thermal printing is
// Phase 3 of the roadmap. The web version of this file (BillPrint.web.tsx) does the real work.

export const canPrint = false;

export function printBill(): void {}

/** Renders nothing on native; on the web it keeps a print-only copy of the bill in the page. */
export function BillPrint(_props: { bill: BillData | null }) {
  return null;
}
