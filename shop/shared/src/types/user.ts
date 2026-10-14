import type { Timestamp } from "firebase/firestore";

export type UserRole = "worker" | "owner";

/** `users/{userId}` document — see 05_Data_Model.md §2 */
export interface AppUser {
  userId: string;
  name: string;
  role: UserRole;
  /** SHA-256 hash of the 4-digit PIN. Never store or transmit the raw PIN. */
  pinHash: string;
  createdAt: Timestamp;
  active: boolean;
}

/** What we keep in memory after a successful PIN login — no pinHash. */
export interface SessionUser {
  userId: string;
  name: string;
  role: UserRole;
}
