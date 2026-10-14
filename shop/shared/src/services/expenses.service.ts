import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteField,
  where,
  type FirestoreError,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreDb } from "../firebase";
import type { Expense } from "../types";

const COLLECTION = "expenses";

export interface CreateExpenseInput {
  name: string;
  amount: number;
  workerId: string;
}

export interface CreateExpenseResult {
  expenseId: string;
  /**
   * Settles when the server acknowledges the write, or rejects if it is
   * refused.
   *
   * Do not await this before telling the worker the expense is saved. Per the
   * Firestore SDK, a write promise "won't resolve while you're offline" — the
   * document is in the local cache and will sync by itself, but awaiting the
   * promise would leave the counter staring at a spinner for the length of a
   * wifi outage. Attach a catch to it instead, to surface a genuine refusal.
   */
  committed: Promise<void>;
}

/**
 * Records money spent from the till. Returns immediately: the id is minted
 * locally, so nothing here needs the network.
 */
export function createExpense(input: CreateExpenseInput): CreateExpenseResult {
  const db = getFirestoreDb();
  const ref = doc(collection(db, COLLECTION));
  const committed = setDoc(ref, {
    ...input,
    syncedAt: null,
    createdAt: serverTimestamp(),
  });
  return { expenseId: ref.id, committed };
}

export async function getExpensesInRange(start: Date, end: Date): Promise<Expense[]> {
  const db = getFirestoreDb();
  const q = query(
    collection(db, COLLECTION),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ expenseId: d.id, ...(d.data() as Omit<Expense, "expenseId">) }));
}

/** Realtime subscription, for whatever eventually reports on spend. */
export function subscribeToExpensesInRange(
  start: Date,
  end: Date,
  onChange: (expenses: Expense[]) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  const q = query(
    collection(db, COLLECTION),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<", Timestamp.fromDate(end)),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((d) => ({ expenseId: d.id, ...(d.data() as Omit<Expense, "expenseId">) })));
    },
    onError,
  );
}

/** Correction path for a mistyped entry. */
export async function deleteExpense(expenseId: string): Promise<void> {
  const db = getFirestoreDb();
  await deleteDoc(doc(db, COLLECTION, expenseId));
}

const MAX_RECEIPT_PHOTO_BYTES = 8 * 1024 * 1024;

export class ReceiptPhotoTooLargeError extends Error {
  constructor() {
    super("That photo is too large (max 8 MB).");
    this.name = "ReceiptPhotoTooLargeError";
  }
}

export class ReceiptPhotoNotConfiguredError extends Error {
  constructor() {
    super("Photo upload isn't set up yet.");
    this.name = "ReceiptPhotoNotConfiguredError";
  }
}

/**
 * Cloudinary, not Firebase Storage — Storage turned out to require the
 * Blaze billing plan just to turn on at all (a real card on file), which
 * this project has deliberately avoided everywhere else; Cloudinary's free
 * tier needs no card and supports unsigned client-side uploads (a public
 * cloud name + upload preset, no secret key anywhere in this app), which
 * fits this project's no-backend constraint the same way everything else
 * here already does. Filled from each app's .env — see
 * worker-app/.env.example and owner-app/.env.example.
 */
async function uploadToCloudinary(file: Blob): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new ReceiptPhotoNotConfiguredError();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "expense-receipts");

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { secure_url: string };
  return data.secure_url;
}

/**
 * Attaches a bill/receipt photo to an already-recorded expense (requested
 * 2026-09-05). Deliberately a separate call from createExpense(), not a
 * parameter on it: an image upload has no offline queue the way a
 * Firestore write does (see Expense.receiptPhotoUrl's own comment), so
 * making it part of expense creation would mean a slow or failed upload
 * could hold up — or even fail — the actual money-tracking write the
 * offline-first till flow depends on. Callers create the expense first
 * (already fast, already offline-safe), then best-effort try this
 * afterward; a rejection here should be shown as "couldn't attach the
 * photo", never as "couldn't record the expense".
 */
export async function uploadExpenseReceipt(expenseId: string, file: Blob): Promise<string> {
  if (file.size > MAX_RECEIPT_PHOTO_BYTES) throw new ReceiptPhotoTooLargeError();

  const url = await uploadToCloudinary(file);

  const db = getFirestoreDb();
  await updateDoc(doc(db, COLLECTION, expenseId), { receiptPhotoUrl: url });

  return url;
}

/**
 * Correction path alongside deleteExpense — clears the photo reference
 * from the expense, not the expense record itself.
 *
 * Only clears the Firestore field; it does NOT delete the underlying image
 * from Cloudinary. An unsigned upload preset (no server, no API secret —
 * see uploadToCloudinary) can only ever create assets, never remove them;
 * doing that safely needs a signed request, which needs a secret key this
 * client-only app has nowhere safe to hold. The orphaned image just sits
 * unused in Cloudinary's free tier (well within its storage allowance for
 * this cafe's volume) rather than being a live, reachable link from
 * anywhere in the app once this runs.
 */
export async function deleteExpenseReceipt(expenseId: string): Promise<void> {
  const db = getFirestoreDb();
  // deleteField(), not null — the type (Expense.receiptPhotoUrl) is
  // string | undefined, matching "absent entirely" for every expense that
  // never had a photo; a stored null would be a third state nothing else
  // in this codebase expects to handle.
  await updateDoc(doc(db, COLLECTION, expenseId), { receiptPhotoUrl: deleteField() });
}
