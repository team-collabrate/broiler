/**
 * Header/footer text printed on every receipt. Edit these to match the shop —
 * they're the only strings on the bill that aren't derived from the order.
 *
 * Kept as plain data (not translated through the i18n layer) because a printed
 * receipt is a legal-ish document for the customer: it always reads in Tamil,
 * regardless of the language the worker happens to have the app set to.
 */
export const CAFE_DETAILS = {
  /** Very top line of the bill, above the logo — a devotional opening line,
   *  not part of the shop's own identity block below it. Leave empty to omit. */
  invocation: "சாமியே சரணம் !!",
  /** Shop name, printed largest. */
  name: "கும்பகோணம் கஃபே",
  /** One-line descriptor under the name — cuisine and location. */
  subtitle: "சைவ உணவகம்",
  /** Printed as "Ph: <phone>". Leave empty to omit the line. */
  phone: "",
  /** Closing line above the footer. */
  thanks: "நன்றி",
  /** Smallest line at the very bottom. Leave empty to omit. */
  footer: "",
} as const;

/**
 * Optional logo, served from worker-app/public/. Drop a high-contrast PNG
 * there and set this back to its path ("/receipt-logo.png") to print it
 * centred at the top; if the file is missing the receipt renders without it
 * rather than failing.
 *
 * Re-enabled 2026-09-01 with a fresh mark (repo root logo-b-w.png, prepared
 * small by request — see LOGO_MAX_W/LOGO_MAX_H in receiptCanvas.ts, both
 * sized to this exact file so the canvas never has to resample it again).
 *
 * Thermal printing is 1-bit: a black-on-white line-art mark reproduces well,
 * photographs and grey gradients turn to mud.
 */
export const RECEIPT_LOGO_URL: string | null = "/receipt-logo.png";
