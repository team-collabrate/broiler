// The quick-pick buttons on the sale panel. Edit these lists to change them; the order
// here is the order on screen.

/** Presets box: fixed weights, in grams. Each button shows its price for the selected item. */
export const WEIGHT_PRESETS_GRAMS = [100, 250, 500, 750, 1000, 2000];

/** By amount box: quick amounts beside the keypad, in paise (10000 = ₹100). */
export const AMOUNT_PRESETS_MINOR = [10000, 20000, 50000];

/** The weight meter's scale runs from 0 to this; the −/+ buttons go beyond it. */
export const METER_MAX_GRAMS = 5000;
