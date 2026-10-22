# Technical Design Document (TDD)
## Kumbakonam Cafe POS System

### 1. Architecture Overview
```
┌─────────────────────┐        ┌─────────────────────┐
│   Worker PWA (Tab)   │        │  Owner PWA (Phone)   │
│  React + Vite + TS   │        │  React + Vite + TS   │
└──────────┬───────────┘        └──────────┬───────────┘
           │                               │
           │        Firebase SDK           │
           └───────────────┬───────────────┘
                            │
                 ┌──────────▼──────────┐
                 │   Firebase Backend   │
                 │  Firestore + Auth    │
                 │      + Hosting        │
                 └───────────────────────┘
```

Both apps are separate PWA builds (separate installable icons/entry points) from a single monorepo, sharing components/services where possible, both connecting to the same Firebase project.

### 2. Tech Stack
| Layer | Choice | Reason |
|---|---|---|
| Frontend framework | React + Vite + TypeScript | Fast dev, PWA-ready, small bundle |
| State | React Context + local hooks | App is small enough; avoids Redux overhead |
| Backend | Firebase (Firestore, Auth, Hosting) | Realtime sync, offline persistence built-in, no server ops |
| Auth | Firebase Auth (custom PIN flow) | See §5 |
| Printing | Web Bluetooth API → ESC/POS commands | Chrome on Android supports Web Bluetooth; the cafe's printer is Bluetooth |
| Charts | Recharts | Simple, good with React |
| Offline | Firestore offline persistence (IndexedDB) | Native support, minimal custom code |
| Hosting | Firebase Hosting | Free tier, HTTPS, PWA-friendly |

### 3. PWA Setup
- `vite-plugin-pwa` for manifest + service worker generation.
- Two manifests/entry builds:
  - `worker.manifest.json` → app name "Kumbakonam POS", installed on tablet.
  - `owner.manifest.json` → app name "Kumbakonam Dashboard", installed on phones.
- Service worker caches app shell (HTML/JS/CSS) for offline load; data itself is handled by Firestore's own offline cache, not the service worker.

### 4. Offline Strategy
- `enableIndexedDbPersistence()` on Firestore init in the Worker app.
- Orders are written to Firestore locally first (optimistic write); Firestore queues and syncs automatically when connectivity resumes.
- Worker app shows a small "Offline — will sync" badge when `navigator.onLine` is false or Firestore reports pending writes.
- Owner app does not need offline write support (view-only + menu edits), but read-cache is still enabled for fast reopen.

### 5. Auth Design (PIN-based)
- Firebase Auth Anonymous sign-in per device, paired with a custom `users` collection storing a hashed 4-digit PIN + role.
- On app load: prompt PIN → look up matching user doc by PIN hash → set local session (role: `worker` | `owner`) → store session in memory (re-prompt PIN if app is closed/reopened, or after inactivity timeout, e.g. 30 min).
- PINs are never stored in plaintext; hashed client-side (e.g. SHA-256) before comparison against stored hash.
- Firestore Security Rules restrict:
  - `orders` writes → only authenticated sessions with role `worker` or `owner`.
  - `menu` writes → only role `owner`.
  - `orders`/`menu` reads → any authenticated session (worker needs menu; owner needs orders).

### 6. Printing (Bluetooth ESC/POS)
- Web Bluetooth API (`navigator.bluetooth.requestDevice`) to pair with the BLE thermal printer once; the connection is cached and silently re-established when the link drops.
- Bill content formatted as ESC/POS byte commands (text, bold, cut command) via a small helper (e.g. `escpos-buffer` style utility, hand-rolled since footprint is small). The byte format is transport-independent — it was unchanged by the move off USB.
- Writes are chunked (180 bytes) because BLE caps a single ATT write; `writeValueWithResponse` is preferred so each ACK provides flow control for printers with small buffers.
- Print triggered after order is saved; if printer not connected, fallback to on-screen "Bill" view the worker can screenshot/share.
- **Constraint:** Web Bluetooth reaches BLE/GATT devices only. A printer that pairs as a classic Bluetooth serial port (SPP/RFCOMM) cannot be driven from any browser — the on-screen bill is the fallback for that hardware.

### 7. Realtime Sync
- Owner dashboard subscribes to `orders` collection via `onSnapshot` filtered by date range (today / this week / this month).
- Aggregates (total sales, order count, top items) computed client-side from the snapshot for v1 (data volume is small — single cafe, ~30 items).

### 8. Data Flow — Order Creation
1. Worker adds items to cart (local state only).
2. Worker taps "Print Bill" → cart validated → order object created.
3. Order written to Firestore `orders/{orderId}` (works offline via local cache).
4. Print job sent to USB printer.
5. Cart cleared, ready for next order.
6. Owner app(s) receive the new order via `onSnapshot` once online.

### 9. Error Handling
- Printer not connected/paired → show retry + "view bill" fallback.
- Firestore write fails after retries → order kept in local IndexedDB queue (handled natively by Firestore SDK); UI shows sync-pending badge.
- PIN mismatch → generic "Incorrect PIN" message (no user enumeration).

### 10. Deployment
- Firebase Hosting for both PWA builds (two hosting targets or two sub-paths, e.g. `/worker` and `/owner`, or two separate Firebase Hosting sites within the same project).
- CI: manual `firebase deploy` for v1 (solo dev); can add GitHub Actions later.

### 11. Security Notes
- Firestore Security Rules are the primary access control layer (see §5).
- No sensitive payment data stored (payment method is just a text/enum tag).
- HTTPS enforced by Firebase Hosting by default.
