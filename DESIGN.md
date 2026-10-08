# Design preferences

Captured from the owner's descriptions, hand sketches and annotated screenshots. Update this
file when a preference changes, so later phases follow it.

**Device:** the counter uses a **Redmi Pad 2 in landscape**. The layout is designed for about
1280×800 dp and holds from roughly 1024 to 1463 wide. Phones still work (one scrolling page) but
are not the design target.

**No popups, anywhere.** No modals, sheets, alerts or overlays in either app. Everything happens
on the page: confirmations and errors are banners, the rate editor is a view, order detail
expands in place.

**Touch:** every control is at least 48dp, gaps are at least 8dp, and the weight handle is 64dp.

## POS: the sale screen

```
┌ Broiler POS ─────────────────────────────────── [Today's rate ●] ┬ Current sale ─────┐
│ [Broiler (skin) ₹240 1 kg][Skinless ₹260 500 g][Boneless ₹320 500 g][Country …][Liver…]│
│ ┌ CUSTOM WEIGHT ─────────────────── Broiler chicken (with skin) · ₹240.00 per kg ┐ │
│ │ 1 kg  ₹240.00                                              (−)   (+)            │ │
│ │ ━━━━━━━━━━━━●(|||)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  big 64dp handle     │ │
│ │ |.|.|.|.|1kg|.|.|.|2kg|.|.|.|3kg ... 5kg    ruler, a tick every 50 g            │ │
│ └─────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ PRESETS ───────────────┐ ┌ BY AMOUNT (₹) ─────────────────┐   │ cart lines        │
│ │ [100 g ₹24] [250 g ₹60]│ │ ₹100                  ≈ 417 g   │   │ Cash UPI Card     │
│ │ [500 g ₹120][750 g ₹180]│ │ [1][2][3]            [₹100]     │   │ Total             │
│ │ [1 kg ₹240] [2 kg ₹480]│ │ [4][5][6]            [₹200]     │   │ [ Charge ]        │
│ └────────────────────────┘ │ [7][8][9]            [₹500]     │   │                   │
│ [        Add 1 kg · ₹240.00        ]  [C][0][⌫]              │   │                   │
└─────────────────────────────────────────────────────────────┴───────────────────────┘
```

All three ways to sell are on screen at once. There are no tabs and nothing to open first.

### Items

- Compact cards in one row (name, ₹/kg, and the item's **default weight** on the right: bone-in 1 kg, skinless ½ kg, boneless ½ kg, country chicken 1 kg, liver 100 g).
- The first item is selected on load and stays selected after each Add, so the panel is never empty.
- Default weights are stored per item as `defaultGrams` (edited in the Firebase console until the admin app gets menu management in Phase 4; items without one fall back to 1 kg).

### 1. Custom weight (the meter)

- A wide strip, the whole 76dp height of it a touch target: **touch anywhere and the handle jumps to your finger, drag to slide.** The handle is 64dp with grip marks and grows slightly while held.
- Range 0–5 kg, snapping every 50 g, minimum 50 g. Past 5 kg the −/+ buttons keep going.
- A ruler under the track: a tick every 50 g, taller at 250 g and 1 kg, labelled 0–5 kg.
- The reading is large and always visible: weight (44sp) and price (24sp), updating as you drag.
- **−** and **+** (64dp) move one 50 g step; press and hold to repeat.
- The handle follows the finger on the UI thread (react-native-gesture-handler + reanimated), and the app only hears about it when the 50 g step changes.

### 2. Presets

- Six big buttons, each with its price for the selected item: 100 g, 250 g, 500 g, 750 g, 1 kg, 2 kg. Edit `WEIGHT_PRESETS_GRAMS` in `apps/pos/src/presets.ts`.
- Presets and the meter share one weight: tapping 500 g moves the meter to 500 g; dragging the meter clears the highlight.

### 3. By amount (₹)

- "Give me ₹100 worth": a big ₹ display, the weight it buys at the current rate (`≈ 417 g`), a keypad (digits, C, ⌫), and quick amounts ₹100 / ₹200 / ₹500 beside it. Edit `AMOUNT_PRESETS_MINOR` in `presets.ts`.
- **The bill is exactly the amount asked for** (₹100 bills ₹100.00, not ₹100.08). The weight is what to weigh out. Orders store it on the line as `amountMinor`; the cart and admin show "≈ 417 g (by amount)".

### Which side is live

The side touched last is outlined in red and is what **Add** adds. Nothing is dimmed, so all
three stay fully readable. The Add button says exactly what it will add (`Add 1.25 kg · ₹300.00`
or `Add ₹100.00 · ≈ 417 g`), and flashes "Added ✓" in green after each add, then the panel resets
to the item's default weight.

### Today's rate

- The **Today's rate** button (top right) swaps the main area for a rates view: each type with its ₹/kg, a keypad, **Back** and **Save rates**. The cart stays visible.
- Pick a type and type the rate (the first key replaces it). **Save rates** confirms every rate shown, changed or not, so "same as yesterday" is one tap.
- The button shows a dot until every type has been set today; each row says "Set today", "Not set today" or "Never set".

### Charging

After **Charge** the cart clears at once and a green banner in the cart column reads `✓ Order #12 saved · ₹100.00`, so the next customer can be served immediately. It clears itself after about 6 seconds. If saving fails, a red banner shows the reason with **Retry**, and the cart is kept.

### Phones and small screens

Below tablet width the page is one scrolling column: items, the three boxes stacked, then the cart. Below about 700dp of height the panel scrolls inside itself and **Add stays pinned**.

## Admin app

Order detail opens **in place**: tap an order to expand its lines under it, tap again to close.

## Open points

- **Slider range:** 0–5 kg. If most sales are far smaller, a shorter range would give even finer control; say so.
- **Who may set the rate:** currently any POS user. Phase 2 decides whether that needs an owner PIN.
- **Haptics:** not added. A light tick at each 250 g could be added later if you want a physical feel.

## General (still to describe)

Colors, fonts, language (for example Tamil alongside English) and dark mode have not been
specified yet. Current defaults: red POS and blue admin accents, light mode only, English.
