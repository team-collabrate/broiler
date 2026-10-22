# Product Requirements Document (PRD)
## Kumbakonam Cafe POS System

### 1. Overview
A lightweight Progressive Web App (PWA) POS system for Kumbakonam Cafe, consisting of two apps sharing one backend:
- **Worker App** — runs on an Android tablet at the counter; used to build orders, take payment, and print bills.
- **Owner App** — runs on the two owners' Android phones; used to view live sales, reports, and manage the menu remotely.

### 2. Goals
- Let counter staff take orders and print a bill in under 30 seconds per order.
- Give both owners real-time visibility into sales from anywhere.
- Allow owners to update menu items/prices without needing the developer.
- Work reliably even with unstable cafe wifi.

### 3. Non-Goals
- No online ordering / customer-facing app.
- No integrated payment gateway (UPI/card are recorded manually, not processed in-app).
- No inventory/stock management.
- No multi-branch support (single cafe location only).

### 4. Users & Roles
| Role | Device | Access |
|---|---|---|
| Worker | Android Tablet | PIN login → Order & Billing screen only |
| Owner (x2) | Android Phone | PIN login → Dashboard, Reports, Menu Management |

### 5. Core Features

#### 5.1 Worker App (Tablet)
- PIN-based login.
- Menu grid by category (Breakfast, Lunch, Dinner, Tea, Vadai — ~65 items), tap to add to cart.
- Cart: adjust quantity, add item note, remove item.
- Select payment method: Cash / UPI / Split (manual tag only). Split divides one bill between cash and GPay; entering either amount fills in the other.
- No discounts — the cafe does not give them, and the till offers no way to apply one.
- Record spending from the till (vegetables, milk, gas) — name and amount.
- Bulk/regular customers on credit: mark a bill "on account" against a named customer, and take payment against their balance later. The counter only lists customers who currently owe.
- Print bill via USB thermal printer (ESC/POS).
- Order saved to database (works offline, syncs when back online).

#### 5.2 Owner App (Phone)
- PIN-based login (2 separate owner PINs).
- Live dashboard: today's total sales, order count, average order value, top-selling items.
- Reports: daily / weekly / monthly views with charts and historical order list.
- Menu management: add, edit, delete items; update price; toggle active/inactive.

### 6. Key Requirements
- **Offline resilience**: Worker app must allow order creation and printing without internet; auto-sync to owner dashboards once connectivity returns.
- **Realtime sync**: When online, new orders should reflect on owner dashboards within a few seconds.
- **Installable**: Both apps installable as PWA (Add to Home Screen) on Android, no Play Store dependency required for v1.
- **Printing**: Must support USB ESC/POS thermal printer via Web USB (Chrome/Android).

### 7. Success Metrics
- Order creation + print completes in <30 seconds.
- Zero lost orders during a wifi outage (all orders sync once reconnected).
- Both owners can view same-day sales from their phones without visiting the cafe.

### 8. Assumptions & Constraints
- Single tablet, single active shift at a time (no multi-terminal conflict handling needed for v1).
- Currency: INR (₹).
- No stock/inventory tracking in v1.
- Solo developer; scope kept intentionally lean for v1.

### 9. Future Considerations (Out of Scope for v1)
- Multiple worker tablets simultaneously.
- Inventory/stock tracking.
- Customer-facing ordering or loyalty program.
- Integrated payment gateway.
