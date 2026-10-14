import type { Timestamp } from "firebase/firestore";

/** `menu/{itemId}` document — see 05_Data_Model.md §3 */
export interface MenuItem {
  itemId: string;
  /** Canonical name — English/Tanglish, ASCII-safe. Used for orders, receipts, and ESC/POS printing (most thermal printers can't render Tamil glyphs). */
  name: string;
  /** Tamil-script display name shown on-screen when the app language is Tamil. Falls back to `name` if unset. */
  nameTa?: string;
  /** In INR, e.g. 40 */
  price: number;
  category?: string;
  /** Single emoji shown on the item card, e.g. "☕". No image upload — keeps the stack free of Storage. */
  icon?: string;
  /**
   * Where this item sits among the others in its own category — compared
   * only against other items with the same `category`, never across
   * categories, so the actual numbers (and any gaps between them) don't
   * matter, only their relative order. Optional in the type because a
   * handful of pre-migration docs could in principle still lack it, but
   * every doc in Firestore has one as of the sortOrder backfill (see
   * scripts/backfill-menu-sort-order.mjs) — `orderBy("sortOrder")` in
   * menu.service.ts silently drops any document missing the field, so a
   * new item must always get one at create time (createMenuItem does this
   * automatically).
   */
  sortOrder?: number;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
