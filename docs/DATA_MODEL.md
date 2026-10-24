# Data model (Firestore, project `broiler-pos`)

The shop's database as it will be used in production. Money is **integer paise** (`24000` = ₹240.00) and weight is
**integer grams** everywhere; nothing is stored as a decimal rupee or kilo. Code for these rules lives in
`shared/src/core` and is covered by `npm test`. The access rules are in `/firestore.rules` and are checked against
the real project by `npm run check:access`.

Who may do what: **owner** (PIN account `owner@broiler-pos.invalid`) and **counter** (`counter@broiler-pos.invalid`).
Anyone else, including anonymous, gets nothing once anonymous sign-in is switched off.

| Collection | Document | Owner | Counter |
| --- | --- | --- | --- |
| `menu/{itemId}` | a product | read, create, edit, delete | read |
| `orders/{orderId}` | a bill | read, create | create; read one it just saved |
| `customers/{customerId}` | a credit customer | read | read, and change balance only with a matching order or receipt |
| `customerPayments/{id}` | money taken against a balance | read, create | create |
| `settings/pricing`, `settings/categories` | shop settings | read, edit | read |
| `counters/{day}_{letter}` | how far a counter got on a day (a recovery hint) | read, write | read, write |

Planned in later phases (rules to be written with them): `expenses`, `staff`, `dailySummaries`, `auditLog`.

## `menu/{itemId}` (a product)
| Field | Type | Meaning |
| --- | --- | --- |
| `name`, `nameTa` | string | English and Tamil names (Tamil is shown and printed) |
| `category` | string | counter tab: `chicken`, `other`, `mutton` (older keys fold into these) |
| `group`, `variant` | string, string/null | product family and form (`live`, `skin`, `skinless`, `bone`, `boneless`) |
| `unit` | `kg` or `piece` | what the rate is per |
| `methods` | array | how the sheet bills it: `weight`, `amount` (rate-wise), `qty` (count); first is the default |
| `rateMinor` | int paise | today's list rate per kg or per piece |
| `rateUpdatedAt` | timestamp | when the rate was last set or confirmed (drives "rate not set today") |
| `defaultGrams`, `defaultQty` | int | where the weight wheel or count starts |
| `image` | string | picture key (or https link) |
| `active`, `sortOrder` | bool, int | shown at the counter; position |

## `orders/{orderId}` (a bill). Append-only: never edited or deleted.
| Field | Meaning |
| --- | --- |
| `orderNo`, `device` | bill number for the day (starts at 1 each day), made on the tablet; the counter letter (`A` for the first tablet). Printed as `dd-mm/number`: `22-10/12` for counter A and `22-10/B12` for the others |
| `staffName` | the worker who was billing (`Worker A` or `Worker B`), up to 40 letters; optional |
| `dayKey` | the day of the sale, `YYYY-MM-DD`, by the tablet's clock |
| `soldAt` | when the sale was made, by the tablet's clock. The rules accept it only if it is not in the future (5 minutes of drift allowed) and not more than 3 days old. **Reports use this.** |
| `createdAt` | when the server received the sale (server time). For a sale made with no internet this is later than `soldAt` |
| `lines[]` | 1 to **5** lines (a limit of the security rules, see below; a customer with more is billed as two bills); each line: `itemId`, `name`, `category`, `unit`, `rateMinor` (charged), `listRateMinor`, `grams`, `qty`, optional `amountMinor` (billed by amount), `lineTotalMinor` |
| `discountMinor` | optional; a flat discount (whole rupees, in paise) taken off the lines' sum: at least 1 and always less than the sum |
| `roundOffMinor` | optional; set only when the till rounded the bill to the nearest ten rupees: `totalMinor` is the lines' sum plus this, and is a whole multiple of ₹10 |
| `totalMinor` | the bill total; the rules check it equals the sum of the lines' `lineTotalMinor` (minus `discountMinor` and plus `roundOffMinor` when present) |
| `totalGrams`, `totalPieces` | weight and count totals, written by the till; the rules only check they are whole numbers (they are not re-added) |
| `paymentMethod` | `cash`, `upi`, `split`, `credit` (`card` only on old data) |
| `cashAmountMinor`, `upiAmountMinor` | split bills only; both above zero and adding to the total |
| `customerId`, `customerName` | credit bills only |

A line's rate may differ from its list rate only by the owner's limit (`settings/pricing.maxAdjustMinor`, default ₹20).

**Why 5 lines, and what the rules check per line.** Firestore lets a security rule evaluate at most 1000 expressions per
request and rules cannot loop, so every line is checked at a fixed position. Measured in the emulator, the full per-line check
fits 5 lines for every kind of bill (cash, GPay, split, credit) with the money total added up; adding up the weight and count
totals as well does not fit. With 10 lines only a lighter check fitted, so the limit is 5 and a customer with more is billed as
two bills. Per line the rules check: a positive rate within the owner's limit of the list rate, that the line is a weight or a
count (not both), a unit of `kg` or `piece`, and that its total is its rate times its weight or count (or exactly the amount it
was billed for). `MAX_ORDER_LINES` in `shared/src/core/sale.ts` and the rules must change together; the "the most an order can
hold" test in `scripts/rules` fails if a change makes 5 lines too costly.

## `customers/{customerId}` and `customerPayments/{id}` (credit, "kadan")
- Customer id is derived from the typed name (lower-cased, spaces collapsed), so the same name finds the same person.
- `balanceMinor` moves only together with the order or receipt written in the same transaction (`lastOrderId` or `lastPaymentId`); a customer is never deleted.
- The counter may not read receipts, so a payment retried after a lost answer is recognised by the customer's own `lastPaymentId` (the till reuses one receipt id per payment). A balance can have paise (a bill total is in paise), so the credit book's "முழுவதும்" pays the exact balance, not a rounded rupee amount.
- A receipt holds `customerId`, `customerName`, `amountMinor`, `method` (`cash` or `upi`), `dayKey`, `createdAt`. Receipts cannot be edited or deleted.

## `labourers/{id}` and `labourEntries/{id}` (the labour salary book)
- Owner only: the counter cannot read or write either. A worker is `{ name, dayWageMinor, openingMinor, active }` (`openingMinor` is what was owed, or lent when negative, before the book started; a worker who has left is `active: false`, never deleted).
- A day is `{ labourerId, dayKey, kind: work|leave|double|vehicle|other, earnedMinor, paidMinor, advanceMinor, note?, createdAt }`.
- The balance is never stored: `openingMinor + Σ(earnedMinor − paidMinor − advanceMinor)` (`labourBalance` in `shared/src/core/labour.ts`). Positive: the shop owes the worker; negative: an advance not yet worked off. A wrong entry is deleted and the balance corrects itself.
- `scripts/import-labour.mjs` loads the sheets of "Labour salary account.xlsx" (run without `--write` to compare balances first).

## `settings`
- `pricing`: `{ maxAdjustMinor }`: how far the counter may move a sale's rate from the list rate.
- `categories`: `{ list: [{ key, name, nameTa, image }] }`: the counter tabs, in order.

## Selling offline (Phase 3)
How it works, what is and is not safe offline, and how it was tested is in [OFFLINE.md](OFFLINE.md). In short: cash, UPI
and split sales are saved on the tablet first and upload by themselves; credit bills and credit payments need a connection.

## `counters/{day}_{letter}`
`{ next }`: the number after the last bill that counter issued that day (for example `2026-10-21_A`). It is written in the
same batch as each order and is only a hint, read by a tablet whose storage was lost so it can carry on from the right
number. The numbers themselves are made on the tablet.
