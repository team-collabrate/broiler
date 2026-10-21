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
| `counters/{day}` | the day's bill counter | read, write | read, write |

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
| `orderNo`, `dayKey`, `createdAt` | bill number for the day, `YYYY-MM-DD`, server time |
| `lines[]` | each line: `itemId`, `name`, `category`, `unit`, `rateMinor` (charged), `listRateMinor`, `grams`, `qty`, optional `amountMinor` (billed by amount), `lineTotalMinor` |
| `totalMinor`, `totalGrams`, `totalPieces` | totals; the rules check they equal the sum of the lines |
| `paymentMethod` | `cash`, `upi`, `split`, `credit` (`card` only on old data) |
| `cashAmountMinor`, `upiAmountMinor` | split bills only; both above zero and adding to the total |
| `customerId`, `customerName` | credit bills only |

A line's rate may differ from its list rate only by the owner's limit (`settings/pricing.maxAdjustMinor`, default ₹20).

## `customers/{customerId}` and `customerPayments/{id}` (credit, "kadan")
- Customer id is derived from the typed name (lower-cased, spaces collapsed), so the same name finds the same person.
- `balanceMinor` moves only together with the order or receipt written in the same transaction (`lastOrderId` or `lastPaymentId`); a customer is never deleted.
- A receipt holds `customerId`, `customerName`, `amountMinor`, `method` (`cash` or `upi`), `dayKey`, `createdAt`. Receipts cannot be edited or deleted.

## `settings`
- `pricing`: `{ maxAdjustMinor }`: how far the counter may move a sale's rate from the list rate.
- `categories`: `{ list: [{ key, name, nameTa, image }] }`: the counter tabs, in order.

## Offline rules (Phase 3)
Orders are written with a client-made id and a server timestamp, so a sale saved offline syncs once, safely. Bill
numbers come from a per-device daily sequence. Credit balances and customer payments need a connection unless the
Phase 3 spike proves them safe offline.
