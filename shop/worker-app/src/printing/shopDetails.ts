/**
 * Header/footer text printed on every receipt. Edit these to match the shop; they are the only strings on
 * the bill that are not derived from the order.
 *
 * Kept as plain data (not translated through the i18n layer) because a printed receipt is for the
 * customer: it always reads in Tamil, whatever language the app is showing.
 */
export const SHOP_DETAILS = {
  /** Shop name, printed largest. */
  name: "Honey Broilers",
  /** One line under the name, such as the address or area. Leave empty to omit. */
  subtitle: "",
  /** Printed as "தொலைபேசி: <phone>". Leave empty to omit the line. */
  phone: "",
  /** Closing line above the footer. */
  thanks: "",
  /** Smallest line at the very bottom. Leave empty to omit. */
  footer: "",
} as const;

/**
 * The paper's printable width in dots: 576 for 80 mm paper (the shop's printer), 384 for 58 mm. The
 * layout works out its columns from this, so changing it is all a different paper needs. Thermal
 * printers print at 203 dpi and reject a raster wider than their head.
 */
export const PAPER_WIDTH_DOTS = 384;

/**
 * The logo printed at the top, served from worker-app/public/. It is the 1-bit rooster (black on white):
 * thermal printing has no greys, so a photo or a colour logo turns to mud. If the file is missing the
 * receipt prints without it rather than failing.
 */
export const RECEIPT_LOGO_URL: string | null = "/receipt-logo.png";

/** The logo is stored at exactly this size, so printing never resamples it (resampling softens the linework just before it is crushed to 1-bit). Regenerate the PNG if you change these. */
export const LOGO_SIZE = { width: 108, height: 130 } as const;
