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

2. **Create a Firebase project** at https://console.firebase.google.com, then:
   - Build → **Firestore Database** → create a database
   - Build → **Authentication** → Sign-in method → enable **Anonymous**
   - Project settings → Your apps → add a **Web app** and copy its config

3. **Add the config to both apps** (they must use the same project):

   ```bash
   cp apps/pos/.env.example apps/pos/.env
   cp apps/admin/.env.example apps/admin/.env
   ```

   Fill in the `EXPO_PUBLIC_FIREBASE_*` values in each `.env`. On Windows PowerShell use `copy` instead of `cp`.

4. **Deploy the rules**

   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules --project <your-project-id>
   ```

5. **Seed a starter menu** (sample prices; edit them in the console afterwards):

   ```bash
   npm run seed
   ```

6. **Run the apps** (in separate terminals):

   ```bash
   npm run pos
   npm run admin
   ```

   After editing a `.env`, restart with `npx expo start --clear` from that app's folder, since Expo reads it at bundle time.

## Checks

```bash
npm run typecheck   # all workspaces
npm test            # shared package unit tests
```

## Known limits in v1

- **Security is a placeholder.** Both apps sign in anonymously, so the rules can't tell the POS from the owner. Don't put real sales data behind it until Phase 2.
- **Saving a sale needs an internet connection** (the order number comes from a Firestore transaction). Offline sales are Phase 6.
- **No printing yet**, and weight is typed in by hand.
- Not yet run on a physical device or against a live Firebase project. It typechecks, the shared logic is unit-tested, and both apps bundle with Metro.
