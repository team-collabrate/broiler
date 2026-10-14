# User Flow
## Kumbakonam Cafe POS System

### 1. Worker Flow (Tablet)

```
[App Launch]
     │
     ▼
[PIN Entry Screen] ──(wrong PIN)──► [Error, retry]
     │ (correct PIN)
     ▼
[Menu Screen: flat item grid]
     │  tap item
     ▼
[Item added to Cart panel] ──► (repeat for more items)
     │
     ▼
[Review Cart]
   - adjust qty (+/-)
   - add note per item
   - remove item
   - apply discount (optional)
     │
     ▼
[Select Payment Method: Cash / UPI / Card]
     │
     ▼
[Tap "Print Bill"]
     │
     ▼
[Order saved to DB] ──(offline?)──► [Queued, "will sync" badge]
     │
     ▼
[Bill sent to USB printer] ──(printer not found)──► [Show on-screen bill fallback]
     │
     ▼
[Cart cleared → back to Menu Screen, ready for next order]
```

### 2. Owner Flow (Phone)

```
[App Launch]
     │
     ▼
[PIN Entry Screen] ──(wrong PIN)──► [Error, retry]
     │ (correct PIN)
     ▼
[Dashboard Home]
   - Today's total sales
   - Order count
   - Top items
     │
     ├──► [Tap "Reports"] ──► [Select range: Daily/Weekly/Monthly]
     │                              │
     │                              ▼
     │                     [Charts + order history list]
     │
     └──► [Tap "Menu Management"]
                    │
                    ▼
          [List of menu items]
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   [Add Item]  [Edit Item]  [Delete/Deactivate Item]
        │           │           │
        └───────────┴───────────┘
                    │
                    ▼
          [Changes sync instantly to Worker app menu]
```

### 3. Cross-App Interaction
- Worker completes an order → Owner dashboard(s) update in real time (both owners see it, on separate phones, simultaneously).
- Owner edits menu/price → Worker's menu screen updates automatically (no app restart needed).

### 4. Session Handling
- Both apps stay logged in until manual logout or an inactivity timeout (e.g. 30 minutes), after which the PIN screen reappears.
