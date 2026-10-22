# Design Brief
## Kumbakonam Cafe POS System

### 1. Design Principles
- **Speed over decoration** — worker screen is used dozens of times a day; every extra tap costs time.
- **Thumb-friendly** — tablet used in portrait or landscape at counter height; owner phone used one-handed.
- **Clarity at a glance** — owner dashboard numbers should be readable in 2 seconds.
- **Forgiving** — large tap targets, confirm before destructive actions (delete item, clear cart).

### 2. Visual Direction
- Clean, minimal, warm — reflecting a cafe (not a generic SaaS dashboard).
- Reference feel: image 1 & 2 shared earlier (dark sidebar + card grid, warm accent color) — good direction for the Worker app.
- Owner app should feel calmer/lighter — optimized for quick glances, not data entry.

### 3. Color Palette (suggested)
| Role | Color | Use |
|---|---|---|
| Primary accent | Warm terracotta / coral (`#E8674F` or similar) | Buttons, active states, brand accent |
| Background (Worker) | Near-black (`#14151A`) | Counter tablet, low glare, reduces eye strain in bright cafe lighting |
| Background (Owner) | Off-white (`#FAFAF8`) | Phone dashboard, calm daytime reading |
| Success | Soft green | Payment confirmed, sync complete |
| Warning | Amber | Offline / sync pending |
| Text | High-contrast white/near-black depending on background | Legibility first |

### 4. Typography
- A clean geometric sans-serif (e.g. Inter, or system default on Android — Roboto).
- Large, bold numerals for prices and totals (important for quick scanning).
- Minimum 16px body text on tablet; minimum 14px on phone, with larger totals/headers.

### 5. Worker App (Tablet) — Layout
- **Left**: thin icon sidebar (optional, for settings/logout) — dark theme.
- **Center**: menu grid, 3 columns, card per item (image placeholder/icon, name, price).
- **Right**: persistent cart panel — item list, qty steppers, note field, running subtotal/total, big "Print Bill" button pinned at bottom.
- Category tabs (even with flat list, group visually if needed) at top of menu for easy scanning.

### 6. Owner App (Phone) — Layout
- **Home/Dashboard**: top summary cards (Today's Sales, Orders, Avg Order Value), followed by a "Top Items" mini-list.
- **Reports tab**: segmented control (Daily / Weekly / Monthly), chart on top, scrollable order list below.
- **Menu tab**: simple list with edit/delete swipe actions or icon buttons; floating "+ Add Item" button.
- Bottom tab bar navigation: Dashboard / Reports / Menu / Settings.

### 7. Components Needed
- Item card (menu grid)
- Cart line item (qty stepper, note, remove)
- PIN pad (numeric keypad, 4 digits, masked dots)
- Summary stat card
- Chart component (bar/line, daily totals)
- Order history row (expandable to show items)
- Menu edit form (name, price, category toggle, active switch)
- Sync status badge (online/offline/pending)

### 8. Accessibility & Practical Notes
- High contrast for kitchen/counter lighting conditions.
- Large tap targets (min 44x44px) — staff may be moving quickly.
- Avoid relying on color alone for status (pair with icon/text, e.g. "Offline" badge with icon).
- Confirm dialogs for: clearing cart, deleting menu item, logout.
