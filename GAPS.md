# What is left to build: Broiler vs the Kumbakonam POS

Compared on 2026-10-14. **Done** means built and working in the Expo app (`apps/`). **Placeholder** means
the screen or button exists but does not do the job yet. **Missing** means nothing exists yet.
Kumbakonam file names are from `team-collabrate/kumbakonam`.

## 1. Counter (Kumbakonam's `worker-app`)

| Feature | Kumbakonam | Broiler | What to build |
| --- | --- | --- | --- |
| Product grid with category tabs | Photos, tabs with round photos | **Done**, photos are **placeholders** | Product photos and category thumbnails (`apps/pos/assets/items/`), plus an image-prep script that crops to 4:3 and shrinks (their `prepare-item-images.mjs`) |
| Product popup (weight, rate, count) | None (fixed prices only) | **Done** (new, not in Kumbakonam) | Check the wheel feel on the real tablet |
| Cart with edit and remove | Remove only | **Done** (better) | Nothing |
| Cash, UPI, split, credit | Yes | **Done** | Test against Firebase once rules are deployed |
| Credit book (take payments) | `KhataModal` | **Done** | Nothing |
| Customer history (orders and payments of one customer) | `CustomerHistoryModal` | **Missing** | A history view reachable from the credit book |
| Till expenses (vegetables, milk, gas) | `ExpenseModal`, receipt photo | **Missing** | Expense popup, owner list, optional receipt photo (they use Cloudinary) |
| Staff name on each bill, with colours | `WorkerNameSelect`, `workerNames.ts` | **Missing** | Staff picker at the till, `billedByName` on each order, coloured dots in the owner app |
| Delete a recent bill (last 3, same day) | `RecentBillsModal`, `voidOrder` | **Missing** | Void with audit trail, rules for who may void, owner sees it marked |
| Receipt printing (Bluetooth thermal) | `receiptCanvas`, `escposRaster`, classic and web Bluetooth, printer setup, diagnostics | **Missing** (only browser Print) | Biggest single item. Needs the printer model and paper width. Tamil prints as a drawn image |
| Black-and-white logo for the bill | `prepare-receipt-logo.mjs` | **Missing** | A 1-bit version of the rooster |
| Works offline, syncs later | Firestore persistence, pending-sync badge, rejected-order warning | **Missing** (saving needs a connection) | Offline queue and a bill-number scheme that cannot duplicate |
| Online / syncing badge | `SyncStatusBadge` | **Missing** | Small status indicator on the rail |
| Bill number | Daily, starts at 1111 | Daily, starts at 1 | Confirm which numbering the shop wants |
| English / Tamil switch | `LanguageToggle` | **Not needed** (Tamil only) | Only if you ask |
| Physical-keyboard shortcuts | `useKeyboardShortcuts` | **Not needed** on a tablet | Skip |
| PIN login, inactivity lock | Yes (PIN hashes readable by anyone signed in) | **Done**, stronger | Create the counter account |

## 2. Owner app (Kumbakonam's `owner-app`, Broiler's `apps/admin`)

| Feature | Kumbakonam | Broiler | What to build |
| --- | --- | --- | --- |
| Dashboard totals, GPay, items, payment split | Yes | **Done** (basic) | Week and month totals, spent and net, live refresh |
| Reports by day / week / month with charts | `ReportsScreen`, `SalesChart`, `chartBuckets` | **Missing** (only today, yesterday, last 7 days, no charts) | Custom ranges, charts by hour, weekday and week |
| Order history with staff dots | `OrderHistoryRow`, `WorkerLegend` | Basic list | Staff colours, filters |
| Outstanding credit | `OwedCustomersModal` | **Done** (credit tab) | Customer history link |
| **Menu management** (add, edit, hide, reorder, delete) | `MenuScreen`, `MenuItemForm` | **Missing**, the main **placeholder**: the seed script is the only editor | Screens for name, Tamil name, category, unit, billing methods, rate, default weight or count, picture, hide, reorder |
| Category management | Fixed list | **Missing** screen (setting exists) | Edit counter tabs |
| Set today's rate from the owner app | Edit price in menu | Counter only, via owner PIN | Rate entry in the owner app, plus rate history |
| Price-adjustment limit | None | **Missing** screen (`setMaxAdjust` exists) | A setting field |
| Void any order | Yes | **Missing** | Owner void with reason |
| Spending list, record an expense | `TodaySpendingModal`, `RecordExpenseModal` | **Missing** | With till expenses above |
| Old-data archive (daily summaries, pruning) | `archiveAndPruneOldData` | **Missing** | Decide the retention rule (it keeps Firestore reads low) |
| Settings (signed-in name, logout) | `SettingsScreen` | **Done** (lock) | Show who is signed in |

## 3. Reports site (Kumbakonam's `reports-app`): all **missing**

| Feature | Kumbakonam file | Needed |
| --- | --- | --- |
| Item-wise sales report | `itemSalesReport.ts` | By item and by day |
| Loan report (given vs received per day) | `loanReport.ts`, `LoanSection` | By day and customer |
| Expenses report | `expensesReport.ts` | With till expenses |
| Excel export | `exportXlsx.ts` | Download as .xlsx |
| Nightly report by email | `send-daily-report-email.mjs`, GitHub Action | Needs a service account and email credentials |

## 4. Platform, security and release

| Item | Status | Needed |
| --- | --- | --- |
| New Firestore rules | Written, **not deployed**, untested live | Counter account, deploy, run `npm run check:access` |
| Counter PIN account | **Missing** (owner exists: 2121) | Choose a PIN |
| Turn anonymous sign-in off | **Open** | At cut-over, after the rules |
| Real catalog | Sample items only | Your real list, then `npm run seed -- --go-live` |
| Shop name, address, phone on the bill | **Placeholder** (`apps/pos/src/config.ts`) | Real text |
| Installable PWA (manifest, icons, service worker) | **Missing** | Kumbakonam has all of it (`vite-plugin-pwa`, `prepare-pwa-icons.mjs`) |
| Android app (APK) | **Missing** | Kumbakonam uses Capacitor around its web build; signed release build |
| Hosting | Prototype only, old build | Redeploy; a third site for reports |
| Database backups, crash reporting | **Missing** | Scheduled backup, error reporting |
| Tests | Shared logic, 90 tests | Screen tests and a device test checklist |

## 5. Decision (2026-10-19): build on the `shop/` copy of Kumbakonam

Android + PWA, 80 mm Bluetooth printer. The Expo app (`apps/`) stays as the reference for the features it
proved (popup, wheel, units, price adjustment, PIN login, rules); they move across into `shop/`.

### Printing: set up in `shop/` (see `shop/PRINTING.md`)

| Done | Still to do on real hardware |
| --- | --- |
| Bill drawn for 80 mm (576 dots) in Tamil: item, quantity x rate, amount, totals, payment, split halves, credit customer | Print on the actual printer and check width, density and Tamil clarity |
| 1-bit rooster logo for the paper | Build the APK (needs Android Studio) and pair the printer |
| Receipt preview at `/?receipt`, test-print button in printer setup, shop details in one file | Real shop name, address and phone |
| Android app renamed Broiler POS (`com.broiler.pos`), rooster icons and splash, PWA name and icons | Signed release build |

### Order of work in `shop/` (phase numbers are from the project plan)

1. **Phase 1, done:** the sale model (weight, count, paise), types, categories and their 74 tests live in `shop/shared/src/core`; CI runs typecheck, tests and the build.
2. **Phase 2, done (counter on the new model):** Tamil counter in `shop/worker-app/src/counter`: left rail, category tabs, four-per-row image grid, product popup with the weight wheel, cart with edit and remove, cash and UPI payment, owner-PIN today's-rate screen, Firebase PIN sign-in with a 30-minute idle lock, bill saved through `shop/shared/src/shop`. The cafe screens it replaced are removed. `npm run images` prepares product photos (`shop/product-photos/<id>.jpg` to `worker-app/public/items/<id>.jpg`, 800 x 600).
   *Still open from Phase 2:* real product photos, and the split and credit buttons are shown but disabled ("soon") until Phase 4.
3. **Phase 3, next: offline.** Bill numbers that cannot duplicate, sync badge, queued sales; a spike on credit while offline.
4. **Phase 4: payments.** Split (GPay + cash) and credit with the credit book on the new model, under the transaction rules. The modals to port are still in `worker-app/src/components` (`SplitPaymentModal`, `CreditCustomerModal`, `KhataModal`).
5. **Phase 5: printing** on the real printer and the signed APK.
6. **Phase 6: login and rules.** Deploy the new Firestore rules, create the counter account, run `check:access`, switch anonymous sign-in off, remove the dev flags.
7. **Phases 7 to 9:** owner side (menu management, void, reports with charts, staff names, expenses), reports site (item sales, loan report, Excel, nightly email), backups and cost control.
