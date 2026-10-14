import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirestoreDb } from "../firebase";
import type { AppUser, SessionUser, UserRole } from "../types";

const COLLECTION = "users";

/**
 * PIN login lookup — finds an active user whose pinHash matches, optionally
 * scoped to a role (each app only accepts its own role's PIN). Returns null
 * on no match; never throws for "not found" so callers can show a generic
 * "Incorrect PIN" message without leaking which part was wrong.
 */
export async function findUserByPinHash(
  pinHash: string,
  role?: UserRole,
): Promise<SessionUser | null> {
  const db = getFirestoreDb();
  const constraints = [
    where("pinHash", "==", pinHash),
    where("active", "==", true),
    ...(role ? [where("role", "==", role)] : []),
    limit(1),
  ];
  const snap = await getDocs(query(collection(db, COLLECTION), ...constraints));
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data() as AppUser;
  return { userId: d.id, name: data.name, role: data.role };
}

export async function getUserById(userId: string): Promise<AppUser | null> {
  const db = getFirestoreDb();
  const snap = await getDoc(doc(db, COLLECTION, userId));
  if (!snap.exists()) return null;
  return { userId: snap.id, ...(snap.data() as Omit<AppUser, "userId">) };
}

export async function listUsers(): Promise<AppUser[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => ({ userId: d.id, ...(d.data() as Omit<AppUser, "userId">) }));
}

export interface CreateUserInput {
  name: string;
  role: UserRole;
  pinHash: string;
}

export async function createUser(input: CreateUserInput): Promise<string> {
  const db = getFirestoreDb();
  const ref = await addDoc(collection(db, COLLECTION), {
    ...input,
    active: true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function setUserActive(userId: string, active: boolean): Promise<void> {
  const db = getFirestoreDb();
  await updateDoc(doc(db, COLLECTION, userId), { active });
}

export async function updateUserPin(userId: string, pinHash: string): Promise<void> {
  const db = getFirestoreDb();
  await updateDoc(doc(db, COLLECTION, userId), { pinHash });
}
