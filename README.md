# Honey Broilers POS

Billing for a chicken and mutton shop: a **counter app** on an Android tablet (weight, count and amount sales, Tamil bills on a
58 mm Bluetooth printer, works offline) and an **admin site** for the owner (sales, bills, credit book, today's rates), on one
Firebase project, `broiler-pos`.

| | Where | Address |
| --- | --- | --- |
| Counter | `shop/worker-app` (also packed as an Android app in `shop/worker-app/android`) | https://broiler-pos.web.app |
| Admin | `shop/owner-app` | https://broiler-pos-admin.web.app |
| Shared code | `shop/shared` (sale maths, bill numbers, offline outbox, Firestore access) | |
| Access rules | `firestore.rules` (deployed with `firebase.json`) | |
| Operations scripts | `scripts/` (emulators, rules tests, accounts, backup) | |
| Documentation | `docs/` | |

## Layout

```
firebase.json, firestore.rules, .firebaserc   deploy configuration (hosting for both sites, Firestore rules)
shop/                                         the product
  shared/        @kumbakonam/shared           money in paise, weight in grams, offline sales, Firestore services (has the unit tests)
  worker-app/    counter app (Vite + React)   Capacitor Android shell in android/
  owner-app/     admin site (Vite + React)
  scripts/       asset and Android build tools (icons, photos, APK)
scripts/                                      operations: emulators, rules tests, accounts, menu seed, backup
docs/                                         guides (go live, printing, offline, owner app, testing); docs/archive = old planning notes
.github/workflows/ci.yml                      typecheck, tests and build on every push
```

## Everyday commands

Run these from `shop/` unless a folder is named.

| Command | What it does |
| --- | --- |
| `npm install` | Installs the apps (once). |
| `npm run typecheck` / `npm test` | Types, and the 139 unit tests of the shared code. |
| `npm run dev:worker` / `npm run dev:owner` | The counter or the admin on a local port, against the live project (needs `.env`, see below). |
| `npm run deploy:counter` / `npm run deploy:owner` | Builds and publishes one site. The Android app loads the hosted counter, so a counter deploy reaches the tablet with no reinstall. |
| `npm run android:apk` | Builds the debug APK (only needed when the native Android part changes). |

From the repository root:

| Command | What it does |
| --- | --- |
| `npm install` | Installs the operations scripts' tools (once). |
| `npm run emulators`, `npm run emulators:seed`, `npm run dev:emulator` | Local Firestore and Auth with the real rules, test accounts (PIN 121323) and the counter on port 3002. Nothing touches the live project. |
| `npm run test:rules` | The 62 access-rule tests against the emulator. |
| `npm run backup` | Read-only copy of the live database into `backups/` (not committed). |
| `npm run seed:users`, `npm run seed`, `npm run check:access` | Account creation, menu setup and the live access check. See `docs/GO_LIVE.md`. |
| `node --env-file=shop/worker-app/.env scripts/change-pin.mjs owner` | Changes a PIN (asks for the current and the new one). |

## Configuration

Copy `shop/worker-app/.env.example` to `shop/worker-app/.env` (and the same for `shop/owner-app`) and fill in the Firebase web
app values (Firebase console, Project settings). `.env` files are never committed. The operations scripts read the same
`shop/worker-app/.env`. PINs are never stored in files: the scripts ask for them without echo.

## Documentation

Start with `docs/GO_LIVE.md` (accounts, first day, clearing test data). Then `docs/OWNER_APP.md`, `docs/PRINTING.md`,
`docs/OFFLINE.md`, `docs/TESTING.md`, `docs/DATA_MODEL.md` and, for the cashier, `docs/STAFF_GUIDE_TA.md`. `docs/GAPS.md` lists what is
not built yet.
