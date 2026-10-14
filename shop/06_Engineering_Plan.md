# Engineering Plan
## Kumbakonam Cafe POS System

### 1. Assumptions
- Solo developer.
- Estimates assume part-time/evening pace; adjust to your actual availability.

### 2. Phases

#### Phase 0 — Setup (0.5–1 day)
- Create Firebase project (Firestore, Auth, Hosting).
- Scaffold monorepo: `/worker-app`, `/owner-app`, `/shared` (shared types, Firebase config, UI primitives).
- Set up Vite + React + TypeScript + `vite-plugin-pwa` for both apps.
- Configure Firestore Security Rules skeleton.

#### Phase 1 — Auth & Data Layer (1–2 days)
- Build PIN entry screen (shared component).
- Implement PIN hashing + lookup against `users` collection.
- Session handling (in-memory + inactivity timeout).
- Firestore service layer: `menu`, `orders`, `users` CRUD helpers (shared between both apps).
- Enable Firestore offline persistence in Worker app.

#### Phase 2 — Worker App Core (2–3 days)
- Menu grid screen (fetch from `menu`, render cards).
- Cart panel: add/remove/qty/note/discount logic.
- Order submission → write to `orders`.
- Sync-pending badge (offline indicator).

#### Phase 3 — Printing (1–2 days)
- Web USB pairing flow (one-time "connect printer" setup screen).
- ESC/POS bill formatting helper (header, items, total, footer/cut).
- Print trigger after order save.
- Fallback on-screen bill view if printer unavailable.

#### Phase 4 — Owner App Core (2–3 days)
- Dashboard screen: realtime `onSnapshot` on today's orders, computed stats.
- Reports screen: date-range selector, chart (Recharts), order history list.
- Menu management screen: add/edit/delete/toggle-active, writes to `menu`.

#### Phase 5 — Polish & Hardening (1–2 days)
- Confirm dialogs (clear cart, delete item, logout).
- Empty/error states (no orders yet, printer not found, offline).
- Finalize Firestore Security Rules (lock down by role).
- Basic manual QA pass on both real devices (tablet + phone).

#### Phase 6 — Deploy (0.5 day)
- Firebase Hosting deploy for both apps.
- Install both PWAs on actual devices ("Add to Home Screen").
- Create initial `users` (2 owner PINs, 1+ worker PIN) and seed `menu` (~30 items) via a simple admin script or directly through the Menu Management screen.

### 3. Rough Total Estimate
~8–13 working days solo, depending on pace and how much time is spent on printer/hardware testing (often the most unpredictable part).

### 4. Suggested Build Order (Critical Path)
1. Firebase setup + data layer (needed by everything else)
2. Worker: Menu → Cart → Order save (core value first)
3. Printing (can be stubbed with "fake print" during early dev, real USB testing later)
4. Owner: Dashboard (proves realtime sync works end-to-end)
5. Owner: Menu management + Reports
6. Polish + deploy

### 5. Testing Checklist Before Launch
- [ ] Order created on tablet while offline → appears correctly once back online
- [ ] Both owner phones receive same order in realtime
- [ ] Owner edits a menu item → reflects on tablet without restart
- [ ] Print produces a correctly formatted physical bill
- [ ] PIN login rejects wrong PIN, accepts correct PIN for both roles
- [ ] Discount + tax(if any)/totals calculate correctly
- [ ] App installable on Android as PWA (icon, standalone mode, works after reboot)

### 6. Risks / Watch-outs
- **Web USB printer compatibility** varies by printer model — test with the actual physical printer early (Phase 3, not last).
- **Firestore free tier limits** — unlikely to be hit at single-cafe scale, but worth checking read/write quotas if usage grows.
- **PIN security** is basic by design (café context) — acceptable for v1, not meant for high-security multi-location use.
