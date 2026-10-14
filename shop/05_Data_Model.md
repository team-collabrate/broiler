# Data Model
## Kumbakonam Cafe POS System (Firestore)

### 1. Collections Overview
```
users/{userId}
menu/{itemId}
orders/{orderId}
  └── items: [ { itemId, name, price, qty, note } ]  (embedded array, not subcollection)
expenses/{expenseId}
customers/{customerId}
customerPayments/{paymentId}
```

### 2. `users` Collection
Stores login PINs (hashed) and roles.

| Field | Type | Description |
|---|---|---|
| `userId` (doc id) | string | Auto-generated |
| `name` | string | e.g. "Ravi (Worker)", "Owner 1" |
| `role` | string enum | `worker` \| `owner` |
| `pinHash` | string | SHA-256 hash of 4-digit PIN |
| `createdAt` | timestamp | |
| `active` | boolean | Allows disabling a user without deleting |

### 3. `menu` Collection
| Field | Type | Description |
|---|---|---|
| `itemId` (doc id) | string | Auto-generated |
| `name` | string | Canonical English/Tanglish name, e.g. "Filter Coffee". Used for orders, receipts, and ESC/POS printing (most thermal printers can't render Tamil glyphs). |
| `nameTa` | string, optional | Tamil-script display name, e.g. "பில்டர் காபி". Shown on-screen (Worker menu grid, Owner menu list) when the app language is set to Tamil; falls back to `name` if unset. |
| `price` | number | In ₹, e.g. 40 |
| `category` | string | Grouping label — one of Breakfast, Lunch, Dinner, Tea (`MENU_CATEGORIES` in shared). Stored in English; *labels* are translated in the UI via a lookup table, not stored bilingually. Items filed under the earlier set (Hot Drinks / Juice / Snacks) still render and still get a tab until they are refiled. |
| `active` | boolean | Toggle item availability without deleting |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | Last edited by owner |

### 4. `orders` Collection
| Field | Type | Description |
|---|---|---|
| `orderId` (doc id) | string | Auto-generated |
| `items` | array of objects | See below |
| `subtotal` | number | Sum before discount |
| `discount` | number | Flat ₹ amount. Always 0 from 2026-08-29 — the cafe gives no discounts and the till no longer offers one. Retained because earlier orders carry real values. |
| `total` | number | subtotal - discount |
| `paymentMethod` | string enum | `cash` \| `upi` \| `split`. `card` is legacy: no longer selectable, but present on orders taken before the change, so readers must still handle it. |
| `cashAmount` | number, optional | Cash half of a `split` bill. Absent otherwise. |
| `upiAmount` | number, optional | GPay/UPI half of a `split` bill. Absent otherwise. |
| `workerId` | string | Reference to `users` doc who created it |
| `createdAt` | timestamp | Server timestamp |
| `syncedAt` | timestamp \| null | Set when confirmed written (useful for offline queue visibility) |
| `status` | string enum | `completed` (v1 only has this; extensible later) |

**`items` array item shape:**
```json
{
  "itemId": "abc123",
  "name": "Filter Coffee",
  "price": 40,
  "qty": 2,
  "note": "less sugar"
}
```
> Item name/price are duplicated (denormalized) into the order at time of sale, so later menu price edits don't retroactively change historical order totals.

### 4b. `expenses` Collection
Money going out of the counter till — vegetables, milk, gas, and the rest of the day's buying. Kept separate from `orders` rather than modelled as a negative order: orders are sales and feed the owner's revenue figures, so mixing spend into them would quietly corrupt every total on the dashboard.

| Field | Type | Description |
|---|---|---|
| `expenseId` (doc id) | string | Auto-generated |
| `name` | string | What was bought, as the worker typed it, e.g. "Vegetables". 1–120 chars, enforced in rules |
| `amount` | number | In ₹, always positive — the sign lives in the collection, not the number. Enforced `> 0` in rules |
| `workerId` | string | Reference to `users.userId` who recorded it |
| `createdAt` | timestamp | Server timestamp |
| `syncedAt` | timestamp \| null | Set when confirmed written; null while queued offline |

> Writes are **not awaited** before the UI confirms. A Firestore write promise does not resolve while the client is offline, so awaiting it would freeze the counter for the length of a wifi outage. The document id is minted locally, the write syncs by itself, and the returned `committed` promise is only used to catch a genuine refusal.

### 4c. `customers` and `customerPayments`
Regulars who buy on credit (கடன் / khata) — a bulk customer who takes an order every day and settles periodically.

**`customers/{customerId}`**

| Field | Type | Description |
|---|---|---|
| `name` | string | As first typed, e.g. "Ravi Stores". 1–120 chars |
| `nameKey` | string | Lower-cased, whitespace-collapsed `name`. Matches a returning customer to their existing record instead of creating a second one with the balance split across spellings |
| `balance` | number | Outstanding ₹. Moved with Firestore `increment` — atomic server-side, and unlike a transaction it still works while the till is offline |
| `createdAt` / `updatedAt` | timestamp | |

**`customerPayments/{paymentId}`** — append-only receipts: `customerId`, `customerName`, `amount`, `workerId`, `createdAt`.

> **The counter only ever sees `balance > 0`.** A settled customer drops off the till's list by itself; nothing is deleted, and the owner keeps the full record. A customer takes credit again simply by being picked or re-typed.

> **Two writes, not one.** A credit order writes the order and increments the balance separately, and a settlement writes a receipt and decrements the balance separately. They are not atomic with each other, because Firestore transactions need a connection and this has to work mid-outage. `customerPayments` is the source of truth if a balance is ever doubted — that is what the audit trail is for.

> **Credit orders still count as sales** on the day they are taken; the money owed shows separately as On Credit. Sales measures trade, the balance measures collection.

### 5. Relationships
- `orders.workerId` → `users.userId` (which staff member created the order)
- `orders.items[].itemId` → `menu.itemId` (denormalized copy; not a live reference)
- `expenses.workerId` → `users.userId` (which staff member recorded the spend)
- `orders.customerId` → `customers.customerId` (set only on a `credit` order)
- `customerPayments.customerId` → `customers.customerId`

### 6. Aggregation Approach (v1)
No separate "daily summary" collection for v1 — owner app computes today/week/month totals client-side by querying `orders` within a date range (`createdAt >= startOfDay` etc.) and reducing in-memory. Acceptable at this scale (single cafe, low order volume). Can be revisited with scheduled Cloud Functions if volume grows.

### 7. Firestore Security Rules (Summary)
- `menu`: read → any authenticated session; write → `role == owner` only.
- `orders`: read → any authenticated session; create → `role == worker` or `owner`; update/delete → `role == owner` only (e.g. correcting a mistake).
- `customers`: read → any authenticated session; create requires a non-empty name and a zero opening balance; update is open (balance moves by `increment`, whose result the rules cannot inspect); **delete is denied** — a settled customer is history.
- `customerPayments`: read → any authenticated session; create validates amount and worker; **update and delete are denied** — a receipt that can be edited is not an audit trail.
- `expenses`: read → any authenticated session; create → `workerId` must reference a real, active worker/owner, and `amount`/`name` are validated in the rules themselves, because bad values here would not fail loudly — they would just make the books wrong.
- `users`: no direct client read/write of `pinHash` field exposed to app logic beyond initial auth check (handled via a controlled query, e.g. a Cloud Function or restricted read pattern) — to be finalized in engineering phase for hardened PIN validation.
