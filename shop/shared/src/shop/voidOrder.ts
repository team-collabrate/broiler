import { doc, runTransaction, serverTimestamp, type DocumentReference, type Firestore } from "firebase/firestore";
import { UserError } from "../core";
import { getFirebaseAuth, getFirestoreDb } from "../firebase";
import { isOnlineNow, needsConnectionError } from "./online";

/**
 * Deletes a bill: it stays on record, marked voided with who and when, and every total leaves it out. A credit
 * bill also gives the customer's balance back, in the same transaction, so the book and the bill cannot disagree.
 * Nothing is removed and nothing is lost: the owner still sees the bill, marked deleted. It cannot be undone.
 *
 * It needs the internet and a bill the server already has (a bill still waiting to upload cannot be deleted yet).
 * The rules let the owner delete any bill and the counter one made in the last 24 hours (the till offers its last 3).
 * Deleting the same bill twice does nothing the second time.
 */
export async function voidOrder(orderId: string): Promise<void> {
  if (!isOnlineNow()) throw needsConnectionError();
  const uid = getFirebaseAuth().currentUser?.uid;
  if (!uid) throw new UserError("Sign in again, then try once more");
  const db = getFirestoreDb();
  const orderRef = doc(db, "orders", orderId);
  try {
    await deleteInTransaction(db, orderRef, orderId, uid);
  } catch (error) {
    // The rules refuse a bill the till may no longer delete (over 24 hours) or one whose day is already closed.
    if ((error as { code?: string }).code === "permission-denied") throw new UserError("This bill can no longer be deleted from here. Ask the owner");
    throw error;
  }
}

async function deleteInTransaction(db: Firestore, orderRef: DocumentReference, orderId: string, uid: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) throw new UserError("This bill has not reached the server yet. Wait for it to upload, then try again");
    const order = orderSnap.data();
    if (order.status === "voided") return;
    const stamp = { status: "voided", voidedAt: serverTimestamp(), voidedBy: uid };
    if (order.paymentMethod !== "credit") {
      tx.update(orderRef, stamp);
      return;
    }
    // A credit bill: the customer's balance goes down by the bill. A customer who has already paid part of it
    // cannot go below zero, so that bill cannot be deleted from here.
    const customerRef = doc(db, "customers", String(order.customerId));
    const customerSnap = await tx.get(customerRef);
    const balance = customerSnap.exists() ? Number(customerSnap.data().balanceMinor ?? 0) : 0;
    const total = Number(order.totalMinor);
    if (!customerSnap.exists() || balance < total) {
      throw new UserError("Cannot delete this credit bill: the customer has already paid part of it. Ask the owner");
    }
    tx.update(customerRef, { balanceMinor: balance - total, lastVoidedOrderId: orderId, updatedAt: serverTimestamp() });
    tx.update(orderRef, stamp);
  });
}
