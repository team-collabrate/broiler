# Broiler roadmap

A weight-based POS for the counter, plus an admin app for the owner to inspect sales. Both are
React Native (Expo) + TypeScript apps in this monorepo, sharing one Firebase project and the
`@broiler/shared` package. The scope follows the existing Kumbakonam project's architecture
(worker checkout, owner operations, sales reporting, receipt printing, shared services).

| Phase | Name | Status |
| --- | --- | --- |
| 0 | Foundation | Done |
| 1 | Core POS + sales inspection | Built, needs Firebase setup and a device test |
| 2 | Access and security (go-live gate) | Next |
| 3 | Receipt printing | Planned |
| 4 | Admin management | Planned |
| 5 | Credit and expenses | Credit (kadan), split payment and the credit book are built; expenses still planned |
| 6 | Reliability and release | Planned |

Each phase should leave both apps working and usable on its own. The order is a recommendation:
Phase 2 comes before printing because real sales data shouldn't sit behind v1's placeholder
security. If receipts matter more to you on day one, swap 2 and 3.

---

## Phase 0: Foundation (done)

- npm-workspaces monorepo: `apps/pos`, `apps/admin`, `packages/shared`
- Shared money and weight maths (integer paise and grams), date ranges, sales summaries, with unit tests
- Firebase wiring (Firestore, anonymous auth with persisted session), Firestore rules, menu seed script
- Git repo connected to `team-collabrate/broiler`

## Phase 1: Core POS + sales inspection

**Goal:** a sale made on the POS shows up in the admin app within seconds.

- **POS (Redmi Pad 2, landscape):** item cards with a default weight each; all three ways to sell on screen at once with no tabs: a touch **weight meter** (64dp handle, tap-to-seek, 50 g steps, −/+ with hold-to-repeat), six **presets** with prices, and **By amount (₹)** with a keypad and ₹100 / ₹200 / ₹500; bills exactly the amount asked for. A **Today's rate** view, cart, payment method, charge, daily order number. **No popups**: confirmations, errors and the rate editor are all on the page. See [DESIGN.md](DESIGN.md)
- **Admin:** dashboard (total, orders, kg sold, average, split by payment and by item), orders list, order detail, date presets (today, yesterday, last 7 days)
- **To finish this phase** (see README): create the Firebase project, enable Firestore and anonymous sign-in, deploy the rules, seed the menu, run both apps on a real Android device

**Done when:** you make three sales on the POS and the admin totals match what you rang up.

## Phase 2: Access and security (go-live gate)

**Goal:** only the right people can do the right things.

- Owner login for the admin app (email/password, or PIN as in the Kumbakonam project)
- Staff PIN or shift name at the POS, stored on every order, so sales are attributable
- Roles: the POS can only create orders; only the owner can read all orders or change the menu
- Decide who may set **Today's rate**: today any POS user can, which is a price change. Options are an owner PIN on the sheet, or a rule that lets the POS update only the rate fields
- Tighten `firestore.rules` to match, and remove the anonymous-auth placeholder

**Done when:** the POS device can't read other days' sales, and the admin app is unusable without the owner's login.

## Phase 3: Receipt printing

**Goal:** print a receipt on charge.

- Receipt layout (shop name, order number, lines with weight × rate, total, payment, date/time)
- Bluetooth thermal printer support (ESC/POS), with a classic-printer fallback and a retry button
- **Tamil on thermal printers:** these printers can't render Tamil text, so the bill is drawn onto a canvas and sent as a bitmap, as the Kumbakonam POS already does. Its working code is in `kumbakonam/worker-app/src/printing/` (`receiptCanvas.ts`, `escposRaster.ts`, `classicBluetoothPrinter.ts`, `webBluetoothPrinter.ts`, `usePrinter.ts`) and can be adapted rather than rewritten. Phase 1 already shows the bill on screen and prints it from the web
- Printer selection and test print
- **Note:** this needs a native module, so the apps move from Expo Go to a development build (`expo run:android` or EAS)

**Done when:** a charged sale prints a correct receipt, and a failed print can be retried without re-charging.

## Phase 4: Admin management

**Goal:** the owner runs the shop from the admin app without opening the Firebase console.

- Menu management: add, edit, deactivate and reorder items, change per-kg prices and each item's default weight (v1 edits default weights in the Firebase console), and see the history of daily rates (v1 keeps only the current rate and when it was set)
- Custom date ranges, plus weekly and monthly reports
- Void/refund an order with a reason and an audit trail (orders are append-only in v1)
- Daily summaries and CSV export

**Done when:** the owner can change a price in the admin app and the POS shows it immediately.

## Phase 5: Credit and expenses

**Goal:** track money that isn't a cash sale.

- Customers and credit (loan) sales: balance per customer, partial payments, settlement. **Built:** credit bills, the counter's credit book for taking payments (cash or UPI), a GPay + cash split payment, and the owner's credit tab. Not yet: a customer history view and a loan report by day
- Expenses with categories, shown beside sales
- Profit view (sales minus expenses) and a credit/loan report

**Done when:** a credit sale raises the customer's balance, a payment lowers it, and the reports agree.

## Phase 6: Reliability and release

**Goal:** safe to rely on every day.

- Offline-tolerant sales: queue orders locally and sync later. The v1 order number needs a connection; this phase moves to device-prefixed numbers or a reconciliation step
- Optional Bluetooth weighing-scale input, so the weight isn't typed by hand
- Crash reporting, Firestore backups, and a signed release (EAS build, APK distribution)

**Done when:** a sale made with the internet off appears in the admin app once the connection returns, with no duplicate or missing numbers.

---

## Decisions that will shape later phases

- **Phase 2:** owner login by email or by PIN? Does each staff member get a PIN? Should the counter be allowed to set today's rate, or only the owner?
- **Phase 3:** which printer model and paper width? This affects the receipt layout.
- **Phase 5:** are credit customers named accounts, or just a phone number plus a running balance?
- **Phase 6:** how reliable is the shop's internet? If it drops often, offline sales should move up the list.
