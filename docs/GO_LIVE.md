# Go-live: Honey Broilers counter

Status of the live Firebase project `broiler-pos`, what is left to do by hand, and the first-day routine.

## Already done on the live project

- **Security rules deployed** (`firestore.rules`): only the two PIN accounts can do anything; bills are append-only and checked line by line.
- **Two accounts:** *Billing* (the counter tablet) and *Managing* (the owner). Each account's PIN is its password. The PINs are **not written
  in this repository**: keep them somewhere private. The managing PIN was changed from the old one on go-live day. Change either with
  `node --env-file=shop/worker-app/.env scripts/change-pin.mjs owner|counter` (it asks for the current and the new PIN).
- **Live access check passed** (`npm run check:access`): what the counter and the owner may and may not do, including split, credit, the offline
  sale time and the 5-line limit.
- **Catalog loaded:** 12 products (Chicken 5, Mutton 6, Others 1: Masala). Podi is masala, so there is one masala item. Old and sample items are switched off.
- **Test data removed:** no test bills, customers, receipts or counters are left.
- Anonymous visitors cannot read or write anything (the rules refuse them), but see the step below to switch their sign-in off.

## One step left for you: switch anonymous sign-in off

The Firebase command line can only switch sign-in methods *on*, so this is one click in the console:

1. Open <https://console.firebase.google.com/project/broiler-pos/authentication/providers>.
2. Under **Sign-in method**, open **Anonymous**, turn it **off**, save.

(Email/Password must stay on: that is how the PINs work.)

## Before the first bill

1. **Set today's rates.** The ⚙️ button (top right of the counter, tapped twice) opens the admin **inside the counter app** (the same site as <https://broiler-pos-admin.web.app>); **Back to billing** closes it and locks it again. Sign in with the **managing PIN**,
   open **விலை** (Rates), set each rate, **சேமி** (Save). The admin dashboard warns when today's rates are not all set.
2. Install the app (`PRINTING.md`: *Build the Android app*, *Set up the tablet*), sign in with the **billing PIN**.
3. Pair the BonKaso BKT05 (the **Bluetooth** version) and print the **test bill** and the **calibration sheet** (`PRINTING.md`).
4. Ring up one cash bill, print it, and look at the paper: *Honey Broilers*, the bill number like `22-10/1`.

## What language the screen uses

- **The counter screen is in plain English** (Chicken, Mutton, Others, Cash, UPI, Split, Credit, Print bill, Admin…).
- **Product names stay in Tamil** (they come from the menu).
- **The printed bill is fully Tamil** (date, bill number, items, weights, totals, payment, thanks line). Only the shop name, *Honey Broilers*, is in English.

## How the shop runs

- **Bill number:** `dd-mm/number`, starting at 1 each day (`22-10/1`, `22-10/2`, …).
- **Five items to a bill.** For more, make a second bill.
- **Cash, UPI (GPay), split (GPay + cash) and credit (kadan)** all work. Credit and taking a credit payment need the internet; everything else works offline and uploads by itself.
- **Printer trouble:** the sale is already saved. Read the message on the screen, fix it (switch the printer on, switch Bluetooth on) and press **Print again**.
- **A copy of an earlier bill:** the **Recent bills** button in the counter's top bar; it prints marked **நகல்** (copy).
- **Owner's view of the day:** the admin site, <https://broiler-pos-admin.web.app> (managing PIN, everything in Tamil, phone and tablet layouts): the day's kilos and money (cash, GPay, credit), week and month, reports, bills (delete one), credit book (take a payment) and rates.
  `node --env-file=shop/worker-app/.env scripts/check-books.mjs` still gives the same figures from a computer.
- **Offline:** the Online/Offline light is a status light, not a button. Bills made offline are saved on the tablet and upload by themselves when the internet returns.

## Clearing test data

Everything made while testing (bills, credit customers, payments, bill counters) can be removed before the shop opens. The menu, rates, settings and PIN accounts are not touched.

1. Take a backup first: `npm run backup` writes `backups/firestore-<time>.json` (read-only; the folder is not committed) and lists what is in the database.
2. Check the list. Only delete what is certainly test data.
3. Delete each collection with the Firebase CLI. It uses your Google login, so it can delete what the app's access rules forbid:
   `npx firebase-tools firestore:delete orders --recursive --force --project broiler-pos`, then the same for `customerPayments`, `customers` and `counters`.
4. Run `npm run backup` again and check the counts are 0.
5. On the tablet, clear the app's storage once (Android Settings, Apps, Broiler POS, Storage, Clear data) so its old Recent bills list and bill counter are gone. This signs it out and forgets the printer.

## End of the first day

Run `node --env-file=shop/worker-app/.env scripts/check-bills.mjs` and `scripts/check-books.mjs` and compare the totals with the cash drawer and the GPay
statement. Both read only; they change nothing.

## Not built yet (planned)

Menu editing from the admin site (add, rename, hide items), expenses, top-items charts, scheduled backups and the nightly email.
The project stays on Firebase's **free plan**, so backups will be an Excel export rather than Firebase's scheduled backup. See `GAPS.md`.
