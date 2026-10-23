# Testing

What each check proves, and how to run it. Run the first group before every commit; the second group when the rules, the
credit or payment code, or the bill format change.

## Every commit (from `shop/`)

| Command | What it checks |
| --- | --- |
| `npm test` | The pure sale logic: weights, money, split, credit names, bill numbering, the outbox, the PIN lock, printer recovery and the recent-bills list (124 tests, a few seconds). |
| `npm run typecheck` | Types in all four apps. |
| `npm run build:worker` | The counter builds for production, including the service worker. |
| `npm run android:apk` | Builds the installable Android app (several minutes the first time). See PRINTING.md. |

## Security rules and the real flows, on your own computer (from the repo root)

The rules in `firestore.rules` decide who may write what. They cannot be tried against the live project without changing it,
so they are tested in Firebase's local emulator, which needs Java. This project keeps its own portable Java in `.tools/jdk21`
(git-ignored): download the Windows x64 zip of Eclipse Temurin 21 from <https://adoptium.net>, check its SHA-256 against the one
on that page, and unzip it into `.tools/jdk21`. Any Java 11 or newer on the machine's PATH works too.

| Command | What it does |
| --- | --- |
| `npm run test:rules` | Starts an emulator, runs the 41 rules tests in `scripts/rules`, stops it. Stop `npm run emulators` first if it is running. |
| `npm run emulators` | Starts the emulators and leaves them running (data is in memory, gone when they stop). |
| `npm run emulators:seed` | Puts test accounts (owner and counter PIN **121323**; valid only inside the emulator) and the catalog into the running emulators. |
| `npm run dev:emulator -w shop` | The counter on port 3002 talking to the emulators with the real rules. Sign in with 121323. |

With the emulators running, the scripts can be pointed at them with `USE_EMULATOR=1`, for example:

```
USE_EMULATOR=1 OWNER_PIN=121323 node scripts/check-books.mjs
USE_EMULATOR=1 OWNER_PIN=121323 COUNTER_PIN=121323 node --env-file=shop/worker-app/.env scripts/check-access.mjs
```

`USE_EMULATOR=1` forces a throwaway project id (`demo-broiler`), so it cannot reach the live project.

## Against the live project (after the new rules are deployed, Phase 6)

| Command | What it checks |
| --- | --- |
| `npm run check:access` | The deployed rules, as the counter and the owner: what each may and may not do, including split, credit, the offline sale time and the 5-line limit. Asks for both PINs. |
| `node --env-file=shop/worker-app/.env scripts/check-bills.mjs [day]` | Lists a day's bills with when each was sold and when it arrived; reports duplicate or missing bill numbers per counter. |
| `node --env-file=shop/worker-app/.env scripts/check-books.mjs [day]` | **Reconciles the day's money from the raw records**: every bill adds up, every customer's balance equals their credit bills minus their payments, and cash, GPay and credit totals. Use after a trial day. |

Neither of the last two changes anything.

## What is not covered by an automatic test

- The screens themselves (taps, layout): checked by hand in the browser and, for the tablet, on the device (Phases 5 and 10).
- The Bluetooth printer itself and the installed app on the tablet (the printing screens and the recovery logic are tested; the paper is not). The checklist for the day the printer arrives is in PRINTING.md.
- The rules tests are not yet part of CI (they need Java on the runner); run `npm run test:rules` before changing the rules.
