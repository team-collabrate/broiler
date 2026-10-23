/**
 * Renders a bill to a 1-bit-friendly canvas.
 *
 * Thermal printers can only print Latin text from a single-byte codepage, so Tamil (and a logo) can't go out
 * as ESC/POS *text* at all. Instead the whole receipt is drawn here, where the browser's own Tamil font
 * shaping is available, and printed as a raster bitmap (see escposRaster.ts).
 *
 * The same canvas backs the on-screen bill and the receipt preview, so what the staff see and what the
 * customer is handed cannot drift apart.
 */
import { buildRasterReceipt } from "./escposRaster";
import type { BillInput } from "./receipt";
import { LOGO_SIZE, PAPER_WIDTH_DOTS, RECEIPT_LOGO_URL, SHOP_DETAILS } from "./shopDetails";

/** Printable dots across the paper. See PAPER_WIDTH_DOTS. */
export const RECEIPT_WIDTH = PAPER_WIDTH_DOTS;

/**
 * The layout was drawn for 80 mm paper (576 dots). On narrower paper (58 mm is 384 dots) every size and gap shrinks
 * by this factor so the same bill fits; the type stays large enough to read (a Tamil line is still about 20 dots
 * tall). `size()` scales a size or gap in the 80 mm design.
 */
const SCALE = PAPER_WIDTH_DOTS >= 520 ? 1 : 0.82;
const size = (n: number) => Math.round(n * SCALE);

const PAD = SCALE === 1 ? 8 : 6;
const CONTENT_LEFT = PAD;
const CONTENT_RIGHT = RECEIPT_WIDTH - PAD;
const CENTER = RECEIPT_WIDTH / 2;

/** Tamil first: the system Tamil face shapes the script correctly; the Latin fallbacks only handle digits and the few ASCII labels. */
export const FONT_STACK = '"Noto Sans Tamil", "Latha", "Nirmala UI", system-ui, sans-serif';

export const font = (designSize: number, weight: "normal" | "bold" = "normal") => `${weight} ${Math.round(designSize * SCALE)}px ${FONT_STACK}`;

/** Every label on the paper is Tamil: the receipt is for the customer, so it reads in one language. */
const L = {
  item: "பொருள்",
  amount: "தொகை",
  date: "தேதி",
  billNo: "பில் எண்",
  total: "மொத்தம்",
  subtotal: "கூட்டுத்தொகை",
  discount: "தள்ளுபடி",
  roundOff: "ரவுண்ட் ஆஃப்",
  totalWeight: "மொத்த எடை",
  totalPieces: "மொத்த எண்ணிக்கை",
  payment: "பணம் செலுத்தும் முறை",
  phone: "தொலைபேசி",
  copy: "நகல்",
  customer: "வாடிக்கையாளர்",
} as const;

/** Widest line total the amount column has to hold, used as a floor on its width so a big bill can't push an amount into the name beside it. */
const WIDEST_AMOUNT = "₹99,999.00";

/** The shop name is set in its own face (a bold serif, in capitals), apart from the Tamil text. */
const NAME_FONT_STACK = 'Georgia, "Noto Serif", "DejaVu Serif", serif';

async function loadLogo(): Promise<HTMLImageElement | null> {
  const url = RECEIPT_LOGO_URL;
  if (!url) return null; // disabled: skip the fetch entirely
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // no logo file: print without it
    img.src = url;
  });
}

/** Greedy wrap so long item names spill to a second line instead of colliding with the amount. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function formatDate(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatTime(date: Date): string {
  let h = date.getHours();
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 === 0 ? 12 : h % 12;
  return `${pad2(h)}:${pad2(date.getMinutes())} ${period}`;
}

export interface ReceiptRasterTiming {
  /** document.fonts.ready + logo fetch + the two paint() passes. */
  renderMs: number;
  /** packRaster's per-pixel scan + assembling the ESC/POS command stream. */
  rasterMs: number;
}

/**
 * Canvas render + ESC/POS encode in one call, timed: the two steps every print (and print retry) needs
 * back to back, instrumented once here so the numbers can't drift apart from what actually ran.
 */
export async function prepareReceiptRaster(bill: BillInput): Promise<{ bytes: Uint8Array; timing: ReceiptRasterTiming }> {
  const renderStart = performance.now();
  const canvas = await renderReceiptCanvas(bill);
  const renderMs = performance.now() - renderStart;

  const rasterStart = performance.now();
  const bytes = buildRasterReceipt(canvas);
  const rasterMs = performance.now() - rasterStart;

  return { bytes, timing: { renderMs, rasterMs } };
}

export async function renderReceiptCanvas(bill: BillInput): Promise<HTMLCanvasElement> {
  // Tamil glyphs measure as tofu until the face is actually loaded, which would throw off every wrap and
  // right-alignment on the receipt.
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* proceed with whatever is loaded */
    }
  }

  const logo = await loadLogo();

  // Two passes over an identical draw list: the first only advances `y` to learn the height, the second
  // draws for real once the canvas is sized.
  const measure = document.createElement("canvas").getContext("2d")!;
  const height = paint(measure, bill, logo, true);

  const canvas = document.createElement("canvas");
  canvas.width = RECEIPT_WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  paint(ctx, bill, logo, false);

  return canvas;
}

function paint(ctx: CanvasRenderingContext2D, bill: BillInput, logo: HTMLImageElement | null, measureOnly: boolean): number {
  const draw = (fn: () => void) => {
    if (!measureOnly) fn();
  };
  // Lines are filled rectangles, not strokes, so they stay solid black on a 1-bit print.
  // This printer does not heat a whole 1 to 2 dot row across the full width (such lines came out blank), so a
  // horizontal line is a short-dashed line, at least 3 dots thick, which prints dark and even.
  const rule = (yy: number, thick = 2) =>
    draw(() => {
      const t = Math.max(3, thick + 1);
      const top = Math.round(yy - t / 2);
      for (let x = CONTENT_LEFT; x < CONTENT_RIGHT; x += 11) ctx.fillRect(x, top, Math.min(8, CONTENT_RIGHT - x), t);
    });
  const text = (s: string, x: number, baseline: number, f: string, align: CanvasTextAlign) =>
    draw(() => {
      ctx.font = f;
      ctx.textAlign = align;
      ctx.fillText(s, x, baseline);
    });
  const GAP = size(11); // space above and below the text of a row

  ctx.textBaseline = "alphabetic";
  let y = PAD;

  // --- Logo -----------------------------------------------------------------
  if (logo && logo.width > 0) {
    const scale = Math.min(LOGO_SIZE.width / logo.width, LOGO_SIZE.height / logo.height, 1);
    const w = logo.width * scale;
    const h = logo.height * scale;
    draw(() => ctx.drawImage(logo, CENTER - w / 2, y, w, h));
    y += h + size(10);
  }

  // --- Shop name: capitals in a bold serif, as big as fits ------------------
  const shopName = SHOP_DETAILS.name.toUpperCase();
  const spacing = size(3);
  const nameFontAt = (n: number) => `bold ${Math.round(n * SCALE)}px ${NAME_FONT_STACK}`;
  const setSpacing = (px: number) => {
    (ctx as unknown as { letterSpacing?: string }).letterSpacing = `${px}px`;
  };
  let nameSize = 38;
  ctx.font = nameFontAt(nameSize);
  setSpacing(spacing);
  while (nameSize > 20 && ctx.measureText(shopName).width > CONTENT_RIGHT - CONTENT_LEFT - spacing) {
    nameSize -= 2;
    ctx.font = nameFontAt(nameSize);
  }
  setSpacing(0);
  y += size(nameSize);
  draw(() => {
    ctx.font = nameFontAt(nameSize);
    setSpacing(spacing);
    ctx.textAlign = "center";
    // Letter spacing adds a gap after the last letter too, so nudge back to stay centred.
    ctx.fillText(shopName, CENTER + spacing / 2, y);
    setSpacing(0);
  });

  if (SHOP_DETAILS.subtitle) {
    y += size(34);
    text(SHOP_DETAILS.subtitle, CENTER, y, font(24), "center");
  }
  if (SHOP_DETAILS.phone) {
    y += size(30);
    text(`${L.phone}: ${SHOP_DETAILS.phone}`, CENTER, y, font(22), "center");
  }

  // --- Copy mark ------------------------------------------------------------
  // A reprint says so, in large type between rules, so it cannot be handed over as a second original.
  if (bill.isCopy) {
    y += size(46);
    const copyY = y;
    draw(() => {
      ctx.font = font(36, "bold");
      ctx.textAlign = "center";
      const half = ctx.measureText(L.copy).width / 2;
      ctx.fillText(L.copy, CENTER, copyY);
      ctx.fillRect(CONTENT_LEFT, copyY - size(14), CENTER - half - size(16) - CONTENT_LEFT, 3);
      ctx.fillRect(CENTER + half + size(16), copyY - size(14), CONTENT_RIGHT - (CENTER + half + size(16)), 3);
    });
  }
  y += size(18);

  // --- Bill details ------------------------------------------------------------
  const detailFont = font(24);
  y += size(12);
  rule(y);
  y += GAP + size(24);
  text(`${L.date}: ${formatDate(bill.createdAt)}`, CONTENT_LEFT, y, detailFont, "left");
  text(formatTime(bill.createdAt), CONTENT_RIGHT, y, detailFont, "right");
  y += size(10) + GAP + size(8);
  text(`${L.billNo}: ${bill.billNo}`, CONTENT_LEFT, y + size(14), detailFont, "left");
  y += size(14) + size(10) + GAP;
  rule(y);

  // --- Items: a header, then each item with its quantity and rate beneath ---------
  y += GAP + size(22);
  text(L.item, CONTENT_LEFT, y, font(22, "bold"), "left");
  text(L.amount, CONTENT_RIGHT, y, font(22, "bold"), "right");
  y += size(8) + GAP;
  rule(y);

  ctx.font = font(28, "bold");
  const amountW = Math.max(ctx.measureText(WIDEST_AMOUNT).width, ctx.measureText(L.amount).width);
  const itemMax = CONTENT_RIGHT - CONTENT_LEFT - amountW - size(12);

  for (const item of bill.lines) {
    ctx.font = font(28, "bold");
    const nameLines = wrap(ctx, item.name, itemMax);
    y += size(14) + size(28);
    text(nameLines[0], CONTENT_LEFT, y, font(28, "bold"), "left");
    text(item.amount, CONTENT_RIGHT, y, font(28, "bold"), "right");
    for (const extra of nameLines.slice(1)) {
      y += size(36);
      text(extra, CONTENT_LEFT, y, font(28, "bold"), "left");
    }
    // How much and at what rate (and the usual rate, if the price was changed).
    ctx.font = font(24);
    for (const line of wrap(ctx, `${item.quantity} × ${item.rate}`, CONTENT_RIGHT - CONTENT_LEFT - size(16))) {
      y += size(34);
      text(line, CONTENT_LEFT + size(10), y, font(24), "left");
    }
    if (item.note) {
      y += size(30);
      text(`* ${item.note}`, CONTENT_LEFT + size(10), y, font(22), "left");
    }
    // A blank line after every item.
    y += size(34);
  }
  y += size(4);
  rule(y);

  // --- Totals ---------------------------------------------------------------
  const pair = (label: string, value: string, f = font(24), fs = 24, gap = GAP) => {
    y += gap + size(fs);
    text(label, CONTENT_LEFT, y, f, "left");
    text(value, CONTENT_RIGHT, y, f, "right");
    y += size(Math.round(fs * 0.3)) + gap / 2 + (fs <= 24 ? size(16) : 0);
  };
  if (bill.totalWeight) pair(L.totalWeight, bill.totalWeight);
  if (bill.totalPieces) pair(L.totalPieces, bill.totalPieces);
  if (bill.subtotal && (bill.discount || bill.roundOff)) {
    pair(L.subtotal, bill.subtotal);
    if (bill.discount) pair(L.discount, bill.discount);
    if (bill.roundOff) pair(L.roundOff, bill.roundOff);
  }
  y += GAP / 2;
  rule(y, 3);
  pair(L.total, bill.total, font(40, "bold"), 40, size(12));
  rule(y, 3);
  pair(L.payment, bill.paymentLabel);
  // A credit slip has to name who it is on account for.
  if (bill.customerName) pair(L.customer, bill.customerName);
  // A split bill's two figures get a line to themselves, so a long figure never runs into anything.
  if (bill.paymentDetail) {
    ctx.font = font(24);
    for (const line of wrap(ctx, bill.paymentDetail, CONTENT_RIGHT - CONTENT_LEFT)) {
      y += size(34);
      text(line, CONTENT_LEFT, y, font(24), "left");
    }
  }
  y += GAP;
  rule(y);

  // --- Footer (empty by default) ---------------------------------------------
  if (SHOP_DETAILS.thanks) {
    y += size(46);
    text(SHOP_DETAILS.thanks, CENTER, y, font(30, "bold"), "center");
  }
  if (SHOP_DETAILS.footer) {
    y += size(32);
    text(SHOP_DETAILS.footer, CENTER, y, font(22), "center");
  }

  // Blank tail so the tear-off edge clears the last line (the print also feeds about 2 cm after it).
  y += size(24);
  return Math.ceil(y);
}
