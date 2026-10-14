# Broiler

Weight-based POS (`apps/pos`) and owner admin app (`apps/admin`), built with Expo, React Native,
TypeScript and Firebase. See [ROADMAP.md](ROADMAP.md) for the phases.

```
apps/pos          counter app: pick an item, enter the weight, charge
apps/admin        owner app: dashboard and orders, live from Firestore
packages/shared   money/weight maths, types, Firebase init, orders and menu services
firestore.rules   Firestore security rules (v1: placeholder, see Phase 2)
scripts/          seed-menu.mjs: adds a starter menu
```

Money is stored as integer paise and weight as integer grams, so totals never pick up
floating-point drift. A line costs `round(pricePerKgMinor × grams / 1000)`.

## Setup (Phase 1)

1. **Install**

   ```bash
   npm install
   ```

2. **Firebase project.** This repo uses its own project, **`broiler-pos`** (Firestore in Mumbai, `asia-south1`, anonymous sign-in on), pinned in `.firebaserc`. It is separate from the live Kumbakonam POS project, which these apps must never be pointed at: they share collection names (`menu`, `orders`) and deploying these rules to that project would replace its rules.

   To set up a fresh project instead (a second shop, or a staging copy), create it in the [Firebase console](https://console.firebase.google.com), register a **Web app**, and put its id in `.firebaserc`.

3. **Add the config to both apps** (they must use the same project):

   ```bash
   cp apps/pos/.env.example apps/pos/.env
   cp apps/admin/.env.example apps/admin/.env
   ```

   Fill in the `EXPO_PUBLIC_FIREBASE_*` values from Project settings → Your apps → Web app. On Windows PowerShell use `copy` instead of `cp`. The `.env` files are gitignored.

4. **Deploy the rules and the sign-in setting** (only needed after changing `firestore.rules` or `firebase.json`):

   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore,auth
   ```

   The project comes from `.firebaserc`, so no `--project` flag is needed. Keep it that way; don't add `--project kumbakonam-pos`.

5. **Seed a starter menu** (sample prices):

   ```bash
   npm run seed
   ```

   Set the real rates with the **Today's rate** button at the top right of the POS, which also reminds you each day until the rates are set.

6. **Run the apps** (in separate terminals):

   ```bash
   npm run pos
   npm run admin
   ```

   After editing a `.env`, restart with `npx expo start --clear` from that app's folder, since Expo reads it at bundle time.

### Run in the browser

To try the apps on your computer without a phone, run either of these (each needs its `.env` from step 3):

```bash
npm run pos:web     # POS   → http://localhost:3000
npm run admin:web   # Admin → http://localhost:8082
```

Both can run at the same time. The browser view is for looking at layout and trying the flow; check touch behavior, the slider and anything hardware-related on a real Android device.

## Hosted prototype

Both apps are published on Firebase Hosting in the `broiler-pos` project (free plan):

| App | Address |
| --- | --- |
| POS (counter) | https://broiler-pos.web.app |
| Admin (owner) | https://broiler-pos-admin.web.app |

```bash
npm run deploy       # rebuild both apps for the web and publish them
npm run reset-demo   # delete all sales (orders and the bill counter) so the next demo starts clean
```

The sites are marked no-index, so search engines skip them. **They are a prototype with no login:** anyone who has the address can make sales, change the daily rates and read the sales. Use sample data only until Phase 2 adds owner login.

## Language and screens

The whole app and the bill are in Tamil (`apps/pos/src/strings.ts`, `apps/admin/src/strings.ts`; the shop name on the bill is `SHOP_NAME` in `apps/pos/src/config.ts`). Each menu item has an English `name` and a Tamil `nameTa`; the Tamil one is shown and printed. It is built for a tablet in landscape and also fits laptop windows (about 1366×650 and up) and large monitors.

## Checks

```bash
npm run typecheck   # all workspaces
npm test            # shared package unit tests
```

## Known limits in v1

- **Security is a placeholder.** Both apps sign in anonymously, so the rules can't tell the POS from the owner. Don't put real sales data behind it until Phase 2.
- **Saving a sale needs an internet connection** (the order number comes from a Firestore transaction). Offline sales are Phase 6.
- **No printing yet**, and no weighing-scale input: weight is entered on screen (meter, presets or keypad).
- **Any POS user can change today's rate.** Restricting it to the owner is part of Phase 2.
- Not yet run on a physical device or against a live Firebase project. It typechecks, the shared logic is unit-tested, and both apps bundle with Metro.
