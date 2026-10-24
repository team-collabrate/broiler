import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, Timestamp, type DocumentData } from "firebase/firestore";
import { labourEntryProblem, UserError, type LabourEntry, type LabourKind, type Labourer } from "../core";
import { getFirestoreDb } from "../firebase";

// The labour salary book (owner only, see firestore.rules). One fetch when the tab opens, no live listeners.

const toLabourer = (id: string, d: DocumentData): Labourer => ({
  id,
  name: String(d.name ?? ""),
  dayWageMinor: Number(d.dayWageMinor ?? 0),
  openingMinor: Number(d.openingMinor ?? 0),
  active: d.active !== false,
});

const toEntry = (id: string, d: DocumentData): LabourEntry => ({
  id,
  labourerId: String(d.labourerId ?? ""),
  dayKey: String(d.dayKey ?? ""),
  kind: d.kind as LabourKind,
  earnedMinor: Number(d.earnedMinor ?? 0),
  paidMinor: Number(d.paidMinor ?? 0),
  advanceMinor: Number(d.advanceMinor ?? 0),
  note: String(d.note ?? ""),
  createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : new Date(0),
});

/** Every worker, in the order of their names. */
export async function getLabourers(): Promise<Labourer[]> {
  const snap = await getDocs(collection(getFirestoreDb(), "labourers"));
  return snap.docs.map((d) => toLabourer(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name));
}

/** Every entry of every worker, newest day first (one fetch: a dozen workers make a few hundred entries a month). */
export async function getLabourEntries(): Promise<LabourEntry[]> {
  const snap = await getDocs(collection(getFirestoreDb(), "labourEntries"));
  return snap.docs
    .map((d) => toEntry(d.id, d.data()))
    .sort((a, b) => (a.dayKey === b.dayKey ? b.createdAt.getTime() - a.createdAt.getTime() : a.dayKey < b.dayKey ? 1 : -1));
}

/** A fresh id for a worker or an entry. Make one per save and keep it until saved, so a retry cannot add it twice. */
export function newLabourId(kind: "labourers" | "labourEntries"): string {
  return doc(collection(getFirestoreDb(), kind)).id;
}

export interface LabourerInput {
  name: string;
  dayWageMinor: number;
  openingMinor: number;
  active: boolean;
}

/** Adds a worker or changes one (same id). */
export async function saveLabourer(id: string, input: LabourerInput): Promise<void> {
  const name = input.name.trim();
  if (name === "" || name.length > 60) throw new UserError("Enter the worker's name");
  if (!Number.isInteger(input.dayWageMinor) || input.dayWageMinor < 0 || !Number.isInteger(input.openingMinor)) throw new UserError("Enter a valid amount");
  await setDoc(doc(getFirestoreDb(), "labourers", id), { name, dayWageMinor: input.dayWageMinor, openingMinor: input.openingMinor, active: input.active }, { merge: true });
}

export interface LabourEntryInput {
  /** From `newLabourId("labourEntries")`. */
  id: string;
  labourerId: string;
  dayKey: string;
  kind: LabourKind;
  earnedMinor: number;
  paidMinor: number;
  advanceMinor: number;
  note?: string;
}

/** Records a day. Saving the same id twice overwrites it with the same data, so a retry changes nothing. */
export async function addLabourEntry(input: LabourEntryInput): Promise<void> {
  const problem = labourEntryProblem(input);
  if (problem === "empty") throw new UserError("Enter an amount");
  if (problem) throw new UserError("Enter a valid amount");
  const { id, ...data } = input;
  await setDoc(doc(getFirestoreDb(), "labourEntries", id), { ...data, note: (data.note ?? "").trim().slice(0, 120), createdAt: serverTimestamp() });
}

/** Removes a wrong entry; the balance is worked out from the entries, so it corrects itself. */
export async function deleteLabourEntry(id: string): Promise<void> {
  await deleteDoc(doc(getFirestoreDb(), "labourEntries", id));
}

