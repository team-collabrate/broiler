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
| New Firestore rules | **Deployed and checked live** 2026-10-22 | Nothing |
| Counter PIN account | **Done** 2026-10-22 (billing account created) | Choose a PIN |
| Turn anonymous sign-in off | **Open** | One click in the Firebase console (see `shop/GO_LIVE.md`) |
| Real catalog | **Done** (12 products live; rates are examples until the owner sets today's rates) | Product photos; the owner's real rates |
| Shop name on the bill | **Done**: Honey Broilers (no address or phone wanted) | Nothing |
| Installable PWA (manifest, icons, service worker) | **Missing** | Kumbakonam has all of it (`vite-plugin-pwa`, `prepare-pwa-icons.mjs`) |
| Android app (APK) | **Missing** | Kumbakonam uses Capacitor around its web build; signed release build |
| Hosting | Prototype only, old build | Redeploy; a third site for reports |
| Database backups, crash reporting | **Missing** | Scheduled backup, error reporting |
| Tests | Shared logic, 90 tests | Screen tests and a device test checklist |

## 5. Decision (2026-10-19): build on the `shop/` copy of Kumbakonam

Android + PWA, 58 mm Bluetooth printer (BonKaso BKT05). The Expo app (`apps/`) stays as the reference for the features it
proved (popup, wheel, units, price adjustment, PIN login, rules); they move across into `shop/`.

### Printing: set up in `shop/` (see `shop/PRINTING.md`)

| Done | Still to do on real hardware |
| --- | --- |
| Bill drawn for 58 mm (384 dots, scaled from the 80 mm design) in Tamil: item, quantity x rate, amount, totals, payment, split halves, credit customer | Print on the actual printer and check width, density and Tamil clarity |
| 1-bit rooster logo for the paper | Build the APK (needs Android Studio) and pair the printer |
| Receipt preview at `/?receipt`, test-print button in printer setup, shop details in one file | Real shop name, address and phone |
| Android app renamed Broiler POS (`com.broiler.pos`), rooster icons and splash, PWA name and icons | Signed release build |

### Order of work in `shop/` (phase numbers are from the project plan)

1. **Phase 1, done:** the sale model (weight, count, paise), types, categories and their 74 tests live in `shop/shared/src/core`; CI runs typecheck, tests and the build.
2. **Phase 2, done (counter on the new model):** Tamil counter in `shop/worker-app/src/counter`: left rail, category tabs, four-per-row image grid, product popup with the weight wheel, cart with edit and remove, cash and UPI payment, owner-PIN today's-rate screen, Firebase PIN sign-in with a 30-minute idle lock, bill saved through `shop/shared/src/shop`. The cafe screens it replaced are removed. `npm run images` prepares product photos (`shop/product-photos/<id>.jpg` to `worker-app/public/items/<id>.jpg`, 800 x 600).
   *Still open from Phase 2:* real product photos, and the split and credit buttons are shown but disabled ("soon") until Phase 4.
3. **Phase 3, done (offline selling; see `shop/OFFLINE.md`):** bill numbers made on the tablet with a counter letter, sales saved on the tablet first and uploaded by themselves, a real `soldAt` sale time, a "bills waiting" pill and a red card naming any bill the server refuses, a screen lock that no longer signs out (PIN works with no internet), product photos cached by the service worker. Tested in the browser against the live project: 10 offline sales uploaded once each with no duplicate or missing number, a reload with bills waiting, a refused bill, the lock and its guess limiter.
   *Still open from Phase 3:* cash, UPI and split are offline-safe but **credit and credit payments need the internet** (decision and reasoning in `OFFLINE.md`, revisit once the rules emulator exists); the new rules are written and compile but **not deployed** (Phase 6); the real tablet, airplane mode and the installed Android app are untested (Phases 5 and 10).
4. **Phase 4, done (payments; see `shop/TESTING.md`):** the split (GPay + cash) and credit buttons work, with the split sheet, the credit customer sheet (pick someone who owes, or type a name; the same name finds the same customer) and the credit book (கடன் புத்தகம்: take a cash or GPay payment, "முழுவதும்" pays the exact balance including paise, overpaying and zero are refused, a payment retried after a lost answer is not taken twice). A credit bill or payment offline shows the "needs internet" message. Verified for real in a **local rules emulator** (portable Java in `.tools/`, nothing on your live project touched): cash, GPay, split, credit to a new and a returning customer, partial and full payments, a paise balance, the offline refusals, and a 10-line bill; `scripts/check-books.mjs` reconciled every run to the rupee. `npm run test:rules` runs 39 rules tests and `scripts/check-access.mjs` passes against the emulator.
   **The emulator found a bug that would have stopped all selling:** the new order rule exceeded Firestore's limit of 1000 expressions per request and refused *every* bill, even a one-item cash sale (the old compile check could not see this). The rule was rebuilt: **a bill is now limited to 10 lines (was 20)** and the rules no longer re-check each line's weight × rate, but they still enforce the owner's price limit, the money total, the sale-time window and the split and credit rules (explained in `shop/DATA_MODEL.md`).
   *Still open from Phase 4:* the new rules are **still not deployed to the live project** (Phase 6: deploy, then run `npm run check:access`); the customer history and receipt log screens are owner-side (Phase 7); the rules tests are not in CI (they need Java).
5. **Phase 5, software done; the printer and tablet steps remain (see `shop/PRINTING.md`):**
   - *Done and tested without the printer:* the printer is remembered (it used to be forgotten if it was off when the app opened); a failed print no longer switches printing off (before, one hiccup disabled it until restart); a dead Bluetooth link is dropped, reconnected and the bill sent once more (unit-tested with a fake printer); every failure has its own plain Tamil message (no printer, printer off or out of paper, Bluetooth off, permission refused); the bill stays on the screen with **மீண்டும் அச்சிடு**; a printer button on the left rail (green, gold or red); **கடைசி பில்கள்** (the last 20 bills printed on the tablet) to print a copy, marked **நகல்**; a printer screen in Tamil with a test bill and a **calibration sheet** for the day the printer arrives; the screen stays on while the app is open; and sample receipts for every kind of bill, including ten long Tamil lines (`/?receipt`). `npm run android:apk` builds the installable app here (5.3 MB; app id `com.broiler.pos`; the Bluetooth permissions are in it).
   - *Needs the real printer and tablet (not possible from here):* print the calibration sheet and tune the width and darkness; the 50-bill test including a printer switch-off and a Bluetooth drop; the Android permission prompts on the Redmi Pad 2; installing the app on the tablet and the tablet settings (battery, screen pinning). The app could not be run in an Android emulator here (the SDK's Android 34 image is incomplete).
   - *Not detectable:* "out of paper" (most cheap printers do not report it over Bluetooth), so it shows as "printer not responding".
6. **Phase 6, done on 2026-10-22 (go-live day; see `shop/GO_LIVE.md`):** the new Firestore rules are **deployed** to `broiler-pos`; the billing (counter) account was created and the managing (owner) PIN changed (PINs are not stored in the repository); `npm run check:access` **passed against the live project** (every counter, split, credit, offline-time and owner rule); the real catalog is live (12 products; podi is masala, one item; sample items off); the test data was removed; the dev flags are out of the shipping build (the draft-menu switch is now development-only in code too). New scripts: `scripts/change-pin.mjs`.
   *Still open:* **anonymous sign-in is still switched on** in Firebase (the CLI can only switch sign-in methods on): turn it off in the Firebase console (Authentication > Sign-in method > Anonymous). The rules already refuse anonymous visitors. Also open: the rules tests are not in CI; an audit trail; a stronger PIN than 4 digits (the shop chose 4).
   *Decisions made on go-live day:* shop name **Honey Broilers** (no address or phone on the bill); printer **BonKaso BKT05, 58 mm** (needs the Bluetooth version); bill number `dd-mm/number` from 1 each day (`22-10/1`); workers **Worker A** and **Worker B** (a switch at the top of the cart, printed on the bill, stored on the order); **5 items per bill** (more: make two bills; with 5 lines the rules check every line fully, including weight × rate); stay on Firebase's **free plan** (so no scheduled Firebase backups: use an Excel export; no Cloud Functions: the nightly email would run from GitHub Actions); keep full bills **4 days** then summaries (not built yet: the rules currently allow no deletes); product pictures are permanent and will be supplied (shipped inside the app). *Language:* the counter screen is plain English (Chicken, Mutton, Others, Cash, Split, Credit, Print bill, Admin), product names stay Tamil and the printed bill is fully Tamil.
7. **Phases 7 to 9:** owner side (menu management, void, reports with charts, staff names, expenses), reports site (item sales, loan report, Excel, nightly email), backups and cost control.
